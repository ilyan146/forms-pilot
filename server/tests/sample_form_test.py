from collections.abc import Callable

from fastapi.testclient import TestClient

from forms_pilot.main import app
from forms_pilot.settings import Settings

SettingsOverride = Callable[..., Settings]


def test_sample_form_is_served_as_html_in_dev_mode(use_settings: SettingsOverride) -> None:
    _ = use_settings(dev_mode=True)

    response = TestClient(app).get("/sample-form")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert 'id="invoice"' in response.text


def test_sample_form_is_hidden_outside_dev_mode(use_settings: SettingsOverride) -> None:
    _ = use_settings(dev_mode=False)

    assert TestClient(app).get("/sample-form").status_code == 404
