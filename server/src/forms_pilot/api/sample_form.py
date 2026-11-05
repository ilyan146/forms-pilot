"""A local stand-in for the target form, so the extension can be tried without the real site."""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()

_PAGE = Path(__file__).resolve().parent.parent / "sample_form.html"


@router.get("/sample-form", include_in_schema=False)
def sample_form() -> FileResponse:
    return FileResponse(_PAGE, media_type="text/html")
