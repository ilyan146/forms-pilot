from fastapi import FastAPI

from forms_pilot.api.health import router as health_router

app = FastAPI(title="Forms Pilot")
app.include_router(health_router, prefix="/api")
