from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.prompt_values import ChatPromptValue


def build_langchain_prompt_value(messages: list[dict[str, str]]) -> ChatPromptValue:
    return ChatPromptValue(messages=[_to_langchain_message(message) for message in messages])


def summarize_langchain_llm_input(
    messages: list[dict[str, str]],
    *,
    model: str,
) -> dict[str, Any]:
    prompt_value = build_langchain_prompt_value(messages)
    return {
        "model": model,
        "message_count": len(prompt_value.messages),
        "messages": [
            {
                "type": message.type,
                "content": _stringify_content(message.content),
            }
            for message in prompt_value.messages
        ],
        "prompt_text": prompt_value.to_string(),
    }


def summarize_langchain_llm_output(result: dict[str, str] | str) -> dict[str, Any]:
    if isinstance(result, str):
        text = result
        provider = "unknown"
        model = ""
    else:
        text = str(result.get("text") or "")
        provider = str(result.get("provider") or "unknown")
        model = str(result.get("model") or "")

    message = AIMessage(content=text)
    return {
        "provider": provider,
        "model": model,
        "text": text,
        "message": {
            "type": message.type,
            "content": _stringify_content(message.content),
        },
    }


def _to_langchain_message(message: dict[str, str]) -> SystemMessage | HumanMessage | AIMessage:
    role = str(message.get("role") or "user").strip().lower()
    content = str(message.get("content") or "")
    if role == "system":
        return SystemMessage(content=content)
    if role == "assistant":
        return AIMessage(content=content)
    return HumanMessage(content=content)


def _stringify_content(content: object) -> str:
    if isinstance(content, str):
        return content
    return str(content)
