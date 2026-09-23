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

Both are keyed by a "credential key" string — today that's always the one
shared AppCredential row (id=1, see services/openai_client.py's
get_active_credential_key()), so there's effectively one bucket for the
whole app, shared by every user. Once AppCredential moves to per-user
(roadmap task 5), get_active_credential_key() starts returning the caller's
own credential id instead, and rate limiting/concurrency automatically
becomes per-user — nothing in this file needs to change for that.

These are threading primitives, not asyncio ones, on purpose: the code that
actually calls OpenAI (generate_image_file, translate_phrases, the SEO
generators) are plain sync functions, invoked either directly inside a
FastAPI request handler or via FastAPI's BackgroundTasks — both of which run
sync code in a worker thread, not on the asyncio event loop. An
asyncio.Semaphore would silently do nothing there.
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
    reserves a slot and returns. Thread-safe."""

    def __init__(self, per_minute: int):
        self._per_minute = per_minute
        self._lock = threading.Lock()
        self._call_times: deque[float] = deque()

    def acquire(self) -> None:
        while True:
            with self._lock:
                now = time.monotonic()
                while self._call_times and now - self._call_times[0] >= 60:
                    self._call_times.popleft()
                if len(self._call_times) < self._per_minute:
                    self._call_times.append(now)
                    return
                wait = 60 - (now - self._call_times[0])
            # Sleep outside the lock so other threads can make progress
            # (release slots, check their own wait time) while this one waits.
            time.sleep(max(wait, 0.05))


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
