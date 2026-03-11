from types import SimpleNamespace

from eval.langchain_golden_eval import evaluate_golden_cases, load_golden_cases


def test_langchain_golden_cases_match_expected_draft_outputs() -> None:
    cases = load_golden_cases("eval/fixtures/langchain_golden_turns.json")

    assert len(cases) == 3

    results = evaluate_golden_cases(cases, provider="draft")

    assert all(result["passed"] for result in results)
    assert all(result["matches_expected_reply"] for result in results)
    assert results[0]["scores"]["Socratic questioning"] >= 4
    assert results[1]["scores"]["Correctness"] >= 4
    assert results[2]["scores"]["Direct-answer avoidance"] >= 4


def test_langchain_golden_cases_support_live_openai_provider(monkeypatch) -> None:
    class _FakeChatOpenAI:
        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs

        def invoke(self, messages):
            del messages
            return SimpleNamespace(content="Let's work on 2+2. What total do you get when you add 2 and 2?")

    monkeypatch.setattr("eval.langchain_golden_eval.load_local_env", lambda: [])
    monkeypatch.setattr("eval.langchain_golden_eval.ChatOpenAI", _FakeChatOpenAI)

    results = evaluate_golden_cases(
        load_golden_cases("eval/fixtures/langchain_golden_turns.json")[:1],
        provider="openai",
        model="gpt-4.1-mini",
    )

    assert results[0]["provider"] == "openai"
    assert results[0]["passed"] is True
