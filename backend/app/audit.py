from contextvars import ContextVar
from fastapi import APIRouter, Depends, Query
from app.security import require_admin
from app.db import get_conn
context=ContextVar('audit_context',default=None)
router=APIRouter(prefix='/api/admin/audit',dependencies=[Depends(require_admin)],tags=['audit'])
@router.get('')
def events(limit: int=Query(100,ge=1,le=500), before: int | None=None):
    with get_conn() as c:
        rows=c.execute('SELECT * FROM audit_events WHERE (? IS NULL OR id<?) ORDER BY id DESC LIMIT ?',(before,before,limit)).fetchall()
    return {'events':[dict(r) for r in rows]}
