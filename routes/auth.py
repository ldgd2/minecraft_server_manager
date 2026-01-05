from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models.user import User
from app.controllers.auth_controller import AuthController
from database.schemas import Token, UserLogin
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer
from app.services.auth_service import verify_password, create_access_token, get_password_hash # Keep utils internal or move to controller if strict
from app.services.audit_service import AuditService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

router = APIRouter(prefix="/auth", tags=["Auth"])
auth_controller = AuthController()

class RegisterRequest(BaseModel):
    username: str
    password: str

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Simple JWT decode (logic could be in controller/service)
    # For now reusing this as a dependency
    from jose import JWTError, jwt
    from app.services.auth_service import SECRET_KEY, ALGORITHM
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = auth_controller.get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    return user

@router.post("/login", response_model=Token)
def login(user_data: UserLogin, request: Request, db: Session = Depends(get_db)):
    print(f"DEBUG: Login endpoint hit. Username: {repr(user_data.username)}, Password len: {len(user_data.password)}")
    # Logic moved to controller? 
    # Controller.login returns token or None
    token = auth_controller.login(db, user_data.username, user_data.password)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Log successful login
    user = auth_controller.get_user_by_username(db, user_data.username)
    if user:
        AuditService.log_action(db, user, "LOGIN", request.client.host, "User logged in")
        
    return {"access_token": token, "token_type": "bearer"}

@router.post("/register")
def register(user_data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    # Move register logic to controller completely?
    # Yes
    
    # Check if exists (Controller check)
    if auth_controller.get_user_by_username(db, user_data.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create
    hashed = get_password_hash(user_data.password)
    user = User(username=user_data.username, hashed_password=hashed)
    db.add(user)
    db.commit()
    
    AuditService.log_action(db, user, "REGISTER", request.client.host, f"Registered user {user.username}")
    
    return {"message": "User created successfully"}
