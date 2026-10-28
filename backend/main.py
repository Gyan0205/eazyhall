from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
import os
from pydantic import BaseModel, Field

import models, auth, database, conflict, audit
from database import engine, get_db
from models import Tenant, User, Resource, Booking, AuditLog, Notification
from auth import RequireRole, get_current_user

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Multi-Tenant Campus Resource Booking & Access Control Platform")

# DEMO_MODE (default on) seeds demo accounts with well-known passwords and enables the
# tamper/repair audit demo routes. Turn it off for any public deployment.
DEMO_MODE = os.getenv("DEMO_MODE", "true").strip().lower() in ("1", "true", "yes")

# In production, the initial Admin account of each department gets this password.
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# CORS middleware config. Set CORS_ORIGINS to a comma-separated list of frontend URLs when hosting.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # Auth uses a bearer header, not cookies, so credentials aren't needed (and can't be combined with "*")
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str
    tenant_code: str

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    role: str
    tenant_code: str

# Self-registration is limited to Students; elevated roles would let anyone approve
# bookings and read audit logs. Faculty/Admin accounts are seeded or created by an admin.
SELF_REGISTER_ROLES = ["Student"]

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    tenant_id: int
    tenant_code: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ResourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(min_length=1, max_length=50)
    location: str = Field(min_length=1, max_length=100)
    capacity: int = Field(gt=0)

class BookingCreate(BaseModel):
    resource_id: int
    start_time: str # ISO string format
    end_time: str   # ISO string format
    purpose: str = Field(min_length=1, max_length=500)

# --- Seed Database on Startup ---
@app.on_event("startup")
def seed_data():
    db = database.SessionLocal()
    try:
        # Check if tenants already exist
        if db.query(Tenant).count() == 0:
            print("Seeding database...")
            # 1. Create Tenants
            computing = Tenant(name="School of Computing", code="computing")
            athletics = Tenant(name="Department of Athletics", code="athletics")
            db.add_all([computing, athletics])
            db.commit()
            db.refresh(computing)
            db.refresh(athletics)

            # 2. Create demo users (only in demo mode; their passwords are public)
            if DEMO_MODE:
                users_data = [
                    # Computing users
                    ("admin_comp", "admin123", "Admin", computing.id),
                    ("fac_comp", "faculty123", "Faculty", computing.id),
                    ("stud_comp", "student123", "Student", computing.id),
                    # Athletics users
                    ("admin_ath", "admin123", "Admin", athletics.id),
                    ("fac_ath", "faculty123", "Faculty", athletics.id),
                    ("stud_ath", "student123", "Student", athletics.id),
                ]
                for username, pwd, role, t_id in users_data:
                    hashed = auth.get_password_hash(pwd)
                    db.add(User(username=username, hashed_password=hashed, role=role, tenant_id=t_id))

            # 3. Create Resources
            resources_data = [
                # Computing resources
                ("Ada Lovelace Lab", "Lab", "Room 301", 40, computing.id),
                ("Turing Seminar Hall", "Hall", "Room 102", 100, computing.id),
                ("VR Research Kit", "Equipment", "Lab 2", 5, computing.id),
                # Athletics resources
                ("Main Sports Arena", "Court", "Block B", 200, athletics.id),
                ("Squash Court A", "Court", "Sports Complex", 2, athletics.id),
                ("High-Performance Gym", "Court", "Sports Complex", 15, athletics.id),
            ]
            for name, rtype, loc, cap, t_id in resources_data:
                db.add(Resource(name=name, type=rtype, location=loc, capacity=cap, tenant_id=t_id))

            db.commit()
            print("Database seeded successfully.")

        # Production: make sure every department has an admin, using ADMIN_PASSWORD
        if not DEMO_MODE:
            for tenant in db.query(Tenant).all():
                has_admin = db.query(User).filter(User.tenant_id == tenant.id, User.role == "Admin").first()
                if has_admin:
                    continue
                if not ADMIN_PASSWORD:
                    print(f"WARNING: no admin for '{tenant.code}'. Set ADMIN_PASSWORD to create one.")
                    continue
                db.add(User(
                    username=f"admin_{tenant.code}",
                    hashed_password=auth.get_password_hash(ADMIN_PASSWORD),
                    role="Admin",
                    tenant_id=tenant.id
                ))
                print(f"Created admin account 'admin_{tenant.code}'.")
            db.commit()
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

