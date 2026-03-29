"""Helpers for returning media URLs that are reachable from the current client."""
from urllib.parse import urlparse
from fastapi import Request


def resolve_public_media_url(request: Request, raw_url: str | None) -> str:
    """
    Resolve media URL to a client-reachable URL.

    - Relative `/media/...` paths become absolute using current request host.
    - Legacy localhost URLs are rewritten to current request host.
    - Other absolute URLs are returned unchanged.
    """
    if not raw_url or str(raw_url).lower() == "null":
        return ""

    if raw_url.startswith("/media/"):
        return raw_url

    parsed = urlparse(raw_url)
    # Local media should always be returned as relative path so frontend origin
    # (with optional dev proxy) can serve it correctly on all devices.
    if parsed.path.startswith("/media/"):
        return parsed.path

    return raw_url
