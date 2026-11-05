from datetime import date
from app.db import get_conn, get_regular_bells, get_short_bells

def configuration():
    cfg={'regular':get_regular_bells()}
    with get_conn() as c:
        for kind in ('monThu','thursday','shortDay'):
            cfg[kind]=[{'pair':r['pair'],'start':r['start_time'],'end':r['end_time']} for r in c.execute('SELECT * FROM bell_profiles WHERE kind=? ORDER BY pair',(kind,))]
        cfg['curators']=[{'day':r['day'],'enabled':bool(r['enabled']),'start':r['start_time'],'end':r['end_time'],'title':r['title']} for r in c.execute('SELECT * FROM curator_slots ORDER BY day')]
        dates=[r[0] for r in c.execute('SELECT on_date FROM bell_short_dates ORDER BY on_date')]
    cfg['exceptions']={d:get_short_bells(d) for d in dates}
    return cfg

def for_date(on: date):
    cfg=configuration();key=on.isoformat()
    kind='short' if key in cfg['exceptions'] else {1:'monThu',4:'thursday'}.get(on.isoweekday(),'regular')
    pairs=cfg['exceptions'][key] if kind=='short' else cfg[kind]
    curator=next((s for s in cfg['curators'] if s['day']==on.isoweekday() and s['enabled']),None) if kind!='short' else None
    return {'kind':kind,'date':key,'pairs':pairs,'curator':curator}
