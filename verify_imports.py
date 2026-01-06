
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

try:
    print("Attempting to import database.models.players.player_stat...")
    from database.models.players.player_stat import PlayerStat
    print("Successfully imported PlayerStat")
except Exception as e:
    print(f"Error importing PlayerStat: {e}")
    import traceback
    traceback.print_exc()

try:
    print("Attempting to import database.models...")
    import database.models
    print("Successfully imported database.models")
except Exception as e:
    print(f"Error importing database.models: {e}")
    import traceback
    traceback.print_exc()
