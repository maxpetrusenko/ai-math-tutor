from __future__ import annotations

import argparse
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from backend.ai.call_logging import run_logged_ai_call
from backend.benchmarks.run_latency_benchmark import load_local_env
from backend.llm.draft_policy import build_draft_tutor_reply
from backend.llm.langchain_bridge import build_langchain_prompt_value, summarize_langchain_llm_input
from backend.llm.prompt_builder import build_tutor_messages
from eval.socratic_checks import score_tutor_turn
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)
GoldenProvider = Literal["draft", "gemini", "openai"]


@dataclass(frozen=True, slots=True)
class GoldenCase:
    id: str
    subject: str
    grade_band: str
    latest_student_text: str
    history: list[dict[str, str]]
    student_profile: dict[str, str]
    expected_concept: str
    expected_prompt_contains: list[str]
    expected_reply: str


def load_golden_cases(path: str) -> list[GoldenCase]:
    payload = json.loads(Path(path).read_text())
    return [GoldenCase(**case) for case in payload["cases"]]


def evaluate_golden_cases(
    cases: list[GoldenCase],
    *,
    provider: GoldenProvider = "draft",
    model: str = "gemini-2.5-flash",
) -> list[dict[str, object]]:
    return [evaluate_golden_case(case, provider=provider, model=model) for case in cases]


def evaluate_golden_case(
    case: GoldenCase,
    *,
    provider: GoldenProvider = "draft",
    model: str = "gemini-2.5-flash",
) -> dict[str, object]:
    messages = build_tutor_messages(
        subject=case.subject,
        grade_band=case.grade_band,
        latest_student_text=case.latest_student_text,
        history=case.history,
        student_profile=case.student_profile,
    )
    prompt_value = build_langchain_prompt_value(messages)
    reply = _generate_reply(case, provider=provider, model=model, messages=messages)
    scores = score_tutor_turn(reply, expected_concept=case.expected_concept, grade_band=case.grade_band)
    prompt_checks = all(fragment in prompt_value.to_string() for fragment in case.expected_prompt_contains)
    matches_expected_reply = reply == case.expected_reply
    exact_match_required = provider == "draft"

    return {
        "case_id": case.id,
        "exact_match_required": exact_match_required,
        "provider": provider,
        "prompt_checks_passed": prompt_checks,
        "matches_expected_reply": matches_expected_reply,
        "passed": prompt_checks and all(score >= 3 for score in scores.values()) and (matches_expected_reply or not exact_match_required),
        "reply": reply,
        "scores": scores,
    }


def _generate_reply(
    case: GoldenCase,
    *,
    provider: GoldenProvider,
    model: str,
    messages: list[dict[str, str]],
) -> str:
    if provider == "draft":
        return build_draft_tutor_reply(
            subject=case.subject,
            grade_band=case.grade_band,
            latest_student_text=case.latest_student_text,
            student_profile=case.student_profile,
            history=case.history,
        )

    if provider == "gemini":
        load_local_env()
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(model=model, temperature=0.4, max_output_tokens=256)
        prompt_value = build_langchain_prompt_value(messages)
        response = run_logged_ai_call(
            logger=logger,
            provider="gemini",
            operation="langchain.invoke",
            request_payload=summarize_langchain_llm_input(messages, model=model),
            call=lambda: llm.invoke(prompt_value.messages),
            response_summarizer=lambda message: {"content": str(message.content)},
            langsmith_project="nerdy-golden-evals",
            langsmith_run_type="llm",
        )
        return str(response.content).strip()

    if provider != "openai":
        raise ValueError(f"unsupported golden provider: {provider}")

    load_local_env()
    llm = ChatOpenAI(model=model, temperature=0.4, max_tokens=256)
    prompt_value = build_langchain_prompt_value(messages)
    response = run_logged_ai_call(
        logger=logger,
        provider="openai",
        operation="langchain.invoke",
        request_payload=summarize_langchain_llm_input(messages, model=model),
        call=lambda: llm.invoke(prompt_value.messages),
        response_summarizer=lambda message: {"content": str(message.content)},
        langsmith_project="nerdy-golden-evals",
        langsmith_run_type="llm",
    )
    return str(response.content).strip()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run LangChain-backed golden tutor evals.")
    parser.add_argument(
        "--fixture",
        default="eval/fixtures/langchain_golden_turns.json",
        help="path to golden fixture file",
    )
    parser.add_argument(
        "--provider",
        choices=("draft", "gemini", "openai"),
        default="draft",
        help="draft is deterministic and free; gemini/openai use live LangChain models",
    )
    parser.add_argument(
        "--model",
        default="gemini-2.5-flash",
        help="live LangChain model name for the selected provider",
    )
    args = parser.parse_args(argv)

    results = evaluate_golden_cases(load_golden_cases(args.fixture), provider=args.provider, model=args.model)
    print(json.dumps(results, indent=2))
    return 0 if all(result["passed"] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
