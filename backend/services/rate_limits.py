"""Per-OpenAI-credential concurrency/rate limiting for outgoing API calls.

Two different kinds of calls happen in this app, and they hit two separate
rate-limit tracks on OpenAI's side (confirmed against David's actual account
limits, 2026-09-24):

  - Image generation (gpt-image-2, client.images.generate) — a HARD
    account-wide cap of 5 images per minute. This is tight enough that a
    plain concurrency cap isn't sufficient on its own: two jobs could each
    stay "within" a concurrency limit of, say, 2, while still bursting well
    past 5 calls started in the same 60-second window if nothing paces
    them against each other. So this needs an actual sliding-window rate
    limiter, not just a semaphore.
  - Text/LLM calls (gpt-4o-mini, client.chat.completions.create) — used by
    translation (services/translate.py) and SEO content generation
    (services/content_variants.py). Limits here (500 RPM / 200k TPM) are
    generous for a small team, so a simple concurrency cap is enough; there's
    no realistic scenario at this scale where a rolling-window limiter would
    ever actually bind.

Both are keyed by a "credential key" string, returned alongside the OpenAI
client itself by services/openai_client.py's resolve_credential(user_id) —
either "house" (the shared AppCredential id=1 row) or "user:<id>" (a
personal key). A user on their own key gets their own independent budget;
everyone still on the house key (the default — see roadmap task 5) shares
one bucket, same as before per-user keys existed. Nothing in this file
needed to change when per-user keys were added.

These are threading primitives, not asyncio ones, on purpose: the code that
actually calls OpenAI (generate_image_file, translate_phrases, the SEO
generators) are plain sync functions, invoked either directly inside a
FastAPI request handler or via FastAPI's BackgroundTasks — both of which run
sync code in a worker thread, not on the asyncio event loop. An
asyncio.Semaphore would silently do nothing there.

ImageRateLimiter.acquire() is FIFO-fair (see its docstring) — a large batch
job can no longer starve a smaller one sharing the same 4-images/minute
budget just by calling acquire() more often. The text semaphore is left as
a plain threading.Semaphore, unpatched: with 500 RPM nowhere near binding
at this scale, fairness between callers there isn't a real problem worth
the added complexity.
"""

import threading
import time
from collections import deque

# Hard account cap is 5 images/minute (gpt-image-2). Kept slightly under
# that as a safety margin for clock skew and in-flight requests, not set
# exactly at the limit.
IMAGES_PER_MINUTE = 4

# gpt-4o-mini allows 500 RPM / 200k TPM on this account — nowhere near
# binding at this team's scale. This cap is just a sane ceiling so a
# runaway loop (e.g. a "generate missing SEO" pass across many subjects)
# can't fan out unbounded, not a real rate-limit workaround.
TEXT_CONCURRENCY = 5


class ImageRateLimiter:
    """Sliding-window limiter: acquire() blocks until fewer than
    `per_minute` calls have STARTED in the trailing 60 seconds, then
    reserves a slot and returns. Thread-safe.

    FIFO-fair by construction: each acquire() call takes a ticket (a
    plain object used as an identity token) and only ever takes a slot
    once its own ticket is at the FRONT of the queue AND capacity is
    free — never just because it happened to re-check the clock at a
    lucky moment. Before this, a freed slot went to whichever waiting
    thread's poll loop next grabbed the lock, with no ordering at all —
    in practice this let a job that calls acquire() in a tighter loop
    (e.g. a big batch with a short sleep_between_calls) win a
    disproportionate share of slots against a job with fewer images
    calling less often, even though each job only ever has ONE
    outstanding acquire() call at a time. Since every job's own thread
    blocks synchronously in its generation loop (see job_runner.py),
    strict arrival-order fairness across waiters is exactly the
    round-robin-across-jobs behavior this was asked for — no need to
    track per-job identity explicitly."""

    def __init__(self, per_minute: int):
        self._per_minute = per_minute
        self._lock = threading.Lock()
        self._call_times: deque[float] = deque()
        self._queue: deque[object] = deque()

    def acquire(self) -> None:
        ticket = object()
        with self._lock:
            self._queue.append(ticket)
        try:
            while True:
                with self._lock:
                    now = time.monotonic()
                    while self._call_times and now - self._call_times[0] >= 60:
                        self._call_times.popleft()
                    at_front = bool(self._queue) and self._queue[0] is ticket
                    has_capacity = len(self._call_times) < self._per_minute
                    if at_front and has_capacity:
                        self._call_times.append(now)
                        self._queue.popleft()
                        return
                    if at_front:
                        # We're next in line but the window is still full —
                        # sleep exactly until the oldest call ages out, same
                        # as the original design (no point polling sooner).
                        wait = max(60 - (now - self._call_times[0]), 0.05)
                    else:
                        # Someone ahead of us hasn't been served yet. Their
                        # own wait could be long, so there's nothing useful
                        # for us to compute — just poll periodically so we
                        # notice promptly once we become the front.
                        wait = 0.5
                # Sleep outside the lock so other threads can make progress.
                time.sleep(wait)
        except BaseException:
            # If we're bailing out before ever acquiring a slot (an
            # exception, or the process being torn down mid-wait), drop our
            # own ticket so we don't block everyone behind us forever.
            with self._lock:
                try:
                    self._queue.remove(ticket)
                except ValueError:
                    pass
            raise


_image_limiters: dict[str, ImageRateLimiter] = {}
_text_semaphores: dict[str, threading.Semaphore] = {}
_registry_lock = threading.Lock()


def get_image_rate_limiter(credential_key: str) -> ImageRateLimiter:
    with _registry_lock:
        if credential_key not in _image_limiters:
            _image_limiters[credential_key] = ImageRateLimiter(IMAGES_PER_MINUTE)
        return _image_limiters[credential_key]


def get_text_semaphore(credential_key: str) -> threading.Semaphore:
    with _registry_lock:
        if credential_key not in _text_semaphores:
            _text_semaphores[credential_key] = threading.Semaphore(TEXT_CONCURRENCY)
        return _text_semaphores[credential_key]
