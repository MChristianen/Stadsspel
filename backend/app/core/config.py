from typing import List
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 1 week
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
    
    # Storage
    MEDIA_STORAGE_TYPE: str = "local"  # local or s3
    MEDIA_LOCAL_PATH: str = "./media"
    MEDIA_BASE_URL: str = "http://localhost:8000/media"
    
    # S3/R2 (optional)
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    S3_BUCKET_NAME: str | None = None
    S3_REGION: str = "auto"
    
    # Game
    DEFAULT_COOLDOWN_MINUTES: int = 15
    MAX_ADMINS: int = 3
    
    # Logging
    LOG_LEVEL: str = "INFO"

    SERVE_LEGACY_FRONTEND: bool = True
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        allowed = {"development", "staging", "production"}
        normalized = value.lower().strip()
        if normalized not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of: {', '.join(sorted(allowed))}")
        return normalized

    @model_validator(mode="after")
    def validate_security(self):
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY == "dev-secret-key-change-in-production-minimum-32-characters":
                raise ValueError("SECRET_KEY must be changed for production")
            if len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production")
            if not self.cors_origins_list:
                raise ValueError("CORS_ORIGINS must include at least one origin in production")
        return self
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
