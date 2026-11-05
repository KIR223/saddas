import hashlib
import os
import secrets
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from app.accounts import hash_password, public_user, verify_password
from app.db import get_conn
from app.security import current_user

router = APIRouter(prefix='/api/auth', tags=['auth'])
DUMMY = hash_password(secrets.token_urlsafe(24))

class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)

@router.post('/login')
def login(body: LoginIn, response: Response):
    now = int(time.time())
    key = body.login.strip().casefold()
    with get_conn() as conn:
        conn.execute('BEGIN IMMEDIATE')
        attempt = conn.execute('SELECT * FROM login_attempts WHERE key=?', (key,)).fetchone()
        if attempt and attempt['locked_until'] > now:
            raise HTTPException(429, 'слишком много попыток; повторите через 5 минут')
        row = conn.execute('SELECT * FROM users WHERE login=?', (key,)).fetchone()
        valid = verify_password(body.password, row['password_hash'] if row else DUMMY)
        if not valid or not row or row['status'] != 'active':
            failures = (attempt['failures'] if attempt and attempt['locked_until'] == 0 else 0) + 1
            conn.execute('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)', (key, failures, now+300 if failures >= 5 else 0))
            conn.commit()
            raise HTTPException(401, 'неверный логин или пароль')
        conn.execute('DELETE FROM login_attempts WHERE key=?', (key,))
        conn.execute('DELETE FROM sessions WHERE expires_at<=?', (now,))
        token = secrets.token_urlsafe(32)
        conn.execute('INSERT INTO sessions VALUES(?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), row['id'], now+28800))
    response.set_cookie('schedule_session', token, httponly=True, secure=os.getenv('COOKIE_SECURE','true').lower() == 'true', samesite='lax', max_age=28800, path='/api')
    return public_user(row)

@router.get('/me')
def me(user=Depends(current_user)):
    return user

@router.post('/logout', status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get('schedule_session', '')
    with get_conn() as conn:
        conn.execute('DELETE FROM sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie('schedule_session', path='/api')
