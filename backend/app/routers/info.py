from fastapi import APIRouter

from app.db import get_meta, list_groups, list_rooms, list_teachers
from app.http import snapshot_revision
from app.schemas import GroupsOut, InfoOut, RoomsOut, TeachersOut
from app.week import current_week, moscow_today, week_bounds

router = APIRouter(tags=["info"])


@router.get("/api/info", response_model=InfoOut)
def info():
    today = moscow_today()
    start, end = week_bounds(today)
    meta = get_meta()
    revision = snapshot_revision(meta)
    return {
        "week": current_week(today),
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "title": meta.get("title", ""),
        "uploaded_at": meta.get("uploaded_at"),
        "revision": revision,
    }


@router.get("/api/groups", response_model=GroupsOut)
def groups():
    return {"groups": list_groups()}


@router.get("/api/rooms", response_model=RoomsOut)
def rooms():
    return {"rooms": list_rooms()}


@router.get("/api/teachers", response_model=TeachersOut)
def teachers():
    return {"teachers": list_teachers()}
