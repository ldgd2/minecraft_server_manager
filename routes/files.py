from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database.models import User
from routes.auth import get_current_user
from app.controllers.file_controller import FileController

router = APIRouter(prefix="/api/files", tags=["Files"])
file_controller = FileController()

@router.get("/{server_name}")
def list_files(server_name: str, path: str = ".", current_user: User = Depends(get_current_user)):
    try:
        return file_controller.list_files(server_name, path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Server or path not found")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")

@router.post("/{server_name}/upload")
async def upload_file_endpoint(server_name: str, path: str = ".", file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    try:
        await file_controller.upload_file(server_name, path, file)
        return {"message": "File uploaded and processed"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Server not found")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")

@router.post("/{server_name}/config")
async def update_config(server_name: str, properties: dict, current_user: User = Depends(get_current_user)):
    try:
        await file_controller.update_config(server_name, properties)
        return {"message": "Config updated"}
    except FileNotFoundError:
         raise HTTPException(status_code=404, detail="Server not found")

@router.get("/{server_name}/content")
def get_file_content(server_name: str, path: str, current_user: User = Depends(get_current_user)):
    try:
        content = file_controller.get_content(server_name, path)
        return {"content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

from pydantic import BaseModel
class FileSaveRequest(BaseModel):
    path: str
    content: str

@router.post("/{server_name}/save")
def save_file_content(server_name: str, data: FileSaveRequest, current_user: User = Depends(get_current_user)):
    try:
        file_controller.save_content(server_name, data.path, data.content)
        return {"message": "File saved"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")

# ============================================
# GENERAL FILE BROWSER (Restricted Directories)
# ============================================
import os
from pathlib import Path

# Allowed root directories (relative to project root)
ALLOWED_ROOTS = {
    "servers": "servers",
    "worlds": "source/worlds",
    "versions": "source/versions",
}

def get_project_root():
    """Get the project root directory"""
    return Path(__file__).parent.parent.resolve()

def is_safe_path(base_path: Path, requested_path: Path) -> bool:
    """Check if requested path is within base path (prevent path traversal)"""
    try:
        requested_path.resolve().relative_to(base_path.resolve())
        return True
    except ValueError:
        return False

@router.get("/browse/roots")
def get_allowed_roots(current_user: User = Depends(get_current_user)):
    """Get list of allowed root directories"""
    project_root = get_project_root()
    roots = []
    
    for name, rel_path in ALLOWED_ROOTS.items():
        full_path = project_root / rel_path
        roots.append({
            "name": name.capitalize(),
            "path": name,
            "exists": full_path.exists(),
            "icon": "folder"
        })
    
    return roots

@router.get("/browse/{root_name}")
def browse_directory(
    root_name: str, 
    path: str = "",
    current_user: User = Depends(get_current_user)
):
    """Browse files in allowed directories"""
    if root_name not in ALLOWED_ROOTS:
        raise HTTPException(status_code=403, detail="Directory not allowed")
    
    project_root = get_project_root()
    base_path = project_root / ALLOWED_ROOTS[root_name]
    
    # Handle path traversal
    if path:
        target_path = base_path / path
    else:
        target_path = base_path
    
    # Security check
    if not is_safe_path(base_path, target_path):
        raise HTTPException(status_code=403, detail="Access denied - path traversal detected")
    
    # Create directory if it doesn't exist (for empty roots)
    if not target_path.exists():
        target_path.mkdir(parents=True, exist_ok=True)
    
    if not target_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    
    items = []
    try:
        for item in target_path.iterdir():
            stat = item.stat()
            items.append({
                "name": item.name,
                "is_dir": item.is_dir(),
                "size": stat.st_size if item.is_file() else 0,
                "modified": stat.st_mtime,
                "extension": item.suffix.lower() if item.is_file() else None
            })
        
        # Sort: directories first, then files alphabetically
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "root": root_name,
        "current_path": path,
        "parent_path": str(Path(path).parent) if path else None,
        "items": items
    }

@router.get("/browse/{root_name}/content")
def get_file_content_general(
    root_name: str,
    path: str,
    current_user: User = Depends(get_current_user)
):
    """Get content of a text file"""
    if root_name not in ALLOWED_ROOTS:
        raise HTTPException(status_code=403, detail="Directory not allowed")
    
    project_root = get_project_root()
    base_path = project_root / ALLOWED_ROOTS[root_name]
    target_path = base_path / path
    
    # Security check
    if not is_safe_path(base_path, target_path):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check file size (max 5MB - increased)
    if target_path.stat().st_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large to edit (max 5MB)")
    
    # Check if it's a binary file (Only restrict archives and media)
    # Allow .dat, .mca, .nbt, .conf, etc. to be opened as text
    restricted_extensions = {
        # Archives
        '.jar', '.zip', '.gz', '.tar', '.rar', '.7z', 
        # Media
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico',
        '.mp4', '.webm', '.avi', '.mkv', '.mp3', '.wav', '.ogg',
        # Executables
        '.exe', '.dll', '.so', '.dylib'
    }
    
    if target_path.suffix.lower() in restricted_extensions:
        raise HTTPException(status_code=400, detail="Cannot edit binary/media files")
    
    try:
        content = target_path.read_text(encoding='utf-8', errors='replace')
        return {
            "name": target_path.name,
            "path": path,
            "content": content,
            "size": target_path.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

class FileContentSave(BaseModel):
    path: str
    content: str

@router.post("/browse/{root_name}/save")
def save_file_content_general(
    root_name: str,
    data: FileContentSave,
    current_user: User = Depends(get_current_user)
):
    """Save content to a text file"""
    if root_name not in ALLOWED_ROOTS:
        raise HTTPException(status_code=403, detail="Directory not allowed")
    
    project_root = get_project_root()
    base_path = project_root / ALLOWED_ROOTS[root_name]
    target_path = base_path / data.path
    
    # Security check
    if not is_safe_path(base_path, target_path):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if it's a restricted file
    restricted_extensions = {
        '.jar', '.zip', '.gz', '.tar', '.rar', '.7z', 
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico',
        '.mp4', '.webm', '.avi', '.mkv', '.mp3', '.wav', '.ogg',
        '.exe', '.dll', '.so', '.dylib'
    }
    
    if target_path.suffix.lower() in restricted_extensions:
        raise HTTPException(status_code=400, detail="Cannot edit binary/media files")
    
    try:
        target_path.write_text(data.content, encoding='utf-8')
        return {"message": "File saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")

from fastapi.responses import FileResponse
import mimetypes

@router.get("/browse/{root_name}/media")
def get_media_file(
    root_name: str,
    path: str,
    current_user: User = Depends(get_current_user)
):
    """Serve media files (images, videos) directly"""
    if root_name not in ALLOWED_ROOTS:
        raise HTTPException(status_code=403, detail="Directory not allowed")
    
    project_root = get_project_root()
    base_path = project_root / ALLOWED_ROOTS[root_name]
    target_path = base_path / path
    
    # Security check
    if not is_safe_path(base_path, target_path):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(str(target_path))
    if not mime_type:
        mime_type = 'application/octet-stream'
    
    return FileResponse(
        path=str(target_path),
        media_type=mime_type,
        filename=target_path.name
    )

