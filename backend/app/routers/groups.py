from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.db import get_conn
from app.security import require_admin
router=APIRouter(prefix='/api/admin/groups',dependencies=[Depends(require_admin)],tags=['groups'])
class GroupIn(BaseModel):
    code: str=Field(min_length=1,max_length=80)
class GroupPatch(BaseModel):
    active: bool
@router.get('')
def groups():
    with get_conn() as c: return {'groups':[dict(r) for r in c.execute('SELECT * FROM groups ORDER BY code')]}
@router.post('',status_code=201)
def create(body: GroupIn):
    code=body.code.strip()
    if not code: raise HTTPException(400,'нужен код группы')
    with get_conn() as c:
        if c.execute('SELECT 1 FROM groups WHERE code=?',(code,)).fetchone(): raise HTTPException(409,'группа уже есть')
        c.execute('INSERT INTO groups(code) VALUES(?)',(code,))
    return {'code':code,'active':True}
@router.patch('/{code}')
def update(code: str,body: GroupPatch):
    with get_conn() as c:
        if not c.execute('UPDATE groups SET active=? WHERE code=?',(int(body.active),code)).rowcount: raise HTTPException(404,'группа не найдена')
    return {'code':code,'active':body.active}
@router.delete('/{code}',status_code=204)
def delete(code: str):
    with get_conn() as c:
        if c.execute('SELECT 1 FROM lessons WHERE group_name=? UNION SELECT 1 FROM lesson_overrides WHERE group_name=?',(code,code)).fetchone(): raise HTTPException(409,'есть пары или замены: архивируйте группу')
        if not c.execute('DELETE FROM groups WHERE code=?',(code,)).rowcount: raise HTTPException(404,'группа не найдена')
