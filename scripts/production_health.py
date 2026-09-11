"""Scheduled production health probe for the canonical AI Math Tutor endpoints.

Runs from `.github/workflows/production-health.yml` on an hourly schedule and can
also be run manually:

    python3 scripts/production_health.py
    python3 scripts/production_health.py --manage-issue --github-repo maxpetrusenko/ai-math-tutor

The probe is read-only against production (GET requests only). When
`--manage-issue` is set and a GitHub token is available, a failing probe files a
single `production-health:` tracking issue (deduplicated by title prefix), and a
recovering probe closes any open tracking issues again.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib import error, request

DEFAULT_FRONTEND_URL = "https://aitutor.maxpetrusenko.com"
DEFAULT_SESSION_URL = "https://aitutor-session.maxpetrusenko.com"
DEFAULT_TIMEOUT_SECONDS = 10.0
DEFAULT_GITHUB_TIMEOUT_SECONDS = 20.0
GITHUB_API_ROOT = "https://api.github.com"
ALERT_TITLE_PREFIX = "production-health:"
USER_AGENT = "nerdy-production-health/1.0"


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def _utc_now_text() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _status_text(url: str, status: int) -> str:
    if status == 0:
        return f"{url} did not respond"
    return f"{url} returned {status}"


def _fetch_status(url: str, *, timeout_seconds: float) -> int:
    req = request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            return response.getcode()
    except error.HTTPError as exc:
        return exc.code
    except (error.URLError, TimeoutError):
        return 0


def _fetch_json(url: str, *, timeout_seconds: float) -> tuple[int, dict[str, Any] | None]:
    req = request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            status = response.getcode()
            body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        return exc.code, None
    except (error.URLError, TimeoutError):
        return 0, None

    if not body:
        return status, None
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return status, None
    return status, parsed if isinstance(parsed, dict) else None


def check_endpoints(
    frontend_url: str,
    session_url: str,
    *,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> list[CheckResult]:
    frontend_url = frontend_url.rstrip("/")
    session_url = session_url.rstrip("/")
    results: list[CheckResult] = []

    frontend_status = _fetch_status(f"{frontend_url}/", timeout_seconds=timeout_seconds)
    results.append(
        CheckResult(
            name="frontend-root",
            ok=frontend_status == 200,
            detail=_status_text(f"{frontend_url}/", frontend_status),
        )
    )

    runtime_url = f"{frontend_url}/api/runtime/status"
    runtime_status, runtime_payload = _fetch_json(runtime_url, timeout_seconds=timeout_seconds)
    session_ws = runtime_payload.get("sessionWsUrl") if isinstance(runtime_payload, dict) else None
    has_session_ws = isinstance(session_ws, str) and bool(session_ws.strip())
    runtime_detail = _status_text(runtime_url, runtime_status)
    if runtime_status == 200 and not has_session_ws:
        runtime_detail += " without a sessionWsUrl"
    results.append(
        CheckResult(
            name="frontend-runtime-status",
            ok=runtime_status == 200 and has_session_ws,
            detail=runtime_detail,
        )
    )

    options_url = f"{session_url}/api/runtime-options"
    options_status, options_payload = _fetch_json(options_url, timeout_seconds=timeout_seconds)
    results.append(
        CheckResult(
            name="session-runtime-options",
            ok=options_status == 200 and isinstance(options_payload, dict),
            detail=_status_text(options_url, options_status),
        )
    )

    lessons_url = f"{session_url}/api/lessons"
    lessons_status = _fetch_status(lessons_url, timeout_seconds=timeout_seconds)
    results.append(
        CheckResult(
            name="session-lessons",
            ok=lessons_status in {200, 401, 403},
            detail=_status_text(lessons_url, lessons_status),
        )
    )

    return results


def _github_request(
    method: str,
    path: str,
    *,
    token: str,
    payload: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(
        f"{GITHUB_API_ROOT}{path}",
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with request.urlopen(req, timeout=DEFAULT_GITHUB_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8")
            return response.getcode(), json.loads(body) if body else None
    except error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8")
            return exc.code, json.loads(body) if body else None
        except (ValueError, OSError):
            return exc.code, None
    except (error.URLError, TimeoutError):
        return 0, None


def _open_alert_issue_numbers(repo: str, token: str) -> list[int] | None:
    """Return open tracking-issue numbers, or None when the lookup itself failed."""
    status, payload = _github_request(
        "GET", f"/repos/{repo}/issues?state=open&per_page=100", token=token
    )
    if status != 200 or not isinstance(payload, list):
        return None

    numbers: list[int] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        if "pull_request" in item:  # the issues endpoint also lists pull requests
            continue
        if str(item.get("title", "")).startswith(ALERT_TITLE_PREFIX):
            number = item.get("number")
            if isinstance(number, int):
                numbers.append(number)
    return numbers


def _failure_body(results: list[CheckResult]) -> str:
    failing_lines = [f"- `{result.name}`: {result.detail}" for result in results if not result.ok]
    return "\n".join(
        [
            f"The scheduled production health probe failed at {_utc_now_text()} for the canonical AI Math Tutor endpoints.",
            "",
            "Failing checks:",
            *failing_lines,
            "",
            "This issue was filed automatically by `scripts/production_health.py` via `.github/workflows/production-health.yml`.",
            "The next fully successful hourly probe closes it automatically.",
            "",
            "Remediation hints: inspect the Coolify apps `ai-math-tutor-web` and `ai-math-tutor-session` on server `vmi3203669`, and the Fast Coolify Deploy workflow runs.",
        ]
    )


def ensure_alert_issue(repo: str, token: str, results: list[CheckResult]) -> None:
    numbers = _open_alert_issue_numbers(repo, token)
    if numbers is None:
        print("production-health: warning: could not list open issues; skipping alert issue update")
        return
    if numbers:
        print(f"production-health: alert issue #{numbers[0]} already open")
        return

    title = f"{ALERT_TITLE_PREFIX} canonical endpoints failing ({_utc_now_text()})"
    status, payload = _github_request(
        "POST",
        f"/repos/{repo}/issues",
        token=token,
        payload={"title": title, "body": _failure_body(results)},
    )
    if status == 201 and isinstance(payload, dict):
        print(f"production-health: filed alert issue #{payload.get('number')}")
    else:
        print(f"production-health: warning: could not file alert issue (status {status})")


def resolve_alert_issues(repo: str, token: str, results: list[CheckResult]) -> None:
    numbers = _open_alert_issue_numbers(repo, token)
    if numbers is None:
        print("production-health: warning: could not list open issues; skipping alert issue update")
        return

    for number in numbers:
        comment = (
            f"All {len(results)} canonical production probes passed at {_utc_now_text()}. "
            "Closing this alert automatically; the hourly check remains active."
        )
        _github_request(
            "POST",
            f"/repos/{repo}/issues/{number}/comments",
            token=token,
            payload={"body": comment},
        )
        status, payload = _github_request(
            "PATCH",
            f"/repos/{repo}/issues/{number}",
            token=token,
            payload={"state": "closed"},
        )
        if status == 200 and isinstance(payload, dict):
            print(f"production-health: closed recovered alert issue #{number}")
        else:
            print(f"production-health: warning: could not close alert issue #{number} (status {status})")


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv and argv[0] == "--":
        argv = argv[1:]

    parser = argparse.ArgumentParser(
        description="Probe the canonical AI Math Tutor production endpoints."
    )
    parser.add_argument("--frontend-url", default=DEFAULT_FRONTEND_URL)
    parser.add_argument("--session-url", default=DEFAULT_SESSION_URL)
    parser.add_argument("--timeout-seconds", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument(
        "--manage-issue",
        action="store_true",
        help="File or close a production-health tracking issue through the GitHub API.",
    )
    parser.add_argument(
        "--github-repo",
        default=None,
        help="owner/name for --manage-issue (defaults to GITHUB_REPOSITORY).",
    )
    parser.add_argument(
        "--github-token",
        default=None,
        help="Token for --manage-issue (defaults to GITHUB_TOKEN).",
    )
    args = parser.parse_args(argv)

    results = check_endpoints(
        args.frontend_url, args.session_url, timeout_seconds=args.timeout_seconds
    )
    for result in results:
        status_word = "ok" if result.ok else "fail"
        print(f"production-health: {status_word} {result.name} -> {result.detail}")

    failures = [result for result in results if not result.ok]

    repo = args.github_repo or os.getenv("GITHUB_REPOSITORY") or ""
    token = args.github_token or os.getenv("GITHUB_TOKEN") or ""
    manage_issue = bool(args.manage_issue and repo and token)
    if args.manage_issue and not manage_issue:
        print(
            "production-health: warning: --manage-issue needs --github-repo/GITHUB_REPOSITORY "
            "and --github-token/GITHUB_TOKEN; skipping issue update"
        )

    if failures:
        print(f"production-health: {len(failures)}/{len(results)} checks failed")
        if manage_issue:
            ensure_alert_issue(repo, token, results)
        return 1

    print(f"production-health: all {len(results)} checks passed")
    if manage_issue:
        resolve_alert_issues(repo, token, results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
