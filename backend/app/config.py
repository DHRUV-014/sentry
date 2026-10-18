"""Settings loaded from backend/.env (and the process environment)."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"

    db_path: Path = Path("data/scamshield.db")
    store_transcripts: bool = True

    session_idle_timeout_s: float = Field(600, gt=0)
    event_queue_size: int = Field(256, gt=0)
    event_replay_size: int = Field(200, ge=0)

    llm_enabled: bool = False

    telegram_bot_token: SecretStr | None = None
    telegram_bot_username: str | None = None
    telegram_timeout_s: float = Field(5, gt=0)

    @property
    def resolved_db_path(self) -> Path:
        return self.db_path if self.db_path.is_absolute() else BACKEND_DIR / self.db_path

    @property
    def telegram_configured(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_bot_token.get_secret_value())


@lru_cache
def get_settings() -> Settings:
    return Settings()
