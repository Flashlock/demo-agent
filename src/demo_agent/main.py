"""Entry point for Pantheon Demo Agent (dev + PyInstaller binary)."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Allow running from repo without installing the package.
SRC = Path(__file__).resolve().parents[1]
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import uvicorn

from demo_agent.app import create_app
from demo_agent.config import service_port


def _configure_logging() -> None:
    level_name = os.environ.get("PANTHEON_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(logging.DEBUG)
    stdout_handler.addFilter(lambda record: record.levelno < logging.ERROR)
    stdout_handler.setFormatter(fmt)

    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setLevel(logging.ERROR)
    stderr_handler.setFormatter(fmt)

    logging.basicConfig(level=level, handlers=[stdout_handler, stderr_handler], force=True)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("demo_agent.telemetry").setLevel(logging.DEBUG)


def main() -> None:
    _configure_logging()
    for var in ("PANTHEON_HOST_URI", "PANTHEON_INSTANCE_TOKEN", "PANTHEON_INSTANCE_ID"):
        if var not in os.environ:
            logging.warning("%s is not set — use Pantheon Hub START or dev env vars", var)

    port = service_port()
    app = create_app()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)


if __name__ == "__main__":
    main()
