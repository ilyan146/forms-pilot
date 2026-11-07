"""Parse workbooks and render PDFs without persisting uploaded documents."""

import base64
import binascii
import json
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO
from zipfile import ZipFile

import pymupdf
from openpyxl import load_workbook

from forms_pilot.extraction.schema import (
    MAX_DOCUMENT_BYTES,
    ExtractRequest,
    ImageInput,
    SourceInfo,
)

MAX_SOURCES = 24
MAX_TEXT_CHARS = 150_000
MAX_CELLS = 20_000
MAX_UNPACKED_BYTES = 30_000_000


@dataclass
class Source:
    info: SourceInfo
    image: ImageInput | None = None
    text: str = ""


class DocumentError(ValueError):
    """An unsupported, damaged or oversized document."""


def prepare_sources(request: ExtractRequest) -> list[Source]:
    sources = [
        Source(info=SourceInfo(name=f"Image {i + 1}"), image=image)
        for i, image in enumerate(request.images)
    ]
    total_bytes = 0
    for document in request.documents:
        try:
            data = base64.b64decode(document.data, validate=True)
        except (ValueError, binascii.Error) as error:
            raise DocumentError("The document is not valid base64.") from error
        total_bytes += len(data)
        if len(data) > MAX_DOCUMENT_BYTES or total_bytes > 30_000_000:
            raise DocumentError("Documents must be at most 10 MB each and 30 MB together.")
        if document.media_type == "application/pdf":
            sources.extend(_pdf(data, document.name))
        else:
            sources.extend(_workbook(data, document.name))
        if len(sources) > MAX_SOURCES:
            raise DocumentError(
                "Use at most 24 images, PDF pages and nonempty Excel sheets together."
            )
    if not sources:
        raise DocumentError("The uploaded documents contain no readable pages or cells.")
    if sum(len(source.text) for source in sources) > MAX_TEXT_CHARS:
        raise DocumentError("The documents contain too much text. Split them into smaller files.")
    return sources


def _pdf(data: bytes, name: str) -> list[Source]:
    try:
        with pymupdf.open(stream=data, filetype="pdf") as document:
            if document.needs_pass:
                raise DocumentError("Password-protected PDFs are not supported.")
            if not 1 <= len(document) <= MAX_SOURCES:
                raise DocumentError("A PDF must have between 1 and 24 pages.")
            sources = []
            for index in range(len(document)):
                page = document.load_page(index)
                # Render every page: scans have no text layer, and visual tables
                # remain useful even when a PDF does have selectable text.
                longest = max(page.rect.width, page.rect.height)
                if longest <= 0:
                    raise DocumentError("The PDF contains a page with invalid dimensions.")
                pixmap = page.get_pixmap(
                    matrix=pymupdf.Matrix(2000 / longest, 2000 / longest),
                    colorspace=pymupdf.csRGB,
                    alpha=False,
                )
                sources.append(
                    Source(
                        info=SourceInfo(name=name, page=index + 1),
                        image=ImageInput(
                            media_type="image/jpeg",
                            data=base64.b64encode(pixmap.tobytes("jpeg")).decode(),
                        ),
                    )
                )
            return sources
    except DocumentError:
        raise
    except Exception as error:
        raise DocumentError("The PDF could not be opened. Use a valid, unencrypted PDF.") from error


def _workbook(data: bytes, name: str) -> list[Source]:
    try:
        with ZipFile(BytesIO(data)) as archive:
            if sum(entry.file_size for entry in archive.infolist()) > MAX_UNPACKED_BYTES:
                raise DocumentError("The expanded Excel workbook is too large.")
        workbook = load_workbook(BytesIO(data), read_only=True, data_only=True)
        try:
            sources: list[Source] = []
            cells_seen = 0
            text_chars = 0
            for sheet in workbook:
                # Ignore inflated dimension metadata; bound iteration ourselves.
                sheet.reset_dimensions()
                rows: list[str] = []
                for row in sheet.iter_rows():
                    cells_seen += len(row)
                    if cells_seen > MAX_CELLS:
                        raise DocumentError("Use a workbook with at most 20,000 cells.")
                    cells = {}
                    for cell in row:
                        if cell.value is None:
                            continue
                        value = cell.value
                        if isinstance(value, (date, datetime)):
                            value = value.isoformat()
                        # Coordinates preserve empty columns and row identity.
                        # Numeric IDs (HS.CODE, BOE) stay integers, never scientific notation.
                        cells[cell.coordinate] = value
                    if cells:
                        line = json.dumps(cells, ensure_ascii=False, default=str)
                        text_chars += len(line)
                        if text_chars > MAX_TEXT_CHARS:
                            raise DocumentError("The workbook contains too much text.")
                        rows.append(line)
                if rows:
                    sources.append(
                        Source(info=SourceInfo(name=name, sheet=sheet.title), text="\n".join(rows))
                    )
                if len(sources) > MAX_SOURCES:
                    raise DocumentError("Use at most 24 nonempty Excel sheets.")
            return sources
        finally:
            workbook.close()
    except DocumentError:
        raise
    except Exception as error:
        raise DocumentError("The workbook could not be opened. Use a valid .xlsx file.") from error
