import sqlite3
import bcrypt
import os

db_path = "database/instance/minecraft_manager.db"

def verify_user_password():
    if not os.path.exists(db_path):
        print("Database not found")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get user 12345
    cursor.execute("SELECT username, hashed_password FROM users WHERE username = '12345'")
    row = cursor.fetchone()
    
    if not row:
        print("User 12345 not found")
        return

    username, stored_hash = row
    print(f"User: {username}")
    print(f"Stored Hash: {stored_hash}")
    
    try:
        # Check '1234'
        plain = "1234"
        is_valid = bcrypt.checkpw(plain.encode('utf-8'), stored_hash.encode('utf-8'))
        print(f"Verification for '{plain}': {is_valid}")
        
        # Check '12345' just in case
        plain2 = "12345"
        is_valid2 = bcrypt.checkpw(plain2.encode('utf-8'), stored_hash.encode('utf-8'))
        print(f"Verification for '{plain2}': {is_valid2}")

    except Exception as e:
        print(f"Error during verification: {e}")

    conn.close()

if __name__ == "__main__":
    verify_user_password()
