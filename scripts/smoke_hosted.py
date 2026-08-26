from __future__ import annotations

import argparse
import json
import sys
from typing import Any
from urllib import error, parse, request


def _fetch_json(url: str) -> tuple[int, dict[str, Any] | None]:
    req = request.Request(url, headers={"User-Agent": "nerdy-smoke/1.0"})
    try:
        with request.urlopen(req) as response:
            payload = response.read().decode("utf-8")
            return response.getcode(), json.loads(payload) if payload else None
    except error.HTTPError as exc:
        payload = exc.read().decode("utf-8")
        return exc.code, json.loads(payload) if payload else None


def _fetch_status(url: str) -> int:
    req = request.Request(url, headers={"User-Agent": "nerdy-smoke/1.0"})
    with request.urlopen(req) as response:
        return response.getcode()


def _derive_backend_lessons_url(runtime_status: dict[str, Any]) -> str | None:
    session_ws_url = runtime_status.get("sessionWsUrl")
    if not isinstance(session_ws_url, str) or not session_ws_url:
        return None

    parsed = parse.urlparse(session_ws_url)
    scheme = "https" if parsed.scheme == "wss" else "http"
    return parse.urlunparse((scheme, parsed.netloc, "/api/lessons", "", "", ""))


def _derive_session_ws_url(backend_url: str) -> str | None:
    parsed = parse.urlparse(backend_url)
    if not parsed.scheme or not parsed.netloc:
        return None

    scheme = "wss" if parsed.scheme == "https" else "ws"
    return parse.urlunparse((scheme, parsed.netloc, "/ws/session", "", "", ""))


def _session_target_matches_backend(runtime_status: dict[str, Any], backend_url: str) -> bool:
    expected_session_ws_url = _derive_session_ws_url(backend_url)
    actual_session_ws_url = runtime_status.get("sessionWsUrl")
    return isinstance(actual_session_ws_url, str) and actual_session_ws_url == expected_session_ws_url


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv and argv[0] == "--":
        argv = argv[1:]

    parser = argparse.ArgumentParser(description="Smoke check a hosted Nerdy deploy.")
    parser.add_argument("--frontend-url", required=True)
    parser.add_argument("--backend-url")
    parser.add_argument("--expect-auth", action="store_true")
    parser.add_argument("--expect-revision-contains")
    args = parser.parse_args(argv)

    frontend_url = args.frontend_url.rstrip("/")
    frontend_status = _fetch_status(frontend_url)
    if frontend_status != 200:
        print(f"smoke: frontend returned {frontend_status} for {frontend_url}")
        return 1

    runtime_status_code, runtime_status = _fetch_json(f"{frontend_url}/api/runtime/status")
    if runtime_status_code != 200 or runtime_status is None:
        print(f"smoke: runtime status returned {runtime_status_code}")
        return 1

    revision = runtime_status.get("revision")
    print(f"smoke: revision={revision!r} service={runtime_status.get('service')!r}")

    if args.expect_revision_contains and args.expect_revision_contains not in str(revision or ""):
        print(f"smoke: revision {revision!r} did not include {args.expect_revision_contains!r}")
        return 1

    if args.backend_url and not _session_target_matches_backend(runtime_status, args.backend_url):
        expected_session_ws_url = _derive_session_ws_url(args.backend_url)
        print(
            "smoke: sessionWsUrl mismatch "
            f"expected={expected_session_ws_url!r} actual={runtime_status.get('sessionWsUrl')!r}"
        )
        return 1

    backend_url = args.backend_url or _derive_backend_lessons_url(runtime_status)
    if not backend_url:
        print("smoke: could not determine backend lessons url")
        return 1

    lessons_status, _ = _fetch_json(backend_url.rstrip("/"))
    print(f"smoke: lessons_status={lessons_status} backend={backend_url}")

    if args.expect_auth and lessons_status != 401:
        print("smoke: expected backend auth gate (401)")
        return 1
    if not args.expect_auth and lessons_status != 200:
        print("smoke: unexpected backend status")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
