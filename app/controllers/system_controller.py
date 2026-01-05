import platform
import psutil
from app.services.system_service import system_manager

class SystemController:
    def get_service_status(self):
        return {"enabled": system_manager.is_service_enabled(), "os": system_manager.os_type}
    
    def enable_service(self):
        return {"success": system_manager.enable_service()}
    
    def disable_service(self):
        return {"success": system_manager.disable_service()}
    
    def get_system_info(self):
        """Get system resources information"""
        # CPU info
        cpu_count = psutil.cpu_count()
        cpu_percent = psutil.cpu_percent(interval=0.5)
        
        # RAM info
        memory = psutil.virtual_memory()
        ram_total_mb = memory.total // (1024 * 1024)
        ram_used_mb = memory.used // (1024 * 1024)
        ram_available_mb = memory.available // (1024 * 1024)
        
        # Disk info - use correct path for Windows/Linux
        disk_path = 'C:\\' if platform.system() == 'Windows' else '/'
        disk = psutil.disk_usage(disk_path)
        disk_total_mb = disk.total // (1024 * 1024)
        disk_used_mb = disk.used // (1024 * 1024)
        disk_available_mb = disk.free // (1024 * 1024)
        
        # OS info
        os_name = platform.system()
        
        return {
            "os": os_name,
            "cpu_count": cpu_count,
            "cpu_percent": cpu_percent,
            "ram_total_mb": ram_total_mb,
            "ram_used_mb": ram_used_mb,
            "ram_available_mb": ram_available_mb,
            "disk_total_mb": disk_total_mb,
            "disk_used_mb": disk_used_mb,
            "disk_available_mb": disk_available_mb
        }

    def get_system_stats(self):
        """Get system stats for real-time monitoring"""
        import time
        import os
        
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Memory
            memory = psutil.virtual_memory()
            memory_used_mb = memory.used // (1024 * 1024)
            memory_total_mb = memory.total // (1024 * 1024)
            
            # Disk - use correct path for Windows/Linux
            disk_path = 'C:\\' if platform.system() == 'Windows' else '/'
            disk = psutil.disk_usage(disk_path)
            disk_percent = disk.percent
            
            # System uptime
            boot_time = psutil.boot_time()
            uptime_seconds = int(time.time() - boot_time)
            
            return {
                "cpu": round(cpu_percent, 1),
                "memory_used": memory_used_mb,
                "memory_total": memory_total_mb,
                "disk": round(disk_percent, 1),
                "uptime": uptime_seconds
            }
        except Exception as e:
            print(f"Error getting system stats: {e}")
            return {
                "cpu": 0,
                "memory_used": 0,
                "memory_total": 1,
                "disk": 0,
                "uptime": 0
            }
