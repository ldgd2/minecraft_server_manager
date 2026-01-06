from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Server
from database.models.players.player import Player
from database.models.players.player_detail import PlayerDetail
from database.models.players.player_stat import PlayerStat
from database.models.players.player_ban import PlayerBan
from database.models.players.player_achievement import PlayerAchievement
from app.services.minecraft import server_service
import datetime

router = APIRouter(prefix="/api/players", tags=["players"])

def get_server_by_name(db: Session, name: str):
    server = db.query(Server).filter(Server.name == name).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server

@router.get("/{server_name}")
def get_players(server_name: str, db: Session = Depends(get_db)):
    """Get all players for a server (Online + History)"""
    server = get_server_by_name(db, server_name)
    
    # Get Online Players from Service
    process = server_service.get_process(server_name)
    online_players = []
    if process:
        online_players = process.get_online_players() # [{username, ip, joined_at, uuid}]
        
    # Get All Players from DB
    db_players = db.query(Player).filter(Player.server_id == server.id).all()
    
    # Merge Data
    result = []
    
    # Helper to find online status
    online_map = {p['username']: p for p in online_players}
    
    for p in db_players:
        is_online = p.name in online_map
        online_info = online_map.get(p.name, {})
        
        # Details
        detail = p.detail
        last_played = detail.last_joined_at if detail else None
        
        # Format total playtime
        playtime_seconds = detail.total_playtime_seconds if detail and detail.total_playtime_seconds else 0
        hours = playtime_seconds // 3600
        minutes = (playtime_seconds % 3600) // 60
        seconds = playtime_seconds % 60
        playtime_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        
        result.append({
            "uuid": p.uuid,
            "name": p.name,
            "is_online": is_online,
            "last_played": last_played,
            "total_playtime": playtime_str,
            "ip": detail.last_ip if detail else None, # Maybe hide IP for regular users?
            "avatar_url": f"https://minotar.net/avatar/{p.name}/64.png" # External API for avatars
        })
        
    # Sort: Online first, then by last_played
    result.sort(key=lambda x: (not x['is_online'], x['last_played'] or datetime.datetime.min), reverse=True)
    
    return {
        "server": server_name,
        "online_count": len(online_players),
        "total_unique": len(result),
        "players": result
    }

@router.get("/{server_name}/{uuid}")
def get_player_details(server_name: str, uuid: str, db: Session = Depends(get_db)):
    """Get detailed stats for a player"""
    server = get_server_by_name(db, server_name)
    
    player = db.query(Player).filter(Player.server_id == server.id, Player.uuid == uuid).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    detail = player.detail
    stats = player.stats
    achievements = player.achievements
    bans = player.bans
    
    # Calculate Playtime
    playtime_seconds = detail.total_playtime_seconds if detail and detail.total_playtime_seconds else 0
    
    return {
        "info": {
            "uuid": player.uuid,
            "name": player.name,
            "first_seen": player.created_at,
            "last_seen": detail.last_joined_at if detail else None,
            "playtime_seconds": playtime_seconds,
            "last_ip": detail.last_ip if detail else None
        },
        "stats": {s.stat_key: s.stat_value for s in stats},
        "achievements": [
            {"id": a.achievement_id, "name": a.name, "desc": a.description, "date": a.unlocked_at} 
            for a in achievements
        ],
        "bans": [
            {"active": b.is_active, "reason": b.reason, "source": b.source, "issued": b.issued_at, "expires": b.expires_at}
            for b in bans
        ]
    }
