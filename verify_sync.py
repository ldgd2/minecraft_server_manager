import sys
import os
import logging
from sqlalchemy.orm import Session
from datetime import datetime

# Setup path
sys.path.append(os.getcwd())

# Import our app code
try:
    from database.connection import get_db, engine
    from app.services.masterbridge_sync_service import MasterBridgeSyncService
    from database.models.players.player_detail import PlayerDetail
    from database.models.server import Server
except ImportError as e:
    print(f"Import Error: {e}")
    sys.path.append(os.path.join(os.getcwd(), 'app'))
    from database.connection import get_db, engine
    from app.services.masterbridge_sync_service import MasterBridgeSyncService
    from database.models.players.player_detail import PlayerDetail

# Setup logging
logging.basicConfig(level=logging.INFO)

def verify_sync():
    print("Verifying Sync Service logic...")
    db = next(get_db())
    try:
        # Create a dummy server if not exists
        server = db.query(Server).filter_by(name="verify_test").first()
        if not server:
            server = Server(name="verify_test", port=25565, version="1.20", ram_allocation=1024)
            db.add(server)
            db.commit()
            print(f"Created temp server id={server.id}")
        
        server_id = server.id
        
        # Dummy player data simulating MasterBridge response
        dummy_players = [
            {
                "name": "VerifyBot",
                "uuid": "00000000-0000-0000-0000-000000000001",
                "dimension": "minecraft:the_end",
                "pos": "100, 64, 100",
                "health": 20.0,
                "xp_level": 5,
                "position_x": 100,
                "position_y": 64,
                "position_z": 100
            }
        ]
        
        print("Attempting to sync dummy player...")
        MasterBridgeSyncService.sync_players(db, server_id, dummy_players)
        print("Sync called successfully.")
        
        # Verify DB content
        detail = db.query(PlayerDetail).filter_by(player_uuid="00000000-0000-0000-0000-000000000001").first()
        if detail:
            print(f"PlayerDetail found. Health column value: {getattr(detail, 'health', 'MISSING')}")
            if hasattr(detail, 'health'):
                print("SUCCESS: 'health' column is accessible via ORM.")
            else:
                print("FAILURE: 'health' column missing in ORM model?")
        else:
            print("FAILURE: PlayerDetail not found after sync.")
            
    except Exception as e:
        print(f"CRITICAL ERROR during sync: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify_sync()
