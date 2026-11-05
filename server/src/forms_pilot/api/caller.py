"""Who is calling the API, and whether they may call it again yet."""

import hmac
import time
from collections import deque
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from forms_pilot.settings import Settings, get_settings

_bearer = HTTPBearer(auto_error=False, description="A personal API token from the administrator.")
_WINDOW_SECONDS = 60.0
# Per caller, the times of their recent requests. In-process, so it holds per worker.
_recent: dict[str, deque[float]] = {}


def require_caller(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> str:
    """The name of the person calling, from their token. Raises 401 or 429."""
    caller = _identify(credentials, settings)
    _take_slot(caller, settings.rate_limit_per_minute)
    return caller


def _identify(credentials: HTTPAuthorizationCredentials | None, settings: Settings) -> str:
    if not settings.tokens:
        if settings.dev_mode:
            return "local"
        raise HTTPException(503, "No API tokens are set up on the server.")
    if credentials is not None:
        presented = credentials.credentials.encode()
        # Compare against every token so the time taken does not reveal which one matched.
        matches = [
            name
            for token, name in settings.tokens.items()
            if hmac.compare_digest(presented, token.encode())
        ]
        if matches:
            return matches[0]
    raise HTTPException(
        401, "Your API token is missing or not valid.", headers={"WWW-Authenticate": "Bearer"}
    )


def _take_slot(caller: str, per_minute: int) -> None:
    now = time.monotonic()
    recent = _recent.setdefault(caller, deque())
    while recent and now - recent[0] >= _WINDOW_SECONDS:
        recent.popleft()
    if len(recent) >= per_minute:
        retry_after = int(_WINDOW_SECONDS - (now - recent[0])) + 1
        raise HTTPException(
            429,
            f"Too many requests. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )
    recent.append(now)


def reset_rate_limits() -> None:
    _recent.clear()
