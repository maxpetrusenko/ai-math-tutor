from __future__ import annotations

import json
import os
import time
from urllib import error, parse, request

from backend.benchmarks.run_latency_benchmark import load_local_env
from backend.llm.response_policy import shape_tutor_response
from backend.monitoring.latency_tracker import LatencyTracker

GEMINI_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


class GeminiFallbackClient:
    provider_name = "gemini"

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker: LatencyTracker,
        first_token_ts_ms: float,
    ) -> dict[str, str]:
        live_api_key = self._resolve_api_key()
        if live_api_key:
            try:
                return self._stream_live_response(
                    messages=messages,
                    tracker=tracker,
                    speech_end_ts_ms=first_token_ts_ms,
                    api_key=live_api_key,
                )
            except Exception:
                pass

        if token_stream:
            tracker.mark("llm_first_token", first_token_ts_ms, {"provider": self.provider_name, "mode": "stub"})
        return {
            "provider": self.provider_name,
            "text": shape_tutor_response("".join(token_stream)),
            "input_messages": str(len(messages)),
        }

    def _stream_live_response(
        self,
        *,
        messages: list[dict[str, str]],
        tracker: LatencyTracker,
        speech_end_ts_ms: float,
        api_key: str,
    ) -> dict[str, str]:
        started_at = time.perf_counter()
        model = os.getenv("NERDY_RUNTIME_LLM_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL
        body = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": "\n\n".join(
                                f"{message['role'].upper()}: {message['content']}" for message in messages
                            ),
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 256,
            },
        }
        stream_url = (
            f"{GEMINI_STREAM_URL.format(model=model)}"
            f"?alt=sse&key={parse.quote(api_key)}"
        )
        try:
            response = request.urlopen(
                request.Request(
                    stream_url,
                    data=json.dumps(body).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                ),
                timeout=120,
            )
        except error.HTTPError as http_error:
            if http_error.code == 404 and model != DEFAULT_GEMINI_MODEL:
                os.environ["NERDY_RUNTIME_LLM_MODEL"] = DEFAULT_GEMINI_MODEL
                return self._stream_live_response(
                    messages=messages,
                    tracker=tracker,
                    speech_end_ts_ms=speech_end_ts_ms,
                    api_key=api_key,
                )
            raise

        text_parts: list[str] = []
        first_token_delta_ms: float | None = None
        with response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line.startswith("data:"):
                    continue
                payload = json.loads(line[5:].strip())
                text = _extract_gemini_text(payload)
                if not text:
                    continue
                if first_token_delta_ms is None:
                    first_token_delta_ms = round((time.perf_counter() - started_at) * 1000, 1)
                text_parts.append(text)

        if first_token_delta_ms is None:
            raise RuntimeError("Gemini did not emit a text chunk")

        tracker.mark(
            "llm_first_token",
            round(speech_end_ts_ms + first_token_delta_ms, 1),
            {"provider": self.provider_name, "mode": "live", "model": model},
        )
        text = shape_tutor_response("".join(text_parts))
        return {
            "provider": self.provider_name,
            "text": text,
            "input_messages": str(len(messages)),
            "model": model,
        }

    def _resolve_api_key(self) -> str:
        if os.getenv("NERDY_DISABLE_LIVE_LLM", "").strip() == "1":
            return ""
        load_local_env()
        return (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY") or "").strip()


def _extract_gemini_text(payload: dict[str, object]) -> str:
    texts: list[str] = []
    for candidate in payload.get("candidates", []):
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content", {})
        if not isinstance(content, dict):
            continue
        for part in content.get("parts", []):
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str):
                texts.append(text)
    return "".join(texts)
