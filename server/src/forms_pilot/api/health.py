from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class Health(BaseModel):
    status: str


@router.get("/health", operation_id="getHealth")
def get_health() -> Health:
    return Health(status="ok")
