from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # `pnpm dev:server` runs from server/, so a .env at the repo root is found too.
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
