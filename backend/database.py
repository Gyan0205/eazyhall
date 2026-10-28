import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Defaults to a SQLite file next to this module so it doesn't depend on the working directory
_DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campus_booking.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB_PATH}")

# Hosted Postgres (e.g. Neon) hands out "postgres://" or "postgresql://" URLs;
# point SQLAlchemy at the psycopg 3 driver listed in requirements.txt.
for _prefix in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(_prefix):
        DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len(_prefix):]
        break

if DATABASE_URL.startswith("sqlite"):
    # check_same_thread=False is required for SQLite in multithreaded environments like FastAPI
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pre_ping recovers from connections the server closed while idle (Neon suspends idle databases)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
