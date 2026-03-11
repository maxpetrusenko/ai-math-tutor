from __future__ import annotations

from backend.llm.anthropic_client import AnthropicClient
from backend.providers.base import BaseLLMProvider
from backend.providers.registry import ProviderRegistry


@ProviderRegistry.register_llm
class AnthropicProvider(BaseLLMProvider):
    provider_name = "anthropic"

    def __init__(self) -> None:
        self._client = AnthropicClient()

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker,
        first_token_ts_ms: float,
        options: dict[str, str] | None = None,
    ) -> dict[str, str]:
        return self._client.stream_response(
            messages=messages,
            token_stream=token_stream,
            tracker=tracker,
            first_token_ts_ms=first_token_ts_ms,
            options=options,
        )
