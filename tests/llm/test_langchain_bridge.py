from backend.llm.langchain_bridge import (
    build_langchain_prompt_value,
    summarize_langchain_llm_input,
    summarize_langchain_llm_output,
)


def test_build_langchain_prompt_value_preserves_roles_and_text() -> None:
    messages = [
        {"role": "system", "content": "You are a tutor."},
        {"role": "assistant", "content": "What equation are you working with?"},
        {"role": "user", "content": "2x + 4 = 10"},
    ]

    prompt_value = build_langchain_prompt_value(messages)

    assert [message.type for message in prompt_value.messages] == ["system", "ai", "human"]
    assert "You are a tutor." in prompt_value.to_string()
    assert "2x + 4 = 10" in prompt_value.to_string()


def test_langchain_bridge_summarizes_input_and_output() -> None:
    messages = [
        {"role": "system", "content": "You are a tutor."},
        {"role": "user", "content": "What about photosynthesis?"},
    ]

    input_summary = summarize_langchain_llm_input(messages, model="gemini-2.5-flash")
    output_summary = summarize_langchain_llm_output(
        {
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "text": "Good question. What do plants use from light to start making food?",
        }
    )

    assert input_summary["model"] == "gemini-2.5-flash"
    assert input_summary["message_count"] == 2
    assert input_summary["messages"][1]["type"] == "human"
    assert output_summary["message"]["type"] == "ai"
    assert "plants use from light" in output_summary["message"]["content"]
