"""A local stand-in for the target form, so the extension can be tried without the real site."""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from forms_pilot.settings import Settings, get_settings

router = APIRouter()

_PAGE = Path(__file__).resolve().parent.parent / "sample_form.html"


@router.get("/sample-form", include_in_schema=False)
def sample_form(settings: Annotated[Settings, Depends(get_settings)]) -> FileResponse:
    if not settings.dev_mode:
        raise HTTPException(404)
    return FileResponse(_PAGE, media_type="text/html")
