import sys
import os
from sqlalchemy import text

# Add project root to sys.path
sys.path.append(os.getcwd())

from database.connection import get_db, engine

def verify():
    print("Verifying database schema for 'servers' table...")
    
    try:
        db = next(get_db())
        
        # Check columns via SQL
        print("Checking 'servers' table columns...")
        result = db.execute(text("PRAGMA table_info(servers)"))
        columns = [row[1] for row in result]
        print(f"Columns in servers: {columns}")
        
        if 'masterbridge_config' in columns:
            print("SUCCESS: 'masterbridge_config' column found.")
        else:
            print("FAILURE: 'masterbridge_config' column NOT found.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    verify()
