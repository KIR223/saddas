from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db import get_conn
from app.security import require_admin
from app.schemas import DayScheduleIn
from app.http import require_group, require_pair
from app.parser import DAY_ORDER
from app.catalog import canonicalize_lesson_teacher, canonicalize_room, teacher_names, room_names
router=APIRouter(prefix='/api/admin/template',dependencies=[Depends(require_admin)],tags=['template'])
@router.get('')
def read(group: str,day: int=Query(1,ge=1,le=7),week: Literal['green','red']='green'):
    group=require_group(group)
    with get_conn() as c:
        rows=c.execute('SELECT pair,subject,teacher,room FROM lessons WHERE group_name=? AND day=? AND week=? ORDER BY pair,id',(group,DAY_ORDER[day-1],week)).fetchall()
    return {'group':group,'day':day,'week':week,'pairs':[dict(r) for r in rows]}
@router.put('')
def save(body: DayScheduleIn,group: str,day: int=Query(1,ge=1,le=7),week: Literal['green','red']='green'):
    group=require_group(group);seen=set();pairs=[]
    for item in body.pairs:
        require_pair(item.pair)
        if item.pair in seen: raise HTTPException(400,'номера пар повторяются')
        seen.add(item.pair)
        if not item.subject.strip(): continue
        pairs.append((group,DAY_ORDER[day-1],item.pair,week,item.subject.strip(),canonicalize_lesson_teacher(item.teacher),canonicalize_room(item.room)))
    with get_conn() as c:
        c.execute('DELETE FROM lessons WHERE group_name=? AND day=? AND week=?',(group,DAY_ORDER[day-1],week))
        c.executemany('INSERT INTO lessons(group_name,day,pair,week,subject,teacher,room) VALUES(?,?,?,?,?,?,?)',pairs)
        c.executemany('INSERT OR IGNORE INTO teachers(name) VALUES(?)',[(n,) for n in teacher_names(p[5] for p in pairs)])
        c.executemany('INSERT OR IGNORE INTO rooms(name) VALUES(?)',[(n,) for n in room_names(p[6] for p in pairs)])
    return read(group,day,week)
