from pathlib import Path
import runpy

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import models
from app.database import engine


router = APIRouter(
    prefix="/study",
    tags=["study"],
)


class LoadSeedRequest(BaseModel):
    seed: str


# Only these known seed files can be executed.
# The frontend never sends a filename.
SEED_FILES = {
    "main": "seed.py",
    "explanations": "seed_explanations.py",
    "any-explanations": "seed_any_failure.py",
}


def get_project_root() -> Path:
    # study.py -> routers -> app -> project root
    return Path(__file__).resolve().parents[2]


def clear_temp_timetable() -> None:
    """
    Remove the temporary committed-timetable overlay if one exists.
    """

    temp_file = get_project_root() / "temp_timetable.json"

    if temp_file.exists():
        temp_file.unlink()


@router.post("/load-seed")
def load_study_seed(request: LoadSeedRequest):

    print("blabla")

    seed_filename = SEED_FILES.get(request.seed)

    if seed_filename is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown study seed: {request.seed}",
        )

    project_root = get_project_root()
    seed_path = project_root / seed_filename

    if not seed_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Seed file does not exist: {seed_filename}",
        )

    try:
        # -------------------------------------------------
        # 1. Remove the existing database contents
        # -------------------------------------------------

        models.Base.metadata.drop_all(bind=engine)

        # -------------------------------------------------
        # 2. Recreate empty tables
        # -------------------------------------------------

        models.Base.metadata.create_all(bind=engine)

        # -------------------------------------------------
        # 3. Remove temporary timetable changes
        # -------------------------------------------------

        clear_temp_timetable()

        # -------------------------------------------------
        # 4. Execute the selected seed
        # -------------------------------------------------

        runpy.run_path(
            str(seed_path),
            run_name="__main__",
        )

        return {
            "ok": True,
            "seed": request.seed,
        }

    except Exception as exc:

        print(
            f"Failed to load study seed "
            f"{request.seed}: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to load study seed: {exc}",
        )