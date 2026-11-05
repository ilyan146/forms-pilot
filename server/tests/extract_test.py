import base64
from collections.abc import Callable

import httpx2
import openai
import pytest
from fastapi.testclient import TestClient

from forms_pilot.api.caller import reset_rate_limits
from forms_pilot.extraction.model import get_extractor
from forms_pilot.extraction.schema import FormField, ImageInput, ModelAnswer, ModelValue
from forms_pilot.main import app
from forms_pilot.settings import Settings

PIXEL = base64.b64encode(b"\x89PNG fake bytes").decode()
REQUEST = {
    "fields": [
        {"id": "supplier_name", "label": "Supplier name", "kind": "text", "required": True},
        {"id": "currency", "label": "Currency", "kind": "select", "options": ["Euro", "US dollar"]},
    ],
    "images": [{"media_type": "image/png", "data": PIXEL}],
}


TOKEN = "t" * 40


SettingsOverride = Callable[..., Settings]


@pytest.fixture
def client(use_settings: SettingsOverride):
    reset_rate_limits()
    _ = use_settings()
    yield TestClient(app)
    app.dependency_overrides.clear()


def use_model(answer: ModelAnswer | Exception) -> list[tuple[list[FormField], list[ImageInput]]]:
    calls: list[tuple[list[FormField], list[ImageInput]]] = []

    async def fake(fields: list[FormField], images: list[ImageInput]) -> ModelAnswer:
        calls.append((fields, images))
        if isinstance(answer, Exception):
            raise answer
        return answer

    app.dependency_overrides[get_extractor] = lambda: fake
    return calls


def test_returns_checked_values_for_every_requested_field(client: TestClient) -> None:
    calls = use_model(
        ModelAnswer(
            values=[
                ModelValue(
                    field_id="currency",
                    status="found",
                    value="EURO",
                    evidence="Currency: EURO",
                    image_index=0,
                )
            ]
        )
    )

    response = client.post("/api/extract", json=REQUEST)

    assert response.status_code == 200
    assert response.json() == {
        "values": [
            {
                "field_id": "supplier_name",
                "value": "",
                "status": "missing",
                "evidence": None,
                "image_index": None,
                "issues": ["Required, but not found in the images."],
            },
            {
                "field_id": "currency",
                "value": "Euro",
                "status": "found",
                "evidence": "Currency: EURO",
                "image_index": 0,
                "issues": [],
            },
        ]
    }
    assert [field.id for field in calls[0][0]] == ["supplier_name", "currency"]


def test_rejects_data_that_is_not_base64(client: TestClient) -> None:
    use_model(ModelAnswer(values=[]))
    bad = {**REQUEST, "images": [{"media_type": "image/png", "data": "not base64!"}]}

    assert client.post("/api/extract", json=bad).status_code == 422


def test_rejects_requests_without_images(client: TestClient) -> None:
    use_model(ModelAnswer(values=[]))

    assert client.post("/api/extract", json={**REQUEST, "images": []}).status_code == 422


def test_reports_unconfigured_model_as_unavailable(
    client: TestClient, use_settings: SettingsOverride
) -> None:
    _ = use_settings(azure_openai_endpoint=None)

    response = client.post("/api/extract", json=REQUEST)

    assert response.status_code == 503


def test_model_rate_limit_is_passed_on_as_429(client: TestClient) -> None:
    request = httpx2.Request("POST", "https://example.test")
    use_model(
        openai.RateLimitError(
            "slow down", response=httpx2.Response(429, request=request), body=None
        )
    )

    assert client.post("/api/extract", json=REQUEST).status_code == 429


def test_model_failure_is_a_generic_502(client: TestClient) -> None:
    use_model(openai.APIConnectionError(request=httpx2.Request("POST", "https://example.test")))

    response = client.post("/api/extract", json=REQUEST)

    assert response.status_code == 502
    assert response.json() == {"detail": "The model could not read the images."}


def test_requires_a_valid_token_once_tokens_are_set(
    client: TestClient, use_settings: SettingsOverride
) -> None:
    use_model(ModelAnswer(values=[]))
    _ = use_settings(api_tokens=f"alice:{TOKEN}")

    missing = client.post("/api/extract", json=REQUEST)
    wrong = client.post(
        "/api/extract", json=REQUEST, headers={"Authorization": "Bearer " + "x" * 40}
    )
    valid = client.post("/api/extract", json=REQUEST, headers={"Authorization": f"Bearer {TOKEN}"})

    assert (missing.status_code, wrong.status_code, valid.status_code) == (401, 401, 200)


def test_refuses_everyone_outside_dev_mode_without_tokens(
    client: TestClient, use_settings: SettingsOverride
) -> None:
    use_model(ModelAnswer(values=[]))
    _ = use_settings(dev_mode=False)

    assert client.post("/api/extract", json=REQUEST).status_code == 503


def test_limits_requests_per_caller(client: TestClient, use_settings: SettingsOverride) -> None:
    use_model(ModelAnswer(values=[]))
    _ = use_settings(rate_limit_per_minute=2)

    statuses = [client.post("/api/extract", json=REQUEST).status_code for _ in range(3)]

    assert statuses == [200, 200, 429]


def test_rejects_short_tokens_in_settings() -> None:
    with pytest.raises(ValueError, match="at least 32"):
        _ = Settings.model_validate({"api_tokens": "alice:short"}).tokens
