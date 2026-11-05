from typing import Literal
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from app.db import get_conn
from app.catalog import canonicalize_teacher,canonicalize_room,split_teachers,room_names
from app.security import require_admin
router=APIRouter(prefix='/api/admin/catalog',dependencies=[Depends(require_admin)],tags=['catalog'])
class NameIn(BaseModel):
 name:str=Field(min_length=1,max_length=120)
def normalize(kind,name):
 value=canonicalize_teacher(name) if kind=='teachers' else canonicalize_room(name)
 if not value:raise HTTPException(400,'нужно имя')
 return value
@router.get('/{kind}')
def read(kind:Literal['teachers','rooms']):
 with get_conn() as c:return {kind:[r[0] for r in c.execute(f'SELECT name FROM {kind} ORDER BY name')]}
@router.post('/{kind}',status_code=201)
def create(kind:Literal['teachers','rooms'],body:NameIn):
 name=normalize(kind,body.name)
 with get_conn() as c:
  if c.execute(f'SELECT 1 FROM {kind} WHERE name=?',(name,)).fetchone():raise HTTPException(409,'уже есть')
  c.execute(f'INSERT INTO {kind}(name) VALUES(?)',(name,))
 return {'name':name}
@router.patch('/{kind}/{name}')
def rename(kind:Literal['teachers','rooms'],name:str,body:NameIn):
 new=normalize(kind,body.name);column='teacher' if kind=='teachers' else 'room'
 with get_conn() as c:
  if not c.execute(f'SELECT 1 FROM {kind} WHERE name=?',(name,)).fetchone():raise HTTPException(404,'не найдено')
  if new!=name and c.execute(f'SELECT 1 FROM {kind} WHERE name=?',(new,)).fetchone():raise HTTPException(409,'имя уже занято')
  c.execute(f'UPDATE {kind} SET name=? WHERE name=?',(new,name))
  for table in ('lessons','lesson_overrides'):
   for r in c.execute(f'SELECT rowid AS rid,{column} AS value FROM {table}').fetchall():
    parts=split_teachers(r['value']) if kind=='teachers' else room_names([r['value']])
    if name in parts:
     value=(' ' if kind=='teachers' else ', ').join(new if p==name else p for p in parts)
     c.execute(f'UPDATE {table} SET {column}=? WHERE rowid=?',(value,r['rid']))
 return {'name':new}
@router.delete('/{kind}/{name}',status_code=204)
def remove(kind:Literal['teachers','rooms'],name:str):
 column='teacher' if kind=='teachers' else 'room'
 with get_conn() as c:
  if kind=='teachers' and c.execute('SELECT 1 FROM users WHERE teacher_name=?',(name,)).fetchone():raise HTTPException(409,'преподаватель привязан к учётной записи')
  for table in ('lessons','lesson_overrides'):
   for row in c.execute(f'SELECT {column} FROM {table}'):
    parts=split_teachers(row[0]) if kind=='teachers' else room_names([row[0]])
    if name in parts:raise HTTPException(409,'используется в расписании или заменах')
  if not c.execute(f'DELETE FROM {kind} WHERE name=?',(name,)).rowcount:raise HTTPException(404,'не найдено')
