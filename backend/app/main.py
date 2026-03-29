"""Main FastAPI application."""
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import settings
from app.core.logging import logger
from app.api import auth, game, areas, submissions, leaderboard, admin, sessions, join, results
from app.db.session import SessionLocal

# Create FastAPI app
app = FastAPI(
    title="Stadsspel API",
    description="Mobile-first city game API with realtime map, offline support, and admin approval",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "request_id": request_id,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.exception(f"Unhandled error [{request_id}]: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "request_id": request_id,
        },
    )


# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(game.router, prefix="/api")
app.include_router(areas.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(join.router, prefix="/api")
app.include_router(results.router, prefix="/api")

# Mount media directory for local storage
if settings.MEDIA_STORAGE_TYPE == "local":
    media_path = Path(settings.MEDIA_LOCAL_PATH)
    media_path.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(media_path)), name="media")
    logger.info(f"Serving media files from {media_path}")

# Mount frontend directory
frontend_path = Path(__file__).parent.parent.parent / "frontend"
if settings.SERVE_LEGACY_FRONTEND and frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
    logger.info(f"Serving frontend from {frontend_path}")


@app.get("/api")
def root():
    """API root endpoint."""
    return {
        "message": "Stadsspel API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "ok"}
    except Exception as exc:
        logger.error(f"Health check database error: {exc}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "database": "error"},
        )
    finally:
        db.close()


@app.get("/api/health")
def api_health_check():
    """API-prefixed health endpoint."""
    return health_check()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
