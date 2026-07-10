from itsdangerous import BadSignature, URLSafeSerializer

from app.config import settings

_signer = URLSafeSerializer(settings.secret_key, salt="session")


def create_session_token(user_id: str) -> str:
    return _signer.dumps({"user_id": user_id})


def verify_session_token(token: str) -> str | None:
    try:
        data = _signer.loads(token)
        return data["user_id"]
    except BadSignature:
        return None
