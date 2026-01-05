from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_db
from app.controllers.server_controller import ServerController
from app.services.audit_service import AuditService
from database.schemas import ServerCreate, ServerUpdate, ServerResponse, ServerStats, ModSearchConnect
from database.models.user import User
from routes.auth import get_current_user

router = APIRouter(prefix="/api/servers", tags=["Servers"])
server_controller = ServerController()

@router.get("/", response_model=List[ServerResponse])
def list_servers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return server_controller.get_all_servers(db)

@router.post("/", response_model=ServerResponse)
def create_server(server_data: ServerCreate, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        server = server_controller.create_server(
            db, 
            server_data.name, 
            server_data.version, 
            server_data.ram_mb, 
            server_data.port,
            server_data.online_mode,
            mod_loader=server_data.mod_loader,
            cpu_cores=server_data.cpu_cores,
            disk_mb=server_data.disk_mb,
            max_players=server_data.max_players,
            motd=server_data.motd
        )
        AuditService.log_action(db, current_user, "CREATE_SERVER", request.client.host, f"Created server {server.name}")
        return server
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{name}", response_model=ServerResponse)
def update_server(name: str, server_data: ServerUpdate, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = server_data.dict(exclude_unset=True)
    server = server_controller.update_server(db, name, data)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    AuditService.log_action(db, current_user, "UPDATE_SERVER", request.client.host, f"Updated server {name} with {data}")
    return server

@router.delete("/{name}")
def delete_server(name: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    server_controller.delete_server(db, name)
    AuditService.log_action(db, current_user, "DELETE_SERVER", request.client.host, f"Deleted server {name}")
    return {"message": "Server deleted"}

@router.post("/{name}/control/{action}")
async def control_server(name: str, action: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if action == "start":
        res = await server_controller.start_server(name)
    elif action == "stop":
        res = await server_controller.stop_server(name)
    elif action == "kill":
        res = server_controller.kill_server(name)
    elif action == "restart":
        res = await server_controller.restart_server(name)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    if not res:
         raise HTTPException(status_code=404, detail="Server not found or operation failed")
    
    AuditService.log_action(db, current_user, f"{action.upper()}_SERVER", request.client.host, f"Action {action} on {name}")
    return {"message": f"Action {action} executed"}

@router.get("/{name}/stats", response_model=ServerStats)
def get_server_stats(name: str, current_user: User = Depends(get_current_user)):
    return server_controller.get_server_stats(name)

@router.post("/{name}/command")
async def send_command(name: str, command: dict, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cmd_text = command.get("command")
    if cmd_text:
        await server_controller.send_command(name, cmd_text)
        AuditService.log_action(db, current_user, "SEND_COMMAND", request.client.host, f"Sent command to {name}: {cmd_text}")
    return {"message": "Command sent"}

@router.websocket("/{name}/console")
async def websocket_endpoint(websocket: WebSocket, name: str):
    await websocket.accept()
    queue = server_controller.get_console_queue(name)
    
    if not queue:
        await websocket.close(code=4004, reason="Server not found")
        return
    
    try:
        while True:
            log_line = await queue.get()
            await websocket.send_text(log_line)
    except WebSocketDisconnect:
        pass

@router.get("/{name}/export")
async def export_server(name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Export a server as a ZIP file"""
    try:
        zip_path = await server_controller.export_server(db, name)
        return FileResponse(
            path=zip_path,
            filename=f"{name}.zip",
            media_type="application/zip",
            background=None  # File will be cleaned up by the controller
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Server not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.post("/import")
async def import_server(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import a server from a ZIP file"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="File must be a ZIP archive")
    
    try:
        server = await server_controller.import_server(db, file)
        return {"message": f"Server '{server.name}' imported successfully", "server": server}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# --- Player Management Endpoints ---
@router.get("/{name}/players")
def get_players_data(name: str, current_user: User = Depends(get_current_user)):
    """Get complete player data: online players, banned users, and banned IPs"""
    try:
        online_players = server_controller.get_online_players(name)
        print(f"DEBUG: API get_players for {name}: {online_players}")
        bans = server_controller.get_bans(name)
        recent = server_controller.get_recent_activity(name)
        
        return {
            "online_players": online_players if online_players else [],
            "banned_users": bans.get("players", []) if bans else [],
            "banned_ips": bans.get("ips", []) if bans else [],
            "recent_activity": recent
        }
    except Exception as e:
        print(f"ERROR: API get_players failed: {e}")
        # Return empty data instead of error to prevent frontend spam
        return {
            "online_players": [],
            "banned_users": [],
            "banned_ips": [],
            "recent_activity": []
        }



@router.post("/{name}/players/{username}/kick")
async def kick_player(name: str, username: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Kick a player from the server"""
    try:
        success = await server_controller.kick_player(name, username)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to kick player")
        AuditService.log_action(db, current_user, "KICK_PLAYER", request.client.host, f"Kicked {username} from {name}")
        return {"message": f"Player {username} kicked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/players/{username}/ban")
async def ban_player(
    name: str, 
    username: str,
    ban_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ban a player by username, IP, or both"""
    mode = ban_data.get("mode", "username")  # "username", "ip", "both"
    reason = ban_data.get("reason", "Banned by admin")
    expires = ban_data.get("expires", "forever") # New field
    
    try:
        if mode == "username":
            success = await server_controller.ban_user(name, username, reason, expires)
        elif mode == "ip":
            # Get player's IP first
            players = server_controller.get_online_players(name)
            player = next((p for p in players if p.get("username") == username), None)
            if player and player.get("ip"):
                success = await server_controller.ban_ip(name, player["ip"], reason, username=username)
            else:
                raise HTTPException(status_code=400, detail="Player IP not found")
        elif mode == "both":
            # Ban both username and IP
            success1 = await server_controller.ban_user(name, username, reason, expires)
            players = server_controller.get_online_players(name)
            player = next((p for p in players if p.get("username") == username), None)
            if player and player.get("ip"):
                success2 = await server_controller.ban_ip(name, player["ip"], reason, username=username)
                success = success1 and success2
            else:
                success = success1
        else:
            raise HTTPException(status_code=400, detail="Invalid ban mode")
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to ban")
        AuditService.log_action(db, current_user, "BAN_PLAYER", request.client.host, f"Banned {username} from {name} mode={mode} reason={reason}")
        return {"message": f"Player {username} banned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{name}/banned-players/{username}")
async def update_ban(
    name: str, 
    username: str, 
    ban_data: dict, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update existing ban details"""
    reason = ban_data.get("reason")
    expires = ban_data.get("expires")
    
    try:
        success = await server_controller.update_ban(name, username, reason, expires)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update ban")
        AuditService.log_action(db, current_user, "UPDATE_BAN", request.client.host, f"Updated ban for {username} in {name}")
        return {"message": f"Ban updated for {username}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/players/{username}/unban")
async def unban_user(name: str, username: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Unban a user"""
    try:
        success = await server_controller.unban_user(name, username)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to unban user")
        AuditService.log_action(db, current_user, "UNBAN_USER", request.client.host, f"Unbanned {username} from {name}")
        return {"message": f"User {username} unbanned"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/players/ip/{ip}/unban")
async def unban_ip(name: str, ip: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Unban an IP address"""
    try:
        success = await server_controller.unban_ip(name, ip)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to unban IP")
        AuditService.log_action(db, current_user, "UNBAN_IP", request.client.host, f"Unbanned IP {ip} from {name}")
        return {"message": f"IP {ip} unbanned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/players/{username}/op")
async def op_player(name: str, username: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        success = await server_controller.op_player(name, username)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to op player")
        AuditService.log_action(db, current_user, "OP_PLAYER", request.client.host, f"Opped {username} on {name}")
        return {"message": f"Player {username} opped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/players/{username}/deop")
async def deop_player(name: str, username: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        success = await server_controller.deop_player(name, username)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to deop player")
        AuditService.log_action(db, current_user, "DEOP_PLAYER", request.client.host, f"De-opped {username} on {name}")
        return {"message": f"Player {username} de-opped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
