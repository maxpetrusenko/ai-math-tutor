from __future__ import annotations


_ENCOURAGEMENT_MARKERS = ("nice", "good", "great", "strong start", "good thinking")
_DIRECT_ANSWER_MARKERS = ("the answer is", "it's ", "it is ", "=")
_CONCEPT_KEYWORDS = {
    "linear equations": ("x", "equation", "side"),
    "photosynthesis basics": ("photosynthesis", "plant", "light", "energy"),
    "subject-verb agreement": ("subject", "verb", "sentence", "agree", "disagree"),
}
_ADVANCED_VOCAB = ("identify", "disagree", "relationship", "coefficient")


def score_tutor_turn(tutor_text: str, expected_concept: str, grade_band: str) -> dict[str, int]:
    lowered = tutor_text.lower()
    ends_with_question = tutor_text.strip().endswith("?")
    encouragement = any(marker in lowered for marker in _ENCOURAGEMENT_MARKERS)
    direct_answer = any(marker in lowered for marker in _DIRECT_ANSWER_MARKERS)
    concept_match = any(keyword in lowered for keyword in _CONCEPT_KEYWORDS.get(expected_concept, ()))
    advanced_vocab = any(word in lowered for word in _ADVANCED_VOCAB)

    scores = {
        "Socratic questioning": 5 if ends_with_question else 2,
        "Scaffolding quality": 4 if ends_with_question else 2,
        "Direct-answer avoidance": 1 if direct_answer else 5,
        "Correctness": 4 if concept_match else 3,
        "Grade fit": _score_grade_fit(grade_band, advanced_vocab),
        "Encouragement": 4 if encouragement else 3,
    }
    return scores


def _score_grade_fit(grade_band: str, advanced_vocab: bool) -> int:
    if grade_band == "11-12":
        return 5 if advanced_vocab else 4
    if grade_band == "9-10":
        return 4
    return 3 if advanced_vocab else 5