# --- Helper Background Tasks ---
def simulate_notification_dispatch(db_session_factory, tenant_id: int, user_id: int, message: str):
    """
    Simulates sending email/app notifications asynchronously.
    """
    db = db_session_factory()
    try:
        notification = Notification(
            tenant_id=tenant_id,
            user_id=user_id,
            message=message,
            status="Sent"
        )
        db.add(notification)
        db.commit()
    except Exception as e:
        print(f"Background notification error: {e}")
    finally:
        db.close()

def parse_client_datetime(value: str) -> datetime.datetime:
    """
    Parses an ISO date-time from the client into a naive datetime.
    Offset-aware values (e.g. '...Z' or '+05:30') are converted to UTC first
    instead of having their offset silently dropped.
    """
    dt = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is not None:
        dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return dt

def require_demo_mode():
    # Hide demo-only routes entirely when DEMO_MODE is off
    if not DEMO_MODE:
        raise HTTPException(status_code=404, detail="Not Found")

# --- Public config ---
@app.get("/api/config")
def get_config():
    # Lets the frontend hide demo-only controls in production
    return {"demo_mode": DEMO_MODE}

# --- Authentication ---
@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.code == req.tenant_code).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="Invalid tenant code")

    user = db.query(User).filter(User.username == req.username, User.tenant_id == tenant.id).first()
    if not user or not auth.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")

    access_token = auth.create_access_token(
        data={"sub": user.username, "tenant_id": user.tenant_id, "role": user.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "tenant_id": user.tenant_id,
            "tenant_code": tenant.code
        }
    }

