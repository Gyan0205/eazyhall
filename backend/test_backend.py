import os
import tempfile
import unittest

# Run tests against a throwaway database so they never wipe the real one.
# Must be set before importing the app, which creates the engine on import.
_TEST_DB = os.path.join(tempfile.mkdtemp(), "test_eazyhall.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

from fastapi.testclient import TestClient
from main import app, seed_data
import database
import models
import datetime

# Ensure seeded data is present
seed_data()

client = TestClient(app)

class TestEazyHall(unittest.TestCase):
    def setUp(self):
        # We can clean up bookings and audit logs to make tests reproducible,
        # but keep tenants, resources, and users seeded.
        self.db = database.SessionLocal()
        self.db.query(models.Booking).delete()
        self.db.query(models.AuditLog).delete()
        self.db.query(models.Notification).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def get_token(self, username, password, tenant_code):
        res = client.post("/api/auth/login", json={
            "username": username,
            "password": password,
            "tenant_code": tenant_code
        })
        self.assertEqual(res.status_code, 200)
        return res.json()["access_token"]

    def test_multi_tenant_isolation(self):
        """
        Verify that a student from Computing cannot see or book Athletics resources.
        """
        comp_token = self.get_token("stud_comp", "student123", "computing")
        ath_token = self.get_token("stud_ath", "student123", "athletics")

        # 1. Fetch computing resources
        res_comp = client.get("/api/resources", headers={"Authorization": f"Bearer {comp_token}"})
        self.assertEqual(res_comp.status_code, 200)
        comp_res_names = [r["name"] for r in res_comp.json()]
        self.assertIn("Ada Lovelace Lab", comp_res_names)
        self.assertNotIn("Main Sports Arena", comp_res_names)

        # 2. Fetch athletics resources
        res_ath = client.get("/api/resources", headers={"Authorization": f"Bearer {ath_token}"})
        self.assertEqual(res_ath.status_code, 200)
        ath_res_names = [r["name"] for r in res_ath.json()]
        self.assertIn("Main Sports Arena", ath_res_names)
        self.assertNotIn("Ada Lovelace Lab", ath_res_names)

    def test_booking_conflict_prevention(self):
        """
        Verify that creating overlapping bookings returns 409 Conflict.
        """
        comp_token = self.get_token("stud_comp", "student123", "computing")
        
        # Get resource ID
        resources = client.get("/api/resources", headers={"Authorization": f"Bearer {comp_token}"}).json()
        lab_id = [r["id"] for r in resources if r["name"] == "Ada Lovelace Lab"][0]

        # Create booking 1: 10:00 to 11:00 (Tomorrow, so it's never in the past)
        now = datetime.datetime.utcnow().date() + datetime.timedelta(days=1)
        start1 = datetime.datetime.combine(now, datetime.time(10, 0)).isoformat()
        end1 = datetime.datetime.combine(now, datetime.time(11, 0)).isoformat()

        res1 = client.post("/api/bookings", headers={"Authorization": f"Bearer {comp_token}"}, json={
            "resource_id": lab_id,
            "start_time": start1,
            "end_time": end1,
            "purpose": "Study Session"
        })
        self.assertEqual(res1.status_code, 200)

        # Try to create conflicting booking 2: 10:30 to 11:30
        start2 = datetime.datetime.combine(now, datetime.time(10, 30)).isoformat()
        end2 = datetime.datetime.combine(now, datetime.time(11, 30)).isoformat()

        res2 = client.post("/api/bookings", headers={"Authorization": f"Bearer {comp_token}"}, json={
            "resource_id": lab_id,
            "start_time": start2,
            "end_time": end2,
            "purpose": "Concurrent Class"
        })
        # Overlapping booking should fail with 409 Conflict
        self.assertEqual(res2.status_code, 409)

    def test_rbac_permissions(self):
        """
        Verify role-based access rules.
        """
        student_token = self.get_token("stud_comp", "student123", "computing")
        admin_token = self.get_token("admin_comp", "admin123", "computing")

        # 1. Student attempts to create a resource (Should fail 403)
        res1 = client.post("/api/resources", headers={"Authorization": f"Bearer {student_token}"}, json={
            "name": "Supercomputer Lab",
            "type": "Lab",
            "location": "Room 500",
            "capacity": 10
        })
        self.assertEqual(res1.status_code, 403)

        # 2. Student attempts to view audit logs (Should fail 403)
        res2 = client.get("/api/audit/logs", headers={"Authorization": f"Bearer {student_token}"})
        self.assertEqual(res2.status_code, 403)

        # 3. Admin attempts to view audit logs (Should pass 200)
        res3 = client.get("/api/audit/logs", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res3.status_code, 200)

    def test_tamper_evident_audit_log(self):
        """
        Test that audit logs chain correctly and catch unauthorized database tempering.
        """
        admin_token = self.get_token("admin_comp", "admin123", "computing")

        # 1. Generate some audit logs by creating a resource
        res = client.post("/api/resources", headers={"Authorization": f"Bearer {admin_token}"}, json={
            "name": "Grace Hopper Hall",
            "type": "Hall",
            "location": "Room 204",
            "capacity": 80
        })
        self.assertEqual(res.status_code, 200)

        # 2. Verify audit logs chain integrity (should be valid)
        verify_res = client.post("/api/audit/verify", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(verify_res.status_code, 200)
        self.assertTrue(verify_res.json()["valid"])

        # 3. Simulate database tampering via debug route
        tamper_res = client.post("/api/audit/tamper", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(tamper_res.status_code, 200)

        # 4. Re-verify audit logs (should catch the mismatch and fail)
        verify_tampered_res = client.post("/api/audit/verify", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(verify_tampered_res.status_code, 200)
        self.assertFalse(verify_tampered_res.json()["valid"])
        self.assertEqual(verify_tampered_res.json()["error"], "Hash mismatch")
        print("Tamper verification caught: ", verify_tampered_res.json()["details"])

    def test_self_registration_cannot_grant_admin(self):
        """
        Public registration must not let anyone create an Admin or Faculty account.
        """
        for role in ["Admin", "Faculty"]:
            res = client.post("/api/auth/register", json={
                "username": f"sneaky_{role.lower()}",
                "password": "password123",
                "role": role,
                "tenant_code": "computing"
            })
            self.assertEqual(res.status_code, 403)

    def test_cannot_cancel_twice(self):
        """
        A cancelled booking can't be cancelled again (which would spam the audit log).
        """
        token = self.get_token("fac_comp", "faculty123", "computing")
        headers = {"Authorization": f"Bearer {token}"}
        resources = client.get("/api/resources", headers=headers).json()
        lab_id = [r["id"] for r in resources if r["name"] == "Turing Seminar Hall"][0]
        day = datetime.datetime.utcnow().date() + datetime.timedelta(days=1)
        res = client.post("/api/bookings", headers=headers, json={
            "resource_id": lab_id,
            "start_time": datetime.datetime.combine(day, datetime.time(9, 0)).isoformat(),
            "end_time": datetime.datetime.combine(day, datetime.time(10, 0)).isoformat(),
            "purpose": "Lecture"
        })
        self.assertEqual(res.status_code, 200)
        booking_id = res.json()["id"]
        self.assertEqual(client.post(f"/api/bookings/{booking_id}/cancel", headers=headers).status_code, 200)
        self.assertEqual(client.post(f"/api/bookings/{booking_id}/cancel", headers=headers).status_code, 400)

    def test_audit_chain_is_tenant_isolated(self):
        """
        Tampering in one tenant's ledger must not affect another tenant's verification.
        """
        comp_admin = {"Authorization": f"Bearer {self.get_token('admin_comp', 'admin123', 'computing')}"}
        ath_admin = {"Authorization": f"Bearer {self.get_token('admin_ath', 'admin123', 'athletics')}"}
        for headers, name in [(comp_admin, "Comp Room"), (ath_admin, "Ath Field")]:
            res = client.post("/api/resources", headers=headers, json={
                "name": name, "type": "Hall", "location": "X", "capacity": 5
            })
            self.assertEqual(res.status_code, 200)

        self.assertEqual(client.post("/api/audit/tamper", headers=comp_admin).status_code, 200)
        self.assertFalse(client.post("/api/audit/verify", headers=comp_admin).json()["valid"])
        self.assertTrue(client.post("/api/audit/verify", headers=ath_admin).json()["valid"])

        # Repair only re-seals the caller's tenant
        client.post("/api/audit/repair", headers=comp_admin)
        self.assertTrue(client.post("/api/audit/verify", headers=comp_admin).json()["valid"])

    def test_booking_in_past_rejected(self):
        """
        Bookings that start in the past are rejected.
        """
        headers = {"Authorization": f"Bearer {self.get_token('fac_comp', 'faculty123', 'computing')}"}
        resources = client.get("/api/resources", headers=headers).json()
        lab_id = resources[0]["id"]
        start = datetime.datetime.utcnow() - datetime.timedelta(hours=2)
        res = client.post("/api/bookings", headers=headers, json={
            "resource_id": lab_id,
            "start_time": start.isoformat() + "Z",
            "end_time": (start + datetime.timedelta(hours=1)).isoformat() + "Z",
            "purpose": "Too late"
        })
        self.assertEqual(res.status_code, 400)

    def test_admin_creates_users_in_own_department(self):
        """
        Admins can create Faculty accounts in their own department only; others can't create users.
        """
        admin = {"Authorization": f"Bearer {self.get_token('admin_comp', 'admin123', 'computing')}"}
        student = {"Authorization": f"Bearer {self.get_token('stud_comp', 'student123', 'computing')}"}
        new_user = {"username": "prof_new", "password": "teach123", "role": "Faculty"}

        self.assertEqual(client.post("/api/users", headers=student, json=new_user).status_code, 403)
        self.assertEqual(client.post("/api/users", headers=admin, json={**new_user, "role": "Wizard"}).status_code, 400)

        res = client.post("/api/users", headers=admin, json=new_user)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(client.post("/api/users", headers=admin, json=new_user).status_code, 400)  # duplicate

        # New user signs in to Computing only
        self.get_token("prof_new", "teach123", "computing")
        res = client.post("/api/auth/login", json={"username": "prof_new", "password": "teach123", "tenant_code": "athletics"})
        self.assertEqual(res.status_code, 400)

        names = [u["username"] for u in client.get("/api/users", headers=admin).json()]
        self.assertIn("prof_new", names)
        self.assertNotIn("admin_ath", names)

        # Clean up so the test can run again on the same database
        db = database.SessionLocal()
        db.query(models.User).filter(models.User.username == "prof_new").delete()
        db.commit()
        db.close()

    def test_change_password(self):
        """
        Users can change their own password after confirming the current one.
        """
        headers = {"Authorization": f"Bearer {self.get_token('stud_ath', 'student123', 'athletics')}"}
        wrong = client.post("/api/auth/change-password", headers=headers, json={"current_password": "nope", "new_password": "newpass123"})
        self.assertEqual(wrong.status_code, 400)

        ok = client.post("/api/auth/change-password", headers=headers, json={"current_password": "student123", "new_password": "newpass123"})
        self.assertEqual(ok.status_code, 200)
        self.get_token("stud_ath", "newpass123", "athletics")

        # Restore the seeded password for other tests
        headers = {"Authorization": f"Bearer {self.get_token('stud_ath', 'newpass123', 'athletics')}"}
        client.post("/api/auth/change-password", headers=headers, json={"current_password": "newpass123", "new_password": "student123"})

if __name__ == "__main__":
    unittest.main()
