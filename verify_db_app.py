import sys
import os
from sqlalchemy import text

# Add project root to sys.path
sys.path.append(os.getcwd())

from database.connection import get_db, engine
from database.models.players.player_detail import PlayerDetail

def verify():
    print("Verifying database connection...")
    print(f"Engine URL: {engine.url}")
    
    try:
        db = next(get_db())
        print("Connection successful.")
        
        print("Checking PlayerDetail schema...")
        # Check columns via SQL
        result = db.execute(text("PRAGMA table_info(player_details)"))
        columns = [row[1] for row in result]
        print(f"Columns in player_details: {columns}")
        
        if 'health' in columns:
            print("SUCCESS: 'health' column found.")
        else:
            print("FAILURE: 'health' column NOT found.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    verify()
