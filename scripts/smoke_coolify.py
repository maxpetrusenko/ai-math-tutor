from __future__ import annotations

import argparse
import json
import time
from typing import Any
from urllib import error, parse, request

DEFAULT_FRONTEND_URL = "https://aitutor.maxpetrusenko.com"
DEFAULT_SESSION_URL = "https://aitutor-session.maxpetrusenko.com"
DEFAULT_TIMEOUT_SECONDS = 10.0
DEFAULT_WAIT_SECONDS = 180.0
DEFAULT_POLL_INTERVAL_SECONDS = 5.0


def _request(url: str, *, timeout_seconds: float) -> request.Request:
    return request.Request(url, headers={"User-Agent": "nerdy-coolify-smoke/1.0"})


def _fetch_status(url: str, *, timeout_seconds: float) -> int:
    try:
        with request.urlopen(_request(url, timeout_seconds=timeout_seconds), timeout=timeout_seconds) as response:
            return response.getcode()
    except error.HTTPError as exc:
        return exc.code
    except error.URLError:
        return 0


def _fetch_json(url: str, *, timeout_seconds: float) -> tuple[int, dict[str, str], dict[str, Any] | None]:
    try:
        with request.urlopen(_request(url, timeout_seconds=timeout_seconds), timeout=timeout_seconds) as response:
            payload = response.read().decode("utf-8")
            headers = {key.lower(): value for key, value in response.headers.items()}
            return response.getcode(), headers, json.loads(payload) if payload else None
    except error.HTTPError as exc:
        payload = exc.read().decode("utf-8")
        headers = {key.lower(): value for key, value in exc.headers.items()}
        return exc.code, headers, json.loads(payload) if payload else None
    except error.URLError:
        return 0, {}, None


def _host(url: str) -> str:
    return parse.urlparse(url).netloc


def _fail(message: str) -> int:
    print(f"coolify-smoke: {message}")
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Smoke check the canonical Coolify production endpoints.")
    parser.add_argument("--frontend-url", default=DEFAULT_FRONTEND_URL)
    parser.add_argument("--session-url", default=DEFAULT_SESSION_URL)
    parser.add_argument("--timeout-seconds", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--expect-revision")
    parser.add_argument("--wait-seconds", type=float, default=DEFAULT_WAIT_SECONDS)
    parser.add_argument("--poll-interval-seconds", type=float, default=DEFAULT_POLL_INTERVAL_SECONDS)
    args = parser.parse_args(argv)

    frontend_url = args.frontend_url.rstrip("/")
    session_url = args.session_url.rstrip("/")
    timeout_seconds = args.timeout_seconds
    deadline = time.monotonic() + max(args.wait_seconds, 0)

    while True:
        frontend_status = _fetch_status(frontend_url, timeout_seconds=timeout_seconds)
        if frontend_status != 200:
            if time.monotonic() >= deadline:
                return _fail(f"frontend returned {frontend_status} for {frontend_url}")
            time.sleep(max(args.poll_interval_seconds, 0))
            continue

        runtime_url = f"{frontend_url}/api/runtime/status"
        runtime_status, runtime_headers, runtime_payload = _fetch_json(runtime_url, timeout_seconds=timeout_seconds)
        if runtime_status != 200 or runtime_payload is None:
            if time.monotonic() >= deadline:
                return _fail(f"runtime status returned {runtime_status} for {runtime_url}")
            time.sleep(max(args.poll_interval_seconds, 0))
            continue

        revision = runtime_payload.get("revision")
        if args.expect_revision and revision != args.expect_revision:
            if time.monotonic() >= deadline:
                return _fail(f"runtime revision {revision!r} did not become {args.expect_revision!r}")
            time.sleep(max(args.poll_interval_seconds, 0))
            continue

        break

    cache_control = runtime_headers.get("cache-control", "")
    if "no-store" not in cache_control.lower():
        return _fail(f"runtime status missing no-store cache header: {cache_control!r}")

    session_ws_url = runtime_payload.get("sessionWsUrl")
    if not isinstance(session_ws_url, str) or not session_ws_url:
        return _fail("runtime status missing sessionWsUrl")

    session_ws_scheme = parse.urlparse(session_ws_url).scheme
    if session_ws_scheme not in {"ws", "wss"}:
        return _fail(f"runtime sessionWsUrl must use ws or wss, got {session_ws_scheme!r}")
    if parse.urlparse(frontend_url).scheme == "https" and session_ws_scheme != "wss":
        return _fail(f"runtime sessionWsUrl must use wss when frontend is https, got {session_ws_scheme!r}")
    session_ws_path = parse.urlparse(session_ws_url).path
    if session_ws_path != "/ws/session":
        return _fail(f"runtime sessionWsUrl must point at /ws/session, got {session_ws_path!r}")

    expected_session_host = _host(session_url)
    actual_session_host = _host(session_ws_url)
    if actual_session_host != expected_session_host:
        return _fail(
            f"runtime sessionWsUrl {session_ws_url!r} does not point at session host {expected_session_host!r}"
        )

    options_url = f"{session_url}/api/runtime-options"
    options_status, _, options_payload = _fetch_json(options_url, timeout_seconds=timeout_seconds)
    if options_status != 200 or not isinstance(options_payload, dict):
        return _fail(f"session runtime options returned {options_status} for {options_url}")
    if not isinstance(options_payload.get("defaults"), dict) or not isinstance(options_payload.get("options"), dict):
        return _fail("session runtime options payload is missing defaults/options")

    print(
        "coolify-smoke: ok "
        f"frontend={frontend_url} session={session_url} "
        f"revision={runtime_payload.get('revision')!r} service={runtime_payload.get('service')!r}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
