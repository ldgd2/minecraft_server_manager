import sys
import os
import asyncio
from sqlalchemy.orm import Session

# Setup paths
sys.path.append(os.getcwd())

# Mock environment if needed
os.environ["DB_ENGINE"] = "sqlite"
# os.environ["DB_NAME"] = "minecraft_manager.db" # Default

try:
    print("1. Importing database connection...")
    from database.connection import SessionLocal, engine
    
    print("2. Importing service and controller...")
    from app.services.minecraft import server_service
    from app.controllers.server_controller import ServerController
    
    print("3. Initializing DB session...")
    db = SessionLocal()
    
    print("4. Loading servers from DB (simulating startup)...")
    try:
        server_service.load_servers_from_db(db)
        print("   Servers loaded successfully.")
    except Exception as e:
        print(f"   Error loading servers: {e}")
        import traceback
        traceback.print_exc()
        
    print("5. calling get_all_servers (simulating API request)...")
    controller = ServerController()
    try:
        servers = controller.get_all_servers(db)
        print(f"   Got {len(servers)} servers.")
        for s in servers:
            print(f"   - {s.name}: Status={s.status}")
    except Exception as e:
        print(f"   CRASH in get_all_servers: {e}")
        import traceback
        traceback.print_exc()

except Exception as e:
    print(f"CRASH at top level: {e}")
    import traceback
    traceback.print_exc()
finally:
    try:
        if 'db' in locals(): db.close()
    except: pass
