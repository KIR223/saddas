import hashlib
import time
from fastapi import Depends, HTTPException, Request
from app.db import get_conn
from app.accounts import public_user


def current_user(request: Request):
    token = request.cookies.get('schedule_session', '')
    with get_conn() as conn:
        row = conn.execute('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.status=?',
                           (hashlib.sha256(token.encode()).hexdigest(), int(time.time()), 'active')).fetchone()
    if row is None:
        raise HTTPException(401, 'требуется вход')
    return public_user(row)


def require_admin(user=Depends(current_user)):
    if user['role'] != 'admin':
        raise HTTPException(403, 'нужна роль admin')
    return user
