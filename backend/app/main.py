from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routers import constraints, modules, relaxations, sessions, lecturers, cohorts, constraint_instances, rooms, programs, solver, candidate_solutions

app = FastAPI(title="Timetable API")

models.Base.metadata.create_all(bind=engine)

# TODO: what is cork exactly?
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(constraints.router)
app.include_router(modules.router)
app.include_router(relaxations.router)
app.include_router(sessions.router)
app.include_router(lecturers.router)
app.include_router(cohorts.router)
app.include_router(constraint_instances.router)
app.include_router(rooms.router)
app.include_router(programs.router)
app.include_router(solver.router)
app.include_router(candidate_solutions.router)


@app.get("/health")
def health():
    return {"status": "ok"}