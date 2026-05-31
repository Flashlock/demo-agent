from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from demo_agent.config import greeting_prefix, proxy_secret, instance_id, service_port
from demo_agent.hub_client import HubClient
from demo_agent.telemetry import TelemetryWorker

logger = logging.getLogger(__name__)


class ProcessQueueRequest(BaseModel):
    force_run: bool = Field(default=False, alias="forceRun")

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    status: str
    instance_id: str = Field(serialization_alias="instanceId")
    port: int

    model_config = {"populate_by_name": True}


class StatusResponse(BaseModel):
    instance_id: str = Field(serialization_alias="instanceId")
    greeting: str
    tasks_processed: int = Field(serialization_alias="tasksProcessed")
    queue_pressure: float = Field(serialization_alias="queuePressure")
    port: int

    model_config = {"populate_by_name": True}


class ProcessQueueResponse(BaseModel):
    status: str
    processed: int
    queue_pressure: float = Field(serialization_alias="queuePressure")

    model_config = {"populate_by_name": True}


class RequestApprovalRequest(BaseModel):
    wait_for_resolution: bool = Field(default=False, alias="waitForResolution")

    model_config = {"populate_by_name": True}


class RequestApprovalResponse(BaseModel):
    status: str
    breakpoint_id: str = Field(serialization_alias="breakpointId")
    resolution: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


def create_app() -> FastAPI:
    app = FastAPI(title="Pantheon Demo Agent", version="1.0.0")
    telemetry = TelemetryWorker()
    hub = HubClient()

    @app.middleware("http")
    async def enforce_proxy_secret(request: Request, call_next):
        if request.url.path == "/api/v1/health":
            return await call_next(request)
        expected = proxy_secret()
        if expected:
            provided = request.headers.get("x-pantheon-proxy-secret")
            if provided != expected:
                raise HTTPException(status_code=403, detail="Forbidden")
        return await call_next(request)

    @app.on_event("startup")
    async def startup() -> None:
        logger.info("Demo Agent starting on port %s for instance %s", service_port(), instance_id())
        await telemetry.start()

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await telemetry.stop()

    @app.get("/api/v1/health", response_model=HealthResponse, response_model_by_alias=True, tags=["core"])
    async def health() -> HealthResponse:
        return HealthResponse(status="ok", instance_id=instance_id(), port=service_port())

    @app.get("/api/v1/status", response_model=StatusResponse, response_model_by_alias=True, tags=["core"])
    async def status() -> StatusResponse:
        return StatusResponse(
            instance_id=instance_id(),
            greeting=greeting_prefix(),
            tasks_processed=telemetry.tasks_processed,
            queue_pressure=telemetry.queue_pressure,
            port=service_port(),
        )

    @app.post("/api/v1/process-queue", response_model=ProcessQueueResponse, response_model_by_alias=True, tags=["work"])
    async def process_queue(body: ProcessQueueRequest) -> ProcessQueueResponse:
        batch = 3 if body.force_run else 1
        telemetry.record_task(batch)
        telemetry.drain_queue()
        logger.info("Processed queue batch=%s force_run=%s", batch, body.force_run)
        return ProcessQueueResponse(
            status="processed",
            processed=batch,
            queue_pressure=telemetry.queue_pressure,
        )

    @app.post("/api/v1/request-approval", response_model=RequestApprovalResponse, response_model_by_alias=True, tags=["hitl"])
    async def request_approval(
        body: RequestApprovalRequest | None = None,
    ) -> RequestApprovalResponse:
        opts = body or RequestApprovalRequest()
        breakpoint_id = f"brk_demo_{uuid.uuid4().hex[:12]}"
        await hub.hitl_interrupt(
            breakpoint_id=breakpoint_id,
            headline="Demo approval required",
            summary=f"{greeting_prefix()} — approve this demo task to continue.",
            urgency="HIGH",
        )
        if not opts.wait_for_resolution:
            hub.schedule_hitl_resolution_log(breakpoint_id)
            return RequestApprovalResponse(
                status="pending",
                breakpoint_id=breakpoint_id,
                resolution=None,
            )

        resolution = await hub.wait_for_hitl_resolution(breakpoint_id)
        if resolution and resolution.get("decision") == "APPROVE":
            telemetry.record_task(1)
        return RequestApprovalResponse(
            status="resolved" if resolution else "timeout",
            breakpoint_id=breakpoint_id,
            resolution=resolution,
        )

    return app
