import os
from fastapi import UploadFile
from app.services.minecraft import server_service
from app.services.file_service import file_service

class FileController:
    def list_files(self, server_name: str, path: str = "."):
        server = server_service.get_process(server_name)
        if not server:
            raise FileNotFoundError("Server not found")
        
        base_path = server.working_dir
        target_path = os.path.abspath(os.path.join(base_path, path))
        
        if not target_path.startswith(base_path):
            raise PermissionError("Access denied")
        
        if not os.path.exists(target_path):
             raise FileNotFoundError("Path not found")
            
        items = []
        for item in os.listdir(target_path):
            item_path = os.path.join(target_path, item)
            items.append({
                "name": item,
                "is_dir": os.path.isdir(item_path),
                "size": os.path.getsize(item_path) if not os.path.isdir(item_path) else 0
            })
        return items

    async def upload_file(self, server_name: str, path: str, file: UploadFile):
        server = server_service.get_process(server_name)
        if not server:
            raise FileNotFoundError("Server not found")

        base_path = server.working_dir
        target_dir = os.path.abspath(os.path.join(base_path, path))
        
        if not target_dir.startswith(base_path):
            raise PermissionError("Access denied")
            
        os.makedirs(target_dir, exist_ok=True)
        destination = os.path.join(target_dir, file.filename)
        
        await file_service.save_upload(file, destination)
        
        if file.filename.endswith(".zip"):
             file_service.extract_package(destination, target_dir)
        return True

    async def update_config(self, server_name: str, properties: dict):
        server = server_service.get_process(server_name)
        if not server:
            raise FileNotFoundError("Server not found")
        
        await file_service.write_properties(server.working_dir, properties)
        return True

    def _get_safe_path(self, server_name: str, path: str) -> str:
        server = server_service.get_process(server_name)
        if not server:
            raise FileNotFoundError("Server not found")
        
        base_path = server.working_dir
        full_path = os.path.abspath(os.path.join(base_path, path))
        
        if not full_path.startswith(base_path):
            raise PermissionError("Access denied")
        
        return full_path

    def get_content(self, server_name: str, path: str) -> str:
        full_path = self._get_safe_path(server_name, path)
        if not os.path.isfile(full_path):
             raise FileNotFoundError
             
        # Check size to prevent reading huge files
        if os.path.getsize(full_path) > 1024 * 1024: # 1MB limit
             raise ValueError("File too large to edit")
             
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    def save_content(self, server_name: str, path: str, content: str):
        full_path = self._get_safe_path(server_name, path)
        # Ensure directory exists? Usually editing existing file.
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
