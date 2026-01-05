from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models.user import User
from routes.auth import get_current_user
from app.controllers.system_controller import SystemController
from app.controllers.system_controller import SystemController
from app.services.audit_service import AuditService
from database.schemas import SystemInfo

router = APIRouter(prefix="/api/system", tags=["System"])
system_controller = SystemController()

@router.get("/info", response_model=SystemInfo)
def get_system_info(current_user: User = Depends(get_current_user)):
    """Get system resources: CPU, RAM, Disk availability"""
    return system_controller.get_system_info()

@router.get("/stats")
def get_system_stats(current_user: User = Depends(get_current_user)):
    """Get real-time system stats for monitoring dashboard"""
    return system_controller.get_system_stats()

@router.get("/service/status")
def get_service_status(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    return system_controller.get_service_status()

@router.post("/service/enable")
def enable_service(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    result = system_controller.enable_service()
    if not result["success"]:
        raise HTTPException(status_code=500, detail="Failed to enable service. Ensure admin privileges.")
    AuditService.log_action(db, current_user, "ENABLE_SERVICE", request.client.host, "Enabled system service")
    return result

@router.post("/service/disable")
def disable_service(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    result = system_controller.disable_service()
    if not result["success"]:
        raise HTTPException(status_code=500, detail="Failed to disable service.")
    AuditService.log_action(db, current_user, "DISABLE_SERVICE", request.client.host, "Disabled system service")
    return result
