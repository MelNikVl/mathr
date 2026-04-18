from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/matchr"
    DEEPSEEK_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    SECRET_KEY: str = "changeme"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
