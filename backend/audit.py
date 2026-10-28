import hashlib
import json
from sqlalchemy.orm import Session
from models import AuditLog
import datetime

GENESIS_HASH = "genesis_block_0000000000000000000000"

def calculate_log_hash(prev_hash: str, timestamp: datetime.datetime, tenant_id: int, user_id: int, action: str, details: str) -> str:
    """
    Computes a SHA-256 hash representing a single log block, chaining it to the previous hash.
    """
    # Use isoformat to have a stable string representation of the timestamp
    ts_str = timestamp.isoformat() if isinstance(timestamp, datetime.datetime) else str(timestamp)
    
    payload = f"{prev_hash}|{ts_str}|{tenant_id}|{user_id}|{action}|{details}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def add_audit_log(db: Session, tenant_id: int, user_id: int, action: str, details: dict) -> AuditLog:
    """
    Adds a new audit log to the tenant's hash chain.
    """
    # Each tenant has its own chain so departments stay isolated from each other
    last_log = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).order_by(AuditLog.id.desc()).first()
    prev_hash = last_log.hash if last_log else GENESIS_HASH
    
    timestamp = datetime.datetime.utcnow()
    details_str = json.dumps(details, sort_keys=True)
    
    curr_hash = calculate_log_hash(
        prev_hash=prev_hash,
        timestamp=timestamp,
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        details=details_str
    )
    
    log_entry = AuditLog(
        timestamp=timestamp,
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        details=details_str,
        prev_hash=prev_hash,
        hash=curr_hash
    )
    
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry

def verify_audit_chain(db: Session, tenant_id: int) -> dict:
    """
    Verifies the integrity of a tenant's audit log hash-chain.
    Returns a dict with 'valid' status and any error/tampering details.
    """
    logs = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).order_by(AuditLog.id.asc()).all()
    if not logs:
        return {"valid": True, "message": "No logs to verify"}
    
    expected_prev_hash = GENESIS_HASH
    
    for log in logs:
        # 1. Check link to previous hash
        if log.prev_hash != expected_prev_hash:
            return {
                "valid": False,
                "error": "Link broken",
                "log_id": log.id,
                "action": log.action,
                "details": f"Log #{log.id} has incorrect prev_hash. Expected: {expected_prev_hash}, Got: {log.prev_hash}"
            }
        
        # 2. Recalculate hash and verify match
        recalculated_hash = calculate_log_hash(
            prev_hash=log.prev_hash,
            timestamp=log.timestamp,
            tenant_id=log.tenant_id,
            user_id=log.user_id,
            action=log.action,
            details=log.details
        )
        
        if log.hash != recalculated_hash:
            return {
                "valid": False,
                "error": "Hash mismatch",
                "log_id": log.id,
                "action": log.action,
                "details": f"Log #{log.id} details or hash have been altered. Stored: {log.hash}, Recalculated: {recalculated_hash}"
            }
            
        expected_prev_hash = log.hash
        
    return {"valid": True, "count": len(logs), "message": "All audit log signatures verified successfully."}

def repair_audit_chain(db: Session, tenant_id: int) -> int:
    """
    Recalculates a tenant's hashes chronologically to re-seal its chain.
    Returns the number of logs re-signed.
    """
    logs = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).order_by(AuditLog.id.asc()).all()
    expected_prev_hash = GENESIS_HASH
    for log in logs:
        log.prev_hash = expected_prev_hash
        log.hash = calculate_log_hash(
            prev_hash=log.prev_hash,
            timestamp=log.timestamp,
            tenant_id=log.tenant_id,
            user_id=log.user_id,
            action=log.action,
            details=log.details
        )
        expected_prev_hash = log.hash
    db.commit()
    return len(logs)
