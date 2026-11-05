from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from app.security import current_user
from app.db import list_groups
from app.http import day_payload, parse_iso_date
from app.catalog import split_teachers
from app.week import moscow_today
router=APIRouter(prefix='/api/teacher',tags=['teacher'])
@router.get('/schedule')
def own_schedule(date: str | None=None, days: int=Query(1,ge=1,le=7),user=Depends(current_user)):
    if user['role']!='teacher' or not user['teacher_name']: raise HTTPException(403,'нужна учётная запись преподавателя')
    start=parse_iso_date(date) if date else moscow_today()
    result=[]
    for offset in range(days):
        on=start+timedelta(days=offset)
        pairs=[]
        for group in list_groups():
            day=day_payload(group,on)
            pairs.extend({**p,'group':group} for p in day['pairs'] if user['teacher_name'].casefold() in {n.casefold() for n in split_teachers(p['teacher'])})
        result.append({'date':on.isoformat(),'pairs':sorted(pairs,key=lambda p:(p['pair'],p['group']))})
    return {'teacher':user['teacher_name'],'days':result}
