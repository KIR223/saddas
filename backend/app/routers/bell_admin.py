from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from app.schemas import BellSlotIn
from app.http import parse_bell_slots,parse_iso_date,TIME_RE,clock_minutes
from app.db import get_conn
from app.security import require_admin
from app.bell_config import configuration
router=APIRouter(prefix='/api/admin/bell-config',dependencies=[Depends(require_admin)],tags=['bells'])
class CuratorIn(BaseModel):
    day:int
    enabled:bool
    start:str
    end:str
    title:str=Field(min_length=1,max_length=120)
class ConfigIn(BaseModel):
    regular:list[BellSlotIn]
    monThu:list[BellSlotIn]
    thursday:list[BellSlotIn]
    shortDay:list[BellSlotIn]
    curators:list[CuratorIn]
    exceptions:dict[str,list[BellSlotIn]]=Field(default_factory=dict)
@router.get('')
def read(): return configuration()
@router.put('')
def save(body:ConfigIn):
    slots={k:parse_bell_slots(getattr(body,k)) for k in ('regular','monThu','thursday','shortDay')}
    dates={parse_iso_date(d).isoformat():parse_bell_slots(v) for d,v in body.exceptions.items()}
    seen=set()
    for s in body.curators:
        if s.day not in (1,4) or s.day in seen:raise HTTPException(400,'куратор: день 1 или 4, без повторов')
        seen.add(s.day)
        if not TIME_RE.fullmatch(s.start) or not TIME_RE.fullmatch(s.end) or clock_minutes(s.end)<=clock_minutes(s.start):raise HTTPException(400,'некорректное время куратора')
        if s.enabled:
            for _,a,b in slots['monThu' if s.day==1 else 'thursday']:
                if max(clock_minutes(a),clock_minutes(s.start))<min(clock_minutes(b),clock_minutes(s.end)):raise HTTPException(400,'куратор пересекается с парой')
    with get_conn() as c:
        c.execute('DELETE FROM bell_regular');c.executemany('INSERT INTO bell_regular VALUES(?,?,?)',slots['regular'])
        c.execute('DELETE FROM bell_profiles')
        for k in ('monThu','thursday','shortDay'):c.executemany('INSERT INTO bell_profiles VALUES(?,?,?,?)',[(k,*s) for s in slots[k]])
        c.execute('DELETE FROM curator_slots');c.executemany('INSERT INTO curator_slots VALUES(?,?,?,?,?)',[(s.day,int(s.enabled),s.start,s.end,s.title) for s in body.curators])
        c.execute('DELETE FROM bell_short_days');c.execute('DELETE FROM bell_short_dates')
        for d,rows in dates.items():
            c.execute('INSERT INTO bell_short_dates VALUES(?)',(d,));c.executemany('INSERT INTO bell_short_days VALUES(?,?,?,?)',[(d,*s) for s in rows])
    return configuration()
