from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.db.models import Team

# JWT bearer scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    """Hash a password."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    # Ensure 'sub' is a string (JWT standard requires it)
    if "sub" in to_encode and not isinstance(to_encode["sub"], str):
        to_encode["sub"] = str(to_encode["sub"])
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        logger.debug(f"Token decoded successfully. Payload: {payload}")
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_team(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Team:
    """Get current authenticated team from JWT token."""
    token = credentials.credentials
    logger.debug(f"Attempting to decode token: {token[:50]}...")
    
    try:
        payload = decode_token(token)
        logger.debug(f"Token decoded successfully. Payload: {payload}")
    except HTTPException as e:
        logger.error(f"Token decode failed: {e.detail}")
        raise
    
    team_id_str = payload.get("sub")
    if team_id_str is None:
        logger.error("No 'sub' claim in token payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    # Convert string back to integer
    try:
        team_id = int(team_id_str)
    except (ValueError, TypeError):
        logger.error(f"Invalid team_id in token: {team_id_str}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    logger.debug(f"Looking up team with ID: {team_id}")
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        logger.error(f"Team with ID {team_id} not found in database")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Team not found"
        )
    
    logger.info(f"Authenticated team: {team.name} (ID: {team.id}, is_admin: {team.is_admin})")
    return team


async def get_current_admin(
    current_team: Team = Depends(get_current_team)
) -> Team:
    """Verify that current team is an admin."""
    if not current_team.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_team
