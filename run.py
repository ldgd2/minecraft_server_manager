import sys
import asyncio
import uvicorn
import os

# 1. Enforce ProactorEventLoop on Windows BEFORE ANYTHING ELSE
# This is required for asyncio.create_subprocess_exec to work on Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

if __name__ == "__main__":
    # 2. Verify websockets library is available
    try:
        import websockets
        print(f"✓ WebSockets library loaded: {websockets.__version__}")
    except ImportError as e:
        print(f"ERROR: WebSockets library not available: {e}")
        print("Please run: pip install websockets")
        sys.exit(1)
    
    # 3. Run Uvicorn with explicit WebSocket configuration
    # Pass the app object directly to avoid import issues and subprocess spawning
    from main import app
    from dotenv import load_dotenv
    
    load_dotenv()
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    print(f"Starting Minecraft Server Manager on http://{host}:{port}")
    print(f"WebSocket endpoint: ws://{host}:{port}/api/servers/{{name}}/console")
    
    # Force uvicorn to use websockets implementation (cross-platform)
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        reload=False, 
        ws="websockets",  # Force websockets instead of auto-detection
        log_level="info"
    )
