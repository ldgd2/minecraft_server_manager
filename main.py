import sys
import asyncio

# Enforce ProactorEventLoop on Windows for subprocess support (works with reload)
# Must be set before any other asyncio usage or import that might init loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from sqlalchemy.orm import Session
from database.connection import engine, SessionLocal, get_db
from database.models.base import Base
from database.models.version import Version
from app.services.minecraft import server_service
from database.schemas import VersionResponse
from typing import List
from routes.auth import get_current_user
import uvicorn
import os

# Router Imports
# Router Imports
from routes import auth, servers, system, files, mods, worlds, audit, versions, players

app = FastAPI(title="Minecraft Server Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
os.makedirs("source/worlds", exist_ok=True)
os.makedirs("source/forge", exist_ok=True)
os.makedirs("source/fabric", exist_ok=True)
os.makedirs("source/paper", exist_ok=True)
os.makedirs("source/vanilla", exist_ok=True)
os.makedirs("servers", exist_ok=True)

# Mount Static Files
app.mount("/static", StaticFiles(directory="views/app"), name="static")
app.mount("/views/app", StaticFiles(directory="views/app"), name="views_app")
app.mount("/source", StaticFiles(directory="source"), name="source")
templates = Jinja2Templates(directory="views")

# Include API Routers
app.include_router(auth.router)
app.include_router(servers.router)
app.include_router(system.router)
app.include_router(files.router)
app.include_router(mods.router)
app.include_router(worlds.router)
app.include_router(audit.router)
app.include_router(mods.router)
app.include_router(versions.router)
app.include_router(players.router)

@app.on_event("startup")
async def startup_event():
    import sys
    import asyncio
    loop = asyncio.get_running_loop()
    print(f"DEBUG: Current Loop Type: {type(loop)}")
    print(f"DEBUG: Platform: {sys.platform}")
    
    # Verify WebSocket support
    try:
        import websockets
        print(f"✓ WebSockets library available: {websockets.__version__}")
    except ImportError:
        print("⚠ WARNING: WebSockets library not found - WebSocket endpoints may not work!")
    
    # Verify uvicorn WebSocket protocol
    try:
        from uvicorn.protocols.websockets.websockets_impl import WebSocketProtocol
        print(f"✓ Uvicorn WebSocket protocol loaded: {WebSocketProtocol.__name__}")
    except ImportError:
        print("⚠ WARNING: Uvicorn WebSocket protocol not loaded - using fallback")
    
    db = SessionLocal()
    try:
        server_service.load_servers_from_db(db)
    except Exception as e:
        print(f"Error loading servers: {e}")
    finally:
        db.close()

# Page Routes
@app.get("/")
def dashboard(request: Request):
    return templates.TemplateResponse("pages/os/desktop.html", {"request": request, "active_page": "dashboard"})

@app.get("/servers")
def servers_page(request: Request):
    return templates.TemplateResponse("pages/server/servers.html", {"request": request, "active_page": "servers", "hide_sidebar": True})

@app.get("/worlds")
def worlds_page(request: Request):
    return templates.TemplateResponse("pages/world/worlds.html", {"request": request, "active_page": "worlds", "hide_sidebar": True})

@app.get("/versions")
def versions_page(request: Request):
    return templates.TemplateResponse("pages/versions/versions.html", {"request": request, "active_page": "versions", "hide_sidebar": True})

@app.get("/audit")
def audit_page(request: Request):
    return templates.TemplateResponse("pages/audit/audit.html", {"request": request, "active_page": "audit", "hide_sidebar": True})

@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse("pages/auth/login.html", {"request": request, "hide_sidebar": True})

@app.get("/server/{name}")
def server_detail(request: Request, name: str):
    return templates.TemplateResponse("pages/server/server_detail.html", {"request": request, "server_name": name, "hide_sidebar": True})

@app.get("/server/{name}/plugins")
def server_plugins_page(request: Request, name: str):
    return templates.TemplateResponse("pages/mods/manager.html", {"request": request, "server_name": name, "hide_sidebar": True})

@app.get("/server/{name}/mods")
def server_mods_page(request: Request, name: str):
    return templates.TemplateResponse("pages/mods/mods.html", {"request": request, "server_name": name, "hide_sidebar": True})

@app.get("/modloaders")
def modloaders_page(request: Request):
    return templates.TemplateResponse("pages/mods/modloaders.html", {"request": request, "active_page": "modloaders", "hide_sidebar": True})

@app.get("/files")
def files_page(request: Request):
    return templates.TemplateResponse("pages/files/files.html", {"request": request, "active_page": "files", "hide_sidebar": True})

@app.get("/settings")
def settings_page(request: Request):
    return templates.TemplateResponse("pages/settings/settings.html", {"request": request, "active_page": "settings", "hide_sidebar": True})

@app.get("/apps/notepad")
def notepad_app(request: Request):
    return templates.TemplateResponse("pages/apps/notepad.html", {"request": request, "hide_sidebar": True})

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))

    # Force websockets implementation (cross-platform)
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        reload=False, 
        ws="websockets",
        log_level="info"
    )
