from fastapi import APIRouter, Query

from app.db import get_regular_bells, get_short_bells
from app.http import bells_payload, parse_iso_date
from app.schemas import BellsOut

router = APIRouter(tags=["bells"])


@router.get("/api/bells", response_model=BellsOut)
def bells(date_value: str | None = Query(default=None, alias="date", description="YYYY-MM-DD")):
    if date_value is None:
        return bells_payload("regular", get_regular_bells())
    from app.bell_config import for_date
    return for_date(parse_iso_date(date_value))

@router.get('/api/bells/config')
def config():
    from app.bell_config import configuration
    return configuration()
