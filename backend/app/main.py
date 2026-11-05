import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.http import UTF8JSONResponse
from app.routers import admin, bells, info, schedule, auth, users, teacher, groups, template, bell_admin, bulk


def load_dotenv(path: str = ".env") -> None:
    env_path = os.environ.get("ENV_FILE", path)
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.perimeter import validate_environment
    validate_environment()
    init_db()
    from app.accounts import bootstrap_admin
    bootstrap_admin()
    yield


app = FastAPI(
    title="Расписание колледжа",
    description="Загрузка Excel-расписания и выдача занятий по группе.",
    version="1.0.0",
    default_response_class=UTF8JSONResponse,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=__import__("app.perimeter", fromlist=["origins"]).origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from app.audit import router as audit_router
app.include_router(audit_router)
from app.perimeter import guard
app.middleware("http")(guard)
app.include_router(bulk.router)
app.include_router(bell_admin.router)
app.include_router(template.router)
app.include_router(groups.router)
app.include_router(teacher.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(info.router)
app.include_router(schedule.router)
app.include_router(bells.router)
app.include_router(admin.router)
