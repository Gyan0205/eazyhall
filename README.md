# EazyHall

EazyHall is a multi-tenant booking system for campus facilities (labs, halls, courts, equipment) with role-based access, conflict detection, notifications, and a tamper-evident audit log.

- **Backend:** FastAPI + SQLAlchemy (SQLite by default) in [`backend/`](backend)
- **Frontend:** React + Vite in [`frontend/`](frontend)

## Features

- **Tenants (departments):** School of Computing and Department of Athletics. Users only see their own department's resources, bookings, and logs.
- **Roles:**
  - **Student:** bookings start as *Pending* and need admin approval.
  - **Faculty:** bookings are approved automatically.
  - **Admin:** manages resources, approves or rejects bookings, cancels any booking, and views the audit ledger.
- **Rooms & facilities:** every room shows its seats, location, facilities and description; admins can edit them.
- **Weekly timetable:** each room has a Mon–Sun timetable of its bookings (who, what, when). Click a free slot to book it.
- **Conflict detection:** overlapping Pending or Approved bookings on the same resource are rejected with `409`. Bookings in the past are rejected.
- **Light and dark themes:** pick light, dark, or follow the device setting. Works on desktop and phone screens.
- **Audit ledger:** each department's actions are SHA-256 hash-chained, so editing a row directly in the database is detected by **Verify Audit Chain**.

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

On first start the database is created and seeded with demo data. API docs: http://127.0.0.1:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### Demo accounts

| Department | Admin | Faculty | Student |
|---|---|---|---|
| `computing` | `admin_comp` / `admin123` | `fac_comp` / `faculty123` | `stud_comp` / `student123` |
| `athletics` | `admin_ath` / `admin123` | `fac_ath` / `faculty123` | `stud_ath` / `student123` |

The login screen has preset buttons that fill these in. Public sign-up creates **Student** accounts only.

## Tests

```bash
cd backend
pytest -q
```

The tests use a temporary database, so they don't touch your local data.

## Configuration

Backend (environment variables, see [`backend/.env.example`](backend/.env.example)):

| Variable | Purpose | Default |
|---|---|---|
| `SECRET_KEY` | Signs login tokens. **Set this when hosting.** | random per restart |
| `DATABASE_URL` | SQLAlchemy database URL | SQLite file in `backend/` |
| `CORS_ORIGINS` | Comma-separated allowed frontend URLs | `*` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Login session length | `120` |
| `DEMO_MODE` | Seed demo accounts and enable the tamper/heal demo tools | `true` |
| `ADMIN_PASSWORD` | With `DEMO_MODE=false`, password for the auto-created `admin_<department>` accounts | none |

Frontend (see [`frontend/.env.example`](frontend/.env.example)):

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE` | Backend API URL, baked in at build time | `http://127.0.0.1:8000/api` |

## Deploying

See [DEPLOY.md](DEPLOY.md) for step-by-step hosting on Neon (Postgres), Render (backend) and Vercel (frontend).

With `DEMO_MODE=false` (the setting in `render.yaml`), the demo accounts and the **Simulate Database Tampering** / **Heal Ledger Chain** tools are switched off, since their passwords are public and "heal" would hide real tampering.
