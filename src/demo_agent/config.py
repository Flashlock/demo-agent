from __future__ import annotations

import os


def hub_base_url() -> str:
    uri = os.environ["PANTHEON_HOST_URI"]
    if uri.startswith("pantheon+"):
        uri = uri[len("pantheon+") :]
    return uri.rstrip("/")


def hub_headers() -> dict[str, str]:
    return {
        "X-Pantheon-Instance-Token": os.environ["PANTHEON_INSTANCE_TOKEN"],
        "Content-Type": "application/json",
    }


def instance_id() -> str:
    return os.environ["PANTHEON_INSTANCE_ID"]


def service_port() -> int:
    return int(os.environ.get("AGENT_SERVICE_PORT", "8080"))


def greeting_prefix() -> str:
    return os.environ.get("DEMO_GREETING", "Hello from Demo Agent")


def proxy_secret() -> str | None:
    return os.environ.get("PANTHEON_PROXY_SECRET")
