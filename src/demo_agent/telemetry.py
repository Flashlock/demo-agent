from __future__ import annotations

import asyncio
import logging
import random

from demo_agent.hub_client import HubClient

logger = logging.getLogger(__name__)


class TelemetryWorker:
    def __init__(self) -> None:
        self._tasks_processed = 0
        self._queue_pressure = 32.0
        self._hub = HubClient()
        self._task: asyncio.Task[None] | None = None

    @property
    def tasks_processed(self) -> int:
        return self._tasks_processed

    @property
    def queue_pressure(self) -> float:
        return self._queue_pressure

    def record_task(self, count: int = 1) -> None:
        self._tasks_processed += count
        self._queue_pressure = min(100.0, self._queue_pressure + random.uniform(2.0, 8.0))

    def drain_queue(self) -> None:
        self._queue_pressure = max(0.0, self._queue_pressure - random.uniform(10.0, 25.0))

    async def start(self) -> None:
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                spark = random.uniform(0.5, 4.5)
                await self._hub.submit_telemetry(
                    [
                        {"key": "tasks_processed_total", "value": float(self._tasks_processed)},
                        {"key": "queue_pressure", "value": round(self._queue_pressure, 2)},
                        {"key": "throughput_spark", "value": spark},
                    ]
                )
                logger.debug(
                    "Telemetry submitted (tasks=%d pressure=%.1f)",
                    self._tasks_processed,
                    self._queue_pressure,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Telemetry submit failed: %s", exc)
            await asyncio.sleep(5.0)
