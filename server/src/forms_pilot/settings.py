from functools import cached_property, lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_TOKEN_LENGTH = 32


class Settings(BaseSettings):
    # `pnpm dev:server` runs from server/, so a .env at the repo root is found too.
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment: str | None = None

    dev_mode: bool = Field(
        default=False,
        description="Serve the sample form, and allow extraction without tokens when none are set.",
    )
    api_tokens: str = Field(
        default="",
        description="Comma-separated name:token pairs, one per person who may use the API.",
    )
    rate_limit_per_minute: int = Field(default=10, ge=1)

    @cached_property
    def tokens(self) -> dict[str, str]:
        """Token to the name of the person it was issued to."""
        tokens: dict[str, str] = {}
        entries = filter(None, (part.strip() for part in self.api_tokens.split(",")))
        # Errors name the entry by position, never by content, so a token never reaches the logs.
        for position, entry in enumerate(entries, start=1):
            name, separator, token = (part.strip() for part in entry.partition(":"))
            if not separator or not name:
                raise ValueError(
                    f"API_TOKENS entry {position} has no name; write it as name:token, "
                    f"for example alice:<token>."
                )
            if len(token) < MIN_TOKEN_LENGTH:
                raise ValueError(
                    f"API_TOKENS entry {position} ({name}) needs a token of at least "
                    f"{MIN_TOKEN_LENGTH} characters."
                )
            tokens[token] = name
        return tokens


@lru_cache
def get_settings() -> Settings:
    return Settings()
