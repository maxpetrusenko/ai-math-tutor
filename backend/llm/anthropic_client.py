from __future__ import annotations

import logging

from backend.llm.langchain_chat_client import BaseLangChainChatClient
from langchain_anthropic import ChatAnthropic

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-0"
logger = logging.getLogger(__name__)


class AnthropicClient(BaseLangChainChatClient):
    provider_name = "anthropic"
    default_model = DEFAULT_ANTHROPIC_MODEL
    api_key_env_names = ("ANTHROPIC_API_KEY",)

    def __init__(self) -> None:
        super().__init__(logger=logger)

    def _build_chat_model(self, *, model: str, api_key: str) -> ChatAnthropic:
        return ChatAnthropic(
            model_name=model,
            api_key=api_key,
            temperature=0.4,
            max_tokens_to_sample=256,
            timeout=self._request_timeout_seconds(),
        )