@app.post("/api/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.code == req.tenant_code).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="Invalid tenant code")

    if req.role not in SELF_REGISTER_ROLES:
        raise HTTPException(status_code=403, detail="Only Student accounts can be self-registered. Ask an administrator for Faculty or Admin access.")

    existing_user = db.query(User).filter(User.username == req.username, User.tenant_id == tenant.id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered under this department")

    hashed_pwd = auth.get_password_hash(req.password)
    new_user = User(
        username=req.username,
        hashed_password=hashed_pwd,
        role=req.role,
        tenant_id=tenant.id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit log
    audit.add_audit_log(
        db=db,
        tenant_id=tenant.id,
        user_id=new_user.id,
        action="USER_REGISTER",
        details={"username": new_user.username, "role": new_user.role}
    )

    return {"message": "Registration successful", "username": new_user.username}

# --- Resources ---
@app.get("/api/resources")
def get_resources(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Logical isolation by tenant
    return db.query(Resource).filter(Resource.tenant_id == current_user.tenant_id).all()

@app.post("/api/resources")
def create_resource(req: ResourceCreate, current_user: User = Depends(RequireRole(["Admin"])), db: Session = Depends(get_db)):
    resource = Resource(
        name=req.name,
        type=req.type,
        location=req.location,
        capacity=req.capacity,
        tenant_id=current_user.tenant_id
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    # Audit log
    audit.add_audit_log(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="CREATE_RESOURCE",
        details={"resource_id": resource.id, "name": resource.name, "type": resource.type}
    )
    return resource

# --- Bookings ---
@app.get("/api/bookings")
def get_bookings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Return all bookings belonging to the tenant to show on schedule
    bookings = db.query(Booking).filter(Booking.tenant_id == current_user.tenant_id).all()
    # Eagerly construct responses with resource/user info
    result = []
    for b in bookings:
        result.append({
            "id": b.id,
            "resource_id": b.resource_id,
            "resource_name": b.resource.name,
            "resource_type": b.resource.type,
            "user_id": b.user_id,
            "username": b.user.username,
            "start_time": b.start_time.isoformat(),
            "end_time": b.end_time.isoformat(),
            "purpose": b.purpose,
            "status": b.status
        })
    return result

@app.post("/api/bookings")
def create_booking(req: BookingCreate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify resource exists and belongs to current tenant
    resource = db.query(Resource).filter(Resource.id == req.resource_id, Resource.tenant_id == current_user.tenant_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found in your department")

    try:
        start_dt = parse_client_datetime(req.start_time)
        end_dt = parse_client_datetime(req.end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date-time format")

    if start_dt >= end_dt:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    # Check for conflicts
    has_conflict = conflict.check_booking_conflict(db, req.resource_id, start_dt, end_dt)
    if has_conflict:
        raise HTTPException(status_code=409, detail="Time slot conflict detected. This resource is already booked.")

    # Determine booking status based on RBAC rules:
    # Admin and Faculty are auto-approved. Students require admin approval.
    initial_status = "Approved" if current_user.role in ["Admin", "Faculty"] else "Pending"

    booking = Booking(
        resource_id=req.resource_id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        start_time=start_dt,
        end_time=end_dt,
        purpose=req.purpose,
        status=initial_status
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Audit trail
    audit.add_audit_log(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="CREATE_BOOKING",
        details={
            "booking_id": booking.id,
            "resource": resource.name,
            "start": req.start_time,
            "end": req.end_time,
            "status": initial_status
        }
    )

    # Send Notification in Background
    msg = f"Booking request for {resource.name} is {initial_status}."
    background_tasks.add_task(simulate_notification_dispatch, database.SessionLocal, current_user.tenant_id, current_user.id, msg)

    # Also notify administrators of a new pending request if user is student
    if initial_status == "Pending":
        admins = db.query(User).filter(User.role == "Admin", User.tenant_id == current_user.tenant_id).all()
        for admin in admins:
            admin_msg = f"New pending booking request from {current_user.username} for {resource.name}."
            background_tasks.add_task(simulate_notification_dispatch, database.SessionLocal, current_user.tenant_id, admin.id, admin_msg)

    return {
        "id": booking.id,
        "resource_id": booking.resource_id,
        "resource_name": resource.name,
        "start_time": booking.start_time.isoformat(),
        "end_time": booking.end_time.isoformat(),
        "status": booking.status
    }

@app.post("/api/bookings/{booking_id}/approve")
def approve_booking(booking_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(RequireRole(["Admin"])), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.tenant_id == current_user.tenant_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking request not found")

    if booking.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve booking with status: {booking.status}")

    # Check for conflicts again in case of concurrent bookings
    has_conflict = conflict.check_booking_conflict(db, booking.resource_id, booking.start_time, booking.end_time, exclude_booking_id=booking.id)
    if has_conflict:
        booking.status = "Rejected"
        db.commit()
        audit.add_audit_log(
            db=db,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            action="REJECT_BOOKING",
            details={"booking_id": booking.id, "resource": booking.resource.name, "booked_by": booking.user.username, "reason": "conflict"}
        )
        raise HTTPException(status_code=409, detail="Approving this booking would cause a scheduling conflict. Automatically marking it as Rejected.")

    booking.status = "Approved"
    db.commit()

    # Audit trail
    audit.add_audit_log(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="APPROVE_BOOKING",
        details={"booking_id": booking.id, "resource": booking.resource.name, "booked_by": booking.user.username}
    )

    # Background notification
    msg = f"Your booking for {booking.resource.name} on {booking.start_time.strftime('%Y-%m-%d %H:%M')} has been approved."
    background_tasks.add_task(simulate_notification_dispatch, database.SessionLocal, booking.tenant_id, booking.user_id, msg)

    return {"message": "Booking approved successfully"}

@app.post("/api/bookings/{booking_id}/reject")
def reject_booking(booking_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(RequireRole(["Admin"])), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.tenant_id == current_user.tenant_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking request not found")

    if booking.status != "Pending":
        raise HTTPException(status_code=400, detail="Only pending bookings can be rejected")

    booking.status = "Rejected"
    db.commit()

    # Audit trail
    audit.add_audit_log(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="REJECT_BOOKING",
        details={"booking_id": booking.id, "resource": booking.resource.name, "booked_by": booking.user.username}
    )

    # Background notification
    msg = f"Your booking for {booking.resource.name} on {booking.start_time.strftime('%Y-%m-%d %H:%M')} was rejected."
    background_tasks.add_task(simulate_notification_dispatch, database.SessionLocal, booking.tenant_id, booking.user_id, msg)

    return {"message": "Booking rejected successfully"}

@app.post("/api/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.tenant_id == current_user.tenant_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Enforce rules: Students/Faculty can only cancel their own bookings. Admins can cancel any.
    if current_user.role != "Admin" and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to cancel this booking")

    if booking.status not in ["Pending", "Approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel booking with status: {booking.status}")

    booking.status = "Cancelled"
    db.commit()

    # Audit trail
    audit.add_audit_log(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="CANCEL_BOOKING",
        details={"booking_id": booking.id, "resource": booking.resource.name, "cancelled_by": current_user.username}
    )

    # Background notification (one message to the booking owner, worded by who cancelled it)
    if booking.user_id != current_user.id:
        msg = f"Administrator cancelled your booking for {booking.resource.name}."
    else:
        msg = f"Booking for {booking.resource.name} has been cancelled."
    background_tasks.add_task(simulate_notification_dispatch, database.SessionLocal, booking.tenant_id, booking.user_id, msg)

    return {"message": "Booking cancelled successfully"}

# --- Audit Logs ---
@app.get("/api/audit/logs")
def get_audit_logs(current_user: User = Depends(RequireRole(["Admin"])), db: Session = Depends(get_db)):
    # Admins can view audit logs for their tenant
    logs = db.query(AuditLog).filter(AuditLog.tenant_id == current_user.tenant_id).order_by(AuditLog.id.desc()).all()
    result = []
    for l in logs:
        result.append({
            "id": l.id,
            "timestamp": l.timestamp.isoformat() + "Z",  # stored as naive UTC
            "username": l.user.username if l.user else "System",
            "action": l.action,
            "details": l.details,
            "prev_hash": l.prev_hash,
            "hash": l.hash
        })
    return result

@app.post("/api/audit/verify")
def verify_audit(current_user: User = Depends(RequireRole(["Admin"])), db: Session = Depends(get_db)):
    # Run the verification engine on this tenant's chain only
    return audit.verify_audit_chain(db, current_user.tenant_id)

@app.post("/api/audit/tamper", dependencies=[Depends(require_demo_mode)])
def simulate_tampering(current_user: User = Depends(RequireRole(["Admin"])), db: Session = Depends(get_db)):
    """
    Simulates database tampering for demonstration/testing purposes.
    Modifies the detail string of the latest audit log directly in the DB
    WITHOUT recalculating the hash. This should cause audit verification to fail.
    """
    last_log = db.query(AuditLog).filter(AuditLog.tenant_id == current_user.tenant_id).order_by(AuditLog.id.desc()).first()
    if not last_log:
        raise HTTPException(status_code=400, detail="No audit logs available to tamper with. Create a resource or booking first!")

    # Alter the log details
    last_log.details = last_log.details.replace("}", ', "tampered": true}')
    db.commit()

    return {"message": f"Successfully tampered with Log ID {last_log.id}. Try running the audit verification to witness the failure!"}

@app.post("/api/audit/repair", dependencies=[Depends(require_demo_mode)])
def repair_audit(current_user: User = Depends(RequireRole(["Admin"])), db: Session = Depends(get_db)):
    """
    Recalculates all SHA-256 hashes chronologically to fix/seal the ledger chain.
    """
    if audit.repair_audit_chain(db, current_user.tenant_id) == 0:
        return {"message": "No logs to repair"}
    return {"message": "Cryptographic audit chain repaired and re-signed successfully!"}

# --- Notifications ---
@app.get("/api/notifications")
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifications = db.query(Notification).filter(
        Notification.tenant_id == current_user.tenant_id,
        Notification.user_id == current_user.id
    ).order_by(Notification.id.desc()).all()
    return [{
        "id": n.id,
        "message": n.message,
        "status": n.status,
        "created_at": n.created_at.isoformat() + "Z",  # stored as naive UTC
    } for n in notifications]
