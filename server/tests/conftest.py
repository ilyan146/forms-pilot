import pytest
from pydantic_settings import SettingsConfigDict

from forms_pilot.main import app
from forms_pilot.settings import Settings, get_settings


class _TestSettings(Settings):
    # No env file, so a local .env cannot change what the tests see.
    model_config = SettingsConfigDict(env_file=None, extra="ignore")


@pytest.fixture
def use_settings():
    """Override the app's settings, in dev mode unless told otherwise."""

    def use(**values: object) -> Settings:
        settings = _TestSettings.model_validate({"dev_mode": True, **values})
        app.dependency_overrides[get_settings] = lambda: settings
        return settings

    yield use
    app.dependency_overrides.pop(get_settings, None)
