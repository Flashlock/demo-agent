from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import httpx

from demo_agent.config import hub_base_url, hub_headers, instance_id

logger = logging.getLogger(__name__)


class HubClient:
    async def submit_telemetry(
        self,
        metrics: list[dict[str, float | str]],
        model_logs: list[dict[str, Any]] | None = None,
    ) -> None:
        payload = {
            "timestamp": int(time.time()),
            "metrics": metrics,
            "modelLogs": model_logs or [],
        }
        url = f"{hub_base_url()}/api/v1/telemetry/submit"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=hub_headers())
            response.raise_for_status()

    async def hitl_interrupt(
        self,
        breakpoint_id: str,
        headline: str,
        summary: str,
        urgency: str = "MEDIUM",
    ) -> None:
        payload = {
            "breakpointId": breakpoint_id,
            "urgency": urgency,
            "headline": headline,
            "summary": summary,
            "payloadContext": {},
            "interactiveFormSchema": {
                "fields": [
                    {
                        "id": "decision",
                        "type": "DROPDOWN",
                        "label": "Decision",
                        "options": ["APPROVE", "DENY"],
                        "default": "DENY",
                    },
                    {
                        "id": "adminAnnotation",
                        "type": "STRING",
                        "label": "Notes",
                        "required": False,
                    },
                ]
            },
        }
        url = f"{hub_base_url()}/api/v1/hitl/interrupt"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=hub_headers())
            response.raise_for_status()
        logger.info(
            "HITL raised: breakpointId=%s urgency=%s headline=%r",
            breakpoint_id,
            urgency,
            headline,
        )

    async def hitl_status(self, breakpoint_id: str) -> dict[str, Any]:
        url = f"{hub_base_url()}/api/v1/hitl/{breakpoint_id}/status"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=hub_headers())
            response.raise_for_status()
            return response.json()

    async def list_hitl_queue(self, focus_breakpoint_id: str | None = None) -> dict[str, Any]:
        """List the active HITL FIFO queue for this instance (instance-scoped)."""
        query = f"?focus={focus_breakpoint_id}" if focus_breakpoint_id else ""
        url = (
            f"{hub_base_url()}/api/v1/instances/{instance_id()}/hitl/active{query}"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=hub_headers())
            response.raise_for_status()
            return response.json()

    def _log_resolution(self, breakpoint_id: str, resolution: dict[str, Any] | None) -> None:
        if not resolution:
            logger.info("HITL timed out or aborted: breakpointId=%s", breakpoint_id)
            return
        decision = resolution.get("decision")
        notes = resolution.get("adminAnnotation")
        if notes:
            logger.info(
                "HITL received: breakpointId=%s decision=%s notes=%r",
                breakpoint_id,
                decision,
                notes,
            )
        else:
            logger.info(
                "HITL received: breakpointId=%s decision=%s",
                breakpoint_id,
                decision,
            )

    async def _parse_sse_stream(
        self,
        response: httpx.Response,
        breakpoint_id: str,
        deadline: float,
    ) -> dict[str, Any] | None:
        buffer = ""
        async for chunk in response.aiter_text():
            if time.monotonic() >= deadline:
                return None
            buffer += chunk
            while "\n\n" in buffer:
                frame, buffer = buffer.split("\n\n", 1)
                data_line = next(
                    (line[5:].strip() for line in frame.split("\n") if line.startswith("data:")),
                    "",
                )
                if not data_line:
                    continue
                try:
                    event = json.loads(data_line)
                except json.JSONDecodeError:
                    continue
                if event.get("event") != "PANTHEON://HITL_RESOLVED":
                    continue
                payload = event.get("payload") or {}
                if payload.get("breakpointId") != breakpoint_id:
                    continue
                resolution = payload.get("resolution")
                if isinstance(resolution, dict):
                    return resolution
        return None

    async def wait_for_hitl_resolution(
        self,
        breakpoint_id: str,
        timeout: float = 300.0,
    ) -> dict[str, Any] | None:
        url = f"{hub_base_url()}/api/v1/events/stream"
        deadline = time.monotonic() + timeout
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("GET", url, headers=hub_headers()) as response:
                    response.raise_for_status()
                    resolution = await self._parse_sse_stream(response, breakpoint_id, deadline)
        except httpx.HTTPError as exc:
            logger.warning("HITL event stream failed, falling back to status: %s", exc)
            return await self._wait_for_hitl_status_fallback(breakpoint_id, deadline)

        self._log_resolution(breakpoint_id, resolution)
        return resolution

    async def _wait_for_hitl_status_fallback(
        self,
        breakpoint_id: str,
        deadline: float,
    ) -> dict[str, Any] | None:
        while time.monotonic() < deadline:
            status = await self.hitl_status(breakpoint_id)
            if status.get("status") == "RESOLVED":
                resolution = status.get("resolution")
                if isinstance(resolution, dict):
                    return resolution
                return None
            if status.get("status") == "ABORTED":
                return None
            await asyncio.sleep(1.5)
        return None

    def schedule_hitl_resolution_log(self, breakpoint_id: str) -> None:
        asyncio.create_task(self._log_when_resolved(breakpoint_id))

    async def _log_when_resolved(self, breakpoint_id: str) -> None:
        await self.wait_for_hitl_resolution(breakpoint_id)
