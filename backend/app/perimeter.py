import os
import time
from fastapi import Request
from fastapi.responses import JSONResponse
from app.db import get_conn


def origins():
    return [v.strip().rstrip('/') for v in os.getenv('ALLOWED_ORIGINS','http://localhost:8080,http://127.0.0.1:8080').split(',') if v.strip()]


def validate_environment():
    if '*' in origins(): raise RuntimeError('ALLOWED_ORIGINS: wildcard forbidden')
    if os.getenv('APP_ENV','development')=='production':
        if not os.getenv('ALLOWED_ORIGINS') or any(not x.startswith('https://') for x in origins()):
            raise RuntimeError('production requires explicit HTTPS ALLOWED_ORIGINS')
        if os.getenv('ADMIN_TOKEN')=='dev' or os.getenv('BOOTSTRAP_ADMIN_PASSWORD','').lower() in ('dev','admin','password','changeme'):
            raise RuntimeError('default production credentials forbidden')
        if os.getenv('COOKIE_SECURE','true').lower()!='true': raise RuntimeError('production cookies must be Secure')


async def guard(request: Request, call_next):
    if request.url.path.startswith('/api/') and request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        if origin and origin.rstrip('/') not in origins(): return JSONResponse({'detail':'origin запрещён'},status_code=403)
    if request.url.path=='/api/auth/login' and request.method=='POST':
        # Trust socket peer, not user-controlled X-Forwarded-For. Configure trusted proxy at uvicorn.
        key='ip:'+(request.client.host if request.client else 'unknown')
        now=int(time.time())
        with get_conn() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT * FROM login_attempts WHERE key=?',(key,)).fetchone()
            if row and row['locked_until']>now:
                if row['failures']>=30: return JSONResponse({'detail':'слишком много запросов'},status_code=429,headers={'Retry-After':str(row['locked_until']-now)})
                c.execute('UPDATE login_attempts SET failures=failures+1 WHERE key=?',(key,))
            else: c.execute('INSERT OR REPLACE INTO login_attempts VALUES(?,1,?)',(key,now+300))
    from app.audit import context
    from app.security import current_user
    from fastapi import HTTPException
    token=None
    if request.url.path.startswith('/api/admin/') and request.method not in ('GET','HEAD','OPTIONS'):
        try:
            user=current_user(request)
            token=context.set((user['id'],user['login'],request.method,str(request.url.path)+'?'+str(request.url.query)))
        except HTTPException:
            pass
    try:
        return await call_next(request)
    finally:
        if token is not None: context.reset(token)
