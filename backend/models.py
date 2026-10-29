from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)  # e.g., 'computing', 'athletics'

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="tenant", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="tenant", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="tenant", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'Admin', 'Faculty', 'Student'
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    tenant = relationship("Tenant", back_populates="users")
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    type = Column(String, nullable=False)  # 'Lab', 'Hall', 'Court', 'Equipment'
    location = Column(String, nullable=False)
    capacity = Column(Integer, nullable=False)  # number of seats / people
    facilities = Column(Text, nullable=True)  # JSON list of strings, e.g. ["Projector", "Whiteboard"]
    description = Column(Text, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    tenant = relationship("Tenant", back_populates="resources")
    bookings = relationship("Booking", back_populates="resource", cascade="all, delete-orphan")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    purpose = Column(String, nullable=True)
    status = Column(String, default="Pending")  # 'Pending', 'Approved', 'Rejected', 'Cancelled'

    tenant = relationship("Tenant", back_populates="bookings")
    user = relationship("User", back_populates="bookings")
    resource = relationship("Resource", back_populates="bookings")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Can be null for system actions
    action = Column(String, nullable=False)  # e.g., 'CREATE_BOOKING', 'APPROVE_BOOKING', etc.
    details = Column(Text, nullable=False)
    prev_hash = Column(String, nullable=False)
    hash = Column(String, nullable=False)

    tenant = relationship("Tenant", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, default="Pending")  # 'Pending', 'Sent'
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="notifications")
    user = relationship("User", back_populates="notifications")
