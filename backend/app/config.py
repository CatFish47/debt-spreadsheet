from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    session_expire_days: int = 90
    app_url: str = "http://localhost:3001"

    model_config = {"env_file": ".env"}


settings = Settings()
