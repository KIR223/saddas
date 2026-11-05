from datetime import timedelta
from typing import Literal
from fastapi import APIRouter,Depends,HTTPException,Query
from pydantic import BaseModel,Field
from app.db import get_conn
from app.http import require_group,parse_iso_date
from app.week import moscow_today
from app.catalog import canonicalize_lesson_teacher,canonicalize_room
from app.security import require_admin
router=APIRouter(prefix='/api/admin/overrides',dependencies=[Depends(require_admin)],tags=['overrides'])
class BulkIn(BaseModel):
 group:str
 pair:int=Field(ge=1,le=12)
 weekday:int | None=Field(default=None,ge=1,le=7)
 date_from:str | None=None
 date_to:str | None=None
 operation:Literal['set','remove']='set'
 cancelled:bool=False
 subject:str=Field(default='',max_length=500)
 teacher:str=Field(default='',max_length=500)
 room:str=Field(default='',max_length=120)

def expand(body):
 start=parse_iso_date(body.date_from) if body.date_from else moscow_today()
 if body.date_to:
  end=parse_iso_date(body.date_to)
  if end<start or (end-start).days>=120:raise HTTPException(400,'диапазон: от 1 до 120 дней')
 elif body.date_from: end=start
 else:
  weekday=body.weekday or start.isoweekday()
  start+=timedelta(days=(weekday-start.isoweekday())%7)
  return [(start+timedelta(weeks=i)).isoformat() for i in range(16)]
 dates=[(start+timedelta(days=i)) for i in range((end-start).days+1)]
 out=[d.isoformat() for d in dates if body.weekday is None or d.isoweekday()==body.weekday]
 if not out:raise HTTPException(400,'в диапазоне нет выбранного дня недели')
 return out
@router.post('/bulk')
def apply(body:BulkIn):
 group=require_group(body.group);dates=expand(body)
 if body.operation=='set' and not body.cancelled and not body.subject.strip():raise HTTPException(400,'нужен предмет')
 with get_conn() as c:
  c.execute('BEGIN IMMEDIATE')
  if body.operation=='remove':c.executemany('DELETE FROM lesson_overrides WHERE group_name=? AND on_date=? AND pair=?',[(group,d,body.pair) for d in dates])
  else:c.executemany('INSERT INTO lesson_overrides(on_date,group_name,pair,cancelled,subject,teacher,room) VALUES(?,?,?,?,?,?,?) ON CONFLICT(on_date,group_name,pair) DO UPDATE SET cancelled=excluded.cancelled,subject=excluded.subject,teacher=excluded.teacher,room=excluded.room',[(d,group,body.pair,int(body.cancelled),'' if body.cancelled else body.subject.strip(),'' if body.cancelled else canonicalize_lesson_teacher(body.teacher),'' if body.cancelled else canonicalize_room(body.room)) for d in dates])
 return {'dates':dates,'count':len(dates),'operation':body.operation,'errors':[]}
@router.get('')
def read(group:str | None=None,date_from:str | None=None,date_to:str | None=None,limit:int=Query(500,ge=1,le=2000)):
 if date_from:parse_iso_date(date_from)
 if date_to:parse_iso_date(date_to)
 with get_conn() as c:
  rows=c.execute('SELECT * FROM lesson_overrides WHERE (? IS NULL OR group_name=?) AND (? IS NULL OR on_date>=?) AND (? IS NULL OR on_date<=?) ORDER BY on_date,group_name,pair LIMIT ?',(group,group,date_from,date_from,date_to,date_to,limit)).fetchall()
 return {'overrides':[dict(r) for r in rows]}
