from sqlalchemy.orm import Session
from models import Booking
import datetime

def check_booking_conflict(db: Session, resource_id: int, start_time: datetime.datetime, end_time: datetime.datetime, exclude_booking_id: int = None) -> bool:
    """
    Checks if there is a booking conflict for the given resource and time interval.
    Returns True if a conflict exists, False otherwise.
    
    Conflict definition:
    An existing booking (with status in 'Pending', 'Approved') that overlaps with the requested interval.
    Interval overlap check: start_time < existing_end_time AND end_time > existing_start_time.
    """
    query = db.query(Booking).filter(
        Booking.resource_id == resource_id,
        Booking.status.in_(["Pending", "Approved"]),
        Booking.start_time < end_time,
        Booking.end_time > start_time
    )
    
    if exclude_booking_id is not None:
        query = query.filter(Booking.id != exclude_booking_id)
        
    conflicting_booking = query.first()
    return conflicting_booking is not None
