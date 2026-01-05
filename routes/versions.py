from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import uuid
from database.connection import get_db, SessionLocal
from database.models.user import User
from database.models.version import Version
from routes.auth import get_current_user
from app.services.version_service import VersionService
from pydantic import BaseModel

router = APIRouter(prefix="/api/versions", tags=["Versions"])

# In-memory download state: { task_id: { status: 'pending'|'downloading'|'completed'|'error', progress: 0, details: str } }
active_downloads: Dict[str, Dict] = {}

class VersionDownloadRequest(BaseModel):
    loader_type: str
    mc_version: str
    loader_version_id: Optional[str] = "latest"

def task_download_version(task_id: str, request: VersionDownloadRequest):
    # Create a new session for the background task
    db = SessionLocal()
    try:
        service = VersionService(db)
        
        def update_progress(percent, current, total):
            active_downloads[task_id]["progress"] = percent
            active_downloads[task_id]["details"] = f"{current}/{total} bytes"

        active_downloads[task_id]["status"] = "downloading"
        
        service.download_version(
            request.loader_type, 
            request.mc_version, 
            request.loader_version_id, 
            progress_callback=update_progress
        )
        
        active_downloads[task_id]["status"] = "completed"
        active_downloads[task_id]["progress"] = 100
        
    except Exception as e:
        active_downloads[task_id]["status"] = "error"
        active_downloads[task_id]["error"] = str(e)
    finally:
        db.close()

@router.get("/", response_model=List[dict]) 
def list_installed_versions(db: Session = Depends(get_db)):
    service = VersionService(db)
    versions = service.get_installed_versions()
    return [{
        "id": v.id,
        "name": v.name,
        "loader_type": v.loader_type,
        "mc_version": v.mc_version,
        "loader_version": v.loader_version,
        "file_size": v.file_size,
        "downloaded": v.downloaded,
        "local_path": v.local_path
    } for v in versions]

@router.get("/stats")
def get_version_stats(db: Session = Depends(get_db)):
    service = VersionService(db)
    return service.get_version_stats()

@router.get("/remote/{loader_type}")
def list_remote_versions(loader_type: str, db: Session = Depends(get_db)):
    service = VersionService(db)
    return service.get_remote_versions(loader_type)

@router.post("/download")
def download_version(
    request: VersionDownloadRequest, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    task_id = str(uuid.uuid4())
    active_downloads[task_id] = {
        "status": "pending",
        "progress": 0,
        "loader": request.loader_type,
        "version": request.mc_version
    }
    
    background_tasks.add_task(task_download_version, task_id, request)
    
    return {"message": "Download started", "task_id": task_id}

@router.get("/downloads/active")
def get_active_downloads(current_user: User = Depends(get_current_user)):
    # Clean up completed/error tasks older than X? 
    # For now just return all. Frontend can filter.
    return active_downloads

@router.post("/downloads/{task_id}/ack")
def acknowledge_download(task_id: str, current_user: User = Depends(get_current_user)):
    """Remove task from tracking"""
    if task_id in active_downloads:
        del active_downloads[task_id]
    return {"status": "ok"}
