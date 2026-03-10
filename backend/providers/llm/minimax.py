from __future__ import annotations

from backend.providers.base import BaseLLMProvider
from backend.providers.registry import ProviderRegistry
from backend.llm.minimax_client import MiniMaxClient

@ProviderRegistry.register_llm
class MiniMaxProvider(BaseLLMProvider):
    """MiniMax LLM provider wrapper."""

    provider_name = "minimax"

    def __init__(self) -> None:
        self._client = MiniMaxClient()

    def stream_response(
        self,
        messages: list[dict[str, str]],
        token_stream: list[str],
        tracker,
        first_token_ts_ms: float,
    ) -> dict[str, str]:
        return self._client.stream_response(
            messages=messages,
            token_stream=token_stream,
            tracker=tracker,
            first_token_ts_ms=first_token_ts_ms,
        )
