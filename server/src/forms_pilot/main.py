from fastapi import FastAPI

from forms_pilot.api.health import router as health_router
from forms_pilot.api.sample_form import router as sample_form_router

app = FastAPI(title="Forms Pilot")
app.include_router(health_router, prefix="/api")
app.include_router(sample_form_router)
