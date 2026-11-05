"""Shapes of the extract API.

FastAPI turns these into the OpenAPI spec that the extension's client is generated from.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

FieldKind = Literal[
    "text", "textarea", "number", "date", "email", "tel", "select", "checkbox", "radio"
]
ValueStatus = Literal["found", "missing", "ambiguous"]

MAX_IMAGES = 8
# Base64 grows data by a third, so this allows images of about 5 MB.
MAX_IMAGE_BASE64_CHARS = 7_000_000


class FormField(BaseModel):
    id: Annotated[str, Field(min_length=1, max_length=200)]
    label: Annotated[str, Field(max_length=500)]
    kind: FieldKind
    required: bool = False
    options: Annotated[list[Annotated[str, Field(max_length=500)]], Field(max_length=200)] = []
    hint: Annotated[str | None, Field(max_length=1000)] = None


class ImageInput(BaseModel):
    media_type: Literal["image/png", "image/jpeg", "image/webp", "image/gif"]
    data: Annotated[
        str,
        Field(
            description="Base64-encoded image bytes, without a data: prefix.",
            max_length=MAX_IMAGE_BASE64_CHARS,
            pattern=r"^[A-Za-z0-9+/]+={0,2}$",
        ),
    ]


class ExtractRequest(BaseModel):
    fields: Annotated[list[FormField], Field(min_length=1, max_length=150)]
    images: Annotated[list[ImageInput], Field(min_length=1, max_length=MAX_IMAGES)]


class ExtractedValue(BaseModel):
    field_id: str
    value: str = Field(description="Empty when nothing was found. Checked against the field.")
    status: ValueStatus
    evidence: str | None = Field(description="The text the model read for this value.")
    image_index: int | None = Field(description="Which image the evidence came from, from 0.")
    issues: list[str] = Field(description="Problems found by checks. Empty means none were found.")


class ExtractResponse(BaseModel):
    values: list[ExtractedValue]


# What the model must return. Structured output holds it to this exact shape, so
# every property is required; "nothing" is an empty string or null.


class ModelValue(BaseModel):
    field_id: str
    status: ValueStatus
    value: str
    evidence: str | None
    image_index: int | None


class ModelAnswer(BaseModel):
    values: list[ModelValue]
