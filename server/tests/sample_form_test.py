from fastapi.testclient import TestClient

from forms_pilot.main import app


def test_sample_form_is_served_as_html() -> None:
    response = TestClient(app).get("/sample-form")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert 'id="invoice"' in response.text
