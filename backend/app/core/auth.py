import base64
import hashlib
import hmac
import json

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)


def _b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _verify_hs256(token: str, secret: str) -> dict:
    """Minimal HS256 JWT verification using stdlib only."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("malformed token")

    header_b64, payload_b64, sig_b64 = parts

    # Verify signature
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_sig = hmac.new(
        secret.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    actual_sig = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("invalid signature")

    # Decode payload
    payload = json.loads(_b64url_decode(payload_b64).decode())
    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict | None:
    """
    Returns {user_id, email} from a valid Supabase JWT.
    Returns None when SUPABASE_JWT_SECRET is not set (dev mode — no auth enforced).
    Raises 401 when secret is set but token is missing or invalid.
    """
    if not settings.SUPABASE_JWT_SECRET:
        return None  # dev mode — auth disabled

    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = _verify_hs256(credentials.credentials, settings.SUPABASE_JWT_SECRET)
        user_id: str = payload.get("sub", "")
        email: str = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user_id": user_id, "email": email}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
