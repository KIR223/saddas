import os
import secrets

from fastapi import Header, HTTPException


def tokens_match(got: str | None) -> bool:
    expected = os.environ.get("ADMIN_TOKEN", "dev")
    if not got or not expected:
        return False
    return secrets.compare_digest(got, expected)


def require_admin(
    x_admin_token: str | None = Header(default=None, description="Токен администратора"),
) -> None:
    if not tokens_match(x_admin_token):
        raise HTTPException(status_code=401, detail="неверный токен")
