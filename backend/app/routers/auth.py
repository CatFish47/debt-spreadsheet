from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.auth import create_session_token

router = APIRouter()

_COOKIE_MAX_AGE = settings.session_expire_days * 86400


@router.get("/login")
def login(key: str, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.personal_key == key).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid key")

    token = create_session_token(str(user.id))
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        max_age=_COOKIE_MAX_AGE,
        samesite="lax",
        secure=settings.app_url.startswith("https"),
    )
    return {"id": str(user.id), "name": user.name}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("session")
    return {"message": "Logged out"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": str(current_user.id), "name": current_user.name}
