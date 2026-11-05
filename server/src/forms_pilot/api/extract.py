import logging
from typing import Annotated

import openai
from fastapi import APIRouter, Depends, HTTPException

from forms_pilot.extraction.checks import check_values
from forms_pilot.extraction.model import Extractor, get_extractor
from forms_pilot.extraction.schema import ExtractRequest, ExtractResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/extract",
    operation_id="extractFormValues",
    responses={
        502: {"description": "The model call failed."},
        503: {"description": "Not configured."},
    },
)
async def extract_form_values(
    request: ExtractRequest, extract: Annotated[Extractor, Depends(get_extractor)]
) -> ExtractResponse:
    """Read values for the given fields from the images, then check each one."""
    try:
        answer = await extract(request.fields, request.images)
    except openai.RateLimitError as error:
        raise HTTPException(429, "The model is busy. Try again in a minute.") from error
    except openai.OpenAIError as error:
        # Log the type only: error bodies can echo the request, which holds personal data.
        logger.warning("Extraction failed: %s", type(error).__name__)
        raise HTTPException(502, "The model could not read the images.") from error
    return ExtractResponse(values=check_values(request.fields, answer.values))
