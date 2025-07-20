from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import verify_password, get_password_hash, create_simple_session
from ...models.user import User
from ...schemas.user import UserCreate, UserLogin, UserSession, User as UserSchema

router = APIRouter()


@router.post("/register", response_model=UserSchema)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.post("/login", response_model=UserSession)
def login(user_credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    """Login user with simple session."""
    # Find user
    user = db.query(User).filter(User.email == user_credentials.email).first()
    
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create simple session
    session_token = create_simple_session(user.id)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=86400,  # 24 hours
        samesite="lax"
    )
    
    return UserSession(user=user, session_token=session_token)


@router.post("/logout")
def logout(response: Response):
    """Logout user by clearing session cookie."""
    response.delete_cookie(key="session_token")
    return {"message": "Successfully logged out"}
