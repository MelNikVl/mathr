from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/matchr"
    DEEPSEEK_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    SECRET_KEY: str = "changeme"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_STARTER_PRICE_ID: str = ""
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
