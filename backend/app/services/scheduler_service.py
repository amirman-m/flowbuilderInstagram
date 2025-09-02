from __future__ import annotations
import logging
from typing import Optional, Dict, Callable
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Singleton scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None
# Map flow_id -> job id
_flow_jobs: Dict[int, str] = {}


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def start_scheduler():
    sched = get_scheduler()
    if not sched.running:
        logger.info("Starting AsyncIOScheduler for scheduled flows")
        sched.start()


def shutdown_scheduler(wait: bool = False):
    sched = get_scheduler()
    if sched.running:
        logger.info("Shutting down AsyncIOScheduler")
        sched.shutdown(wait=wait)
        _flow_jobs.clear()


def _calc_interval_seconds(time_unit: str, time_value: int) -> int:
    if time_unit == "seconds":
        return int(time_value)
    if time_unit == "minutes":
        return int(time_value) * 60
    if time_unit == "hours":
        return int(time_value) * 3600
    raise ValueError(f"Invalid time_unit: {time_unit}")


def schedule_flow(
    *,
    flow_id: int,
    user_id: int,
    time_unit: str,
    time_value: int,
    run_coro_factory: Callable[[int, int], Callable[[], object]],
) -> str:
    """
    Register or replace a scheduled job for a flow.
    - run_coro_factory(flow_id, user_id) must return an async callable with no args that performs the flow execution.
    Returns job id.
    """
    sched = get_scheduler()

    # Remove existing job if present
    if flow_id in _flow_jobs:
        job_id_old = _flow_jobs.pop(flow_id)
        try:
            sched.remove_job(job_id_old)
            logger.info(f"Removed existing schedule for flow {flow_id} (job {job_id_old})")
        except Exception:
            pass

    seconds = _calc_interval_seconds(time_unit, time_value)
    trigger = IntervalTrigger(seconds=seconds)

    job_id = f"flow_{flow_id}_schedule"

    async_callable = run_coro_factory(flow_id, user_id)

    sched.add_job(async_callable, trigger=trigger, id=job_id, replace_existing=True, coalesce=True, max_instances=1)
    _flow_jobs[flow_id] = job_id
    logger.info(f"Scheduled flow {flow_id} every {seconds}s (job {job_id})")
    return job_id


def unschedule_flow(flow_id: int):
    sched = get_scheduler()
    job_id = _flow_jobs.pop(flow_id, None)
    if job_id:
        try:
            sched.remove_job(job_id)
            logger.info(f"Unschedule flow {flow_id} (job {job_id})")
        except Exception:
            logger.warning(f"Failed to remove job {job_id} for flow {flow_id}")
