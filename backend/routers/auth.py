from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginRequest, LoginResponse, CurrentUserRead
from services.auth import verify_password, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/verify-credentials", response_model=LoginResponse)
def verify_credentials(payload: LoginRequest, db: Session = Depends(get_db)):
    """Called server-side by Auth.js's credentials provider on every login
    attempt — never called directly by a browser. Checks email+password
    against the users table and returns the user's public fields on
    success. Returns 401 for both an unknown email and a wrong password
    (rather than distinguishing the two), so a login attempt can't be
    used to discover which emails have accounts."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return LoginResponse(id=user.id, email=user.email, name=user.name, is_admin=user.is_admin)


@router.get("/me", response_model=CurrentUserRead)
def get_me(user: User = Depends(get_current_user)):
    """A quick way for the frontend (or a curl check) to confirm a session
    token is valid and see who it belongs to."""
    return CurrentUserRead(id=user.id, email=user.email, name=user.name, is_admin=user.is_admin)
