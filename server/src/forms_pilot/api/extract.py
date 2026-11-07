import logging
from typing import Annotated

import openai
from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from forms_pilot.api.caller import require_caller
from forms_pilot.extraction.checks import check_values
from forms_pilot.extraction.documents import DocumentError, prepare_sources
from forms_pilot.extraction.model import Extractor, get_extractor
from forms_pilot.extraction.schema import ExtractRequest, ExtractResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/extract",
    operation_id="extractFormValues",
    responses={
        422: {"description": "An uploaded document is invalid or exceeds the parsing limits."},
        401: {"description": "The API token is missing or not valid."},
        429: {"description": "Too many requests, from this caller or to the model."},
        502: {"description": "The model call failed."},
        503: {"description": "Not configured."},
    },
)
async def extract_form_values(
    caller: Annotated[str, Depends(require_caller)],
    request: ExtractRequest,
    extract: Annotated[Extractor, Depends(get_extractor)],
) -> ExtractResponse:
    """Parse images, PDF pages and Excel cells, then read and check form values."""
    try:
        sources = await run_in_threadpool(prepare_sources, request)
    except DocumentError as error:
        raise HTTPException(422, str(error)) from error
    try:
        answer = await extract(request.fields, sources)
    except openai.RateLimitError as error:
        raise HTTPException(429, "The model is busy. Try again in a minute.") from error
    except openai.OpenAIError as error:
        # Log the type only: error bodies can echo the request, which holds personal data.
        logger.warning("Extraction for %s failed: %s", caller, type(error).__name__)
        raise HTTPException(502, "The model could not read the images.") from error
    values = check_values(request.fields, answer.values)
    for value in values:
        if value.image_index is not None and not 0 <= value.image_index < len(sources):
            value.image_index = None
            value.issues.append("The model returned an invalid source reference.")
        if request.documents:
            value.issues = [issue.replace("images", "documents") for issue in value.issues]
    return ExtractResponse(values=values, sources=[source.info for source in sources])
