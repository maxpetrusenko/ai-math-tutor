from __future__ import annotations

import logging

from backend.llm.langchain_chat_client import BaseLangChainChatClient
from langchain_openai import ChatOpenAI

DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
logger = logging.getLogger(__name__)


class OpenAIClient(BaseLangChainChatClient):
    provider_name = "openai"
    default_model = DEFAULT_OPENAI_MODEL
    api_key_env_names = ("OPENAI_API_KEY",)

    def __init__(self) -> None:
        super().__init__(logger=logger)

    def _build_chat_model(self, *, model: str, api_key: str) -> ChatOpenAI:
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            temperature=0.4,
            max_completion_tokens=256,
            timeout=self._request_timeout_seconds(),
        )
