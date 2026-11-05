import sqlite3
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.accounts import create_user, hash_password, public_user
from app.db import get_conn
from app.security import require_admin
router=APIRouter(prefix='/api/admin/users',tags=['users'],dependencies=[Depends(require_admin)])
class UserIn(BaseModel):
    login: str = Field(min_length=1,max_length=80)
    password: str = Field(min_length=12,max_length=256)
    role: Literal['admin','teacher']='teacher'
    teacher_name: str | None=None
class UserPatch(BaseModel):
    status: Literal['active','disabled'] | None=None
    password: str | None=Field(default=None,min_length=12,max_length=256)
    teacher_name: str | None=None

@router.get('')
def users():
    with get_conn() as c: return {'users':[public_user(r) for r in c.execute('SELECT * FROM users ORDER BY login')]}
@router.post('',status_code=201)
def add_user(body: UserIn):
    try: return create_user(**body.model_dump())
    except (ValueError,sqlite3.IntegrityError) as e: raise HTTPException(400,'логин занят или неверная привязка / пароль') from e
@router.patch('/{user_id}')
def patch_user(user_id: int,body: UserPatch,actor=Depends(require_admin)):
    with get_conn() as c:
        c.execute('BEGIN IMMEDIATE')
        row=c.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone()
        if not row: raise HTTPException(404,'пользователь не найден')
        if body.status=='disabled' and row['role']=='admin' and row['status']=='active':
            if c.execute("SELECT count(*) FROM users WHERE role='admin' AND status='active'").fetchone()[0]<=1:
                raise HTTPException(400,'нельзя отключить последнего администратора')
        if 'teacher_name' in body.model_fields_set:
            if row['role']=='teacher' and not body.teacher_name: raise HTTPException(400,'нужен преподаватель')
            if body.teacher_name and not c.execute('SELECT 1 FROM teachers WHERE name=?',(body.teacher_name,)).fetchone(): raise HTTPException(400,'преподаватель не найден')
            c.execute('UPDATE users SET teacher_name=? WHERE id=?',(body.teacher_name,user_id))
        if body.status: c.execute('UPDATE users SET status=? WHERE id=?',(body.status,user_id))
        if body.password: c.execute('UPDATE users SET password_hash=? WHERE id=?',(hash_password(body.password),user_id))
        if body.password or body.status=='disabled': c.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
        return public_user(c.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone())
