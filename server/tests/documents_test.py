import base64
from io import BytesIO

import pymupdf
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from forms_pilot.extraction.documents import DocumentError, prepare_sources
from forms_pilot.extraction.model import _user_content, get_extractor
from forms_pilot.extraction.schema import ExtractRequest, FormField, ModelAnswer
from forms_pilot.main import app

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
FIELD = {"id": "vin", "label": "VIN", "kind": "text"}


def request(data: bytes, media_type: str = XLSX) -> ExtractRequest:
    return ExtractRequest.model_validate(
        {
            "fields": [FIELD],
            "documents": [
                {
                    "name": "sample",
                    "media_type": media_type,
                    "data": base64.b64encode(data).decode(),
                }
            ],
        }
    )


def workbook_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "Vehicles"
    sheet.append(["SL NO", "Model", None, "VIN", "HS.CODE", "AMOUNT"])
    sheet.append([1, "Test vehicle", None, "TESTVIN00000000001", 870332200000, 180000])
    sheet.append([2, "Other vehicle", None, "TESTVIN00000000002", 870431200000, 123000])
    sheet["G1"] = "Cached formula only"
    sheet["G2"] = "=F2+F3"
    workbook.create_sheet("Empty")
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def test_workbook_keeps_coordinates_vehicle_rows_and_numeric_identifiers() -> None:
    sources = prepare_sources(request(workbook_bytes()))
    assert len(sources) == 1
    assert sources[0].info.sheet == "Vehicles"
    assert '"D2": "TESTVIN00000000001"' in sources[0].text
    assert '"E2": 870332200000' in sources[0].text
    assert '"D3": "TESTVIN00000000002"' in sources[0].text
    assert "C2" not in sources[0].text
    assert "=F2+F3" not in sources[0].text
    content = _user_content([FormField.model_validate(FIELD)], sources)
    assert sources[0].text in [part.get("text") for part in content]


def test_scanned_pdf_renders_pages_in_order_without_text_layer() -> None:
    with pymupdf.open() as document:
        for _ in range(2):
            page = document.new_page()
            page.draw_rect(pymupdf.Rect(10, 10, 100, 100))
        data = document.tobytes()
    sources = prepare_sources(request(data, "application/pdf"))
    assert [source.info.page for source in sources] == [1, 2]
    assert all(source.image and source.image.media_type == "image/jpeg" for source in sources)
    assert sources[0].image is not None
    assert base64.b64decode(sources[0].image.data).startswith(b"\xff\xd8")


@pytest.mark.parametrize("media_type", [XLSX, "application/pdf"])
def test_invalid_documents_have_clear_errors(media_type: str) -> None:
    with pytest.raises(DocumentError, match="could not be opened"):
        prepare_sources(request(b"not a document", media_type))


def test_rejects_excessive_pdf_page_count() -> None:
    with pymupdf.open() as document:
        for _ in range(25):
            _ = document.new_page()
        data = document.tobytes()
    with pytest.raises(DocumentError, match="24 pages"):
        prepare_sources(request(data, "application/pdf"))


def test_rejects_empty_workbook() -> None:
    workbook = Workbook()
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    with pytest.raises(DocumentError, match="no readable"):
        prepare_sources(request(output.getvalue()))


def test_document_only_api_request_returns_source_metadata(use_settings) -> None:
    _ = use_settings()

    async def fake(fields, sources):
        assert sources[0].info.sheet == "Vehicles"
        assert len(fields) == 1
        return ModelAnswer(values=[])

    app.dependency_overrides[get_extractor] = lambda: fake
    try:
        with TestClient(app) as client:
            response = client.post("/api/extract", json=request(workbook_bytes()).model_dump())
        assert response.status_code == 200
        assert response.json()["sources"] == [{"name": "sample", "page": None, "sheet": "Vehicles"}]
    finally:
        app.dependency_overrides.clear()
