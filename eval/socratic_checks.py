from __future__ import annotations


_ENCOURAGEMENT_MARKERS = ("nice", "good", "great", "strong start", "good thinking", "exactly", "you got it")
_DIRECT_ANSWER_MARKERS = ("the answer is", "it's ", "it is ", "=")
_BLURT_ANSWER_PHRASES = ("the answer is", "x = ", "equals")
_GENTLE_REDIRECT_MARKERS = ("actually", "not quite", "close", "common mistake")
_CONCEPT_KEYWORDS = {
    "linear equations": ("x", "equation", "side", "subtract", "divide", "isolate"),
    "photosynthesis basics": ("photosynthesis", "plant", "light", "energy", "co2", "oxygen", "glucose"),
    "subject-verb agreement": ("subject", "verb", "sentence", "agree", "disagree", "singular", "plural"),
}
_ADVANCED_VOCAB = ("identify", "disagree", "relationship", "coefficient", "convert", "produces")


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


def score_multi_turn_lesson(
    turns: list[dict],
    expected_concept: str,
    grade_band: str,
) -> dict[str, int]:
    """Score a multi-turn lesson on Socratic quality and lesson arc.

    Args:
        turns: List of turn dicts with student_utterance, tutor_response, turn_goal, student_outcome
        expected_concept: The concept being taught
        grade_band: Grade band for grading fit

    Returns:
        Dict of dimension scores (1-5 scale)
    """
    if not turns:
        return {
            "Socratic quality": 1,
            "Follow-up continuity": 1,
            "Topical relevance": 1,
            "Grade fit": 1,
            "Lesson arc": 1,
            "Correction style": 1,
        }

    question_count = 0
    encouragement_count = 0
    gentle_redirect_count = 0
    blurt_count = 0
    concept_mentions = 0
    topic_match_count = 0
    topic_mismatch_count = 0

    for turn in turns:
        student_text = turn.get("student_utterance", "")
        tutor_text = turn.get("tutor_response", "")
        lowered = tutor_text.lower()

        # Count Socratic questions
        if tutor_text.strip().endswith("?"):
            question_count += 1

        # Count encouragement
        if any(marker in lowered for marker in _ENCOURAGEMENT_MARKERS):
            encouragement_count += 1

        # Count gentle redirects for incorrect answers
        if turn.get("student_outcome") == "incorrect":
            if any(marker in lowered for marker in _GENTLE_REDIRECT_MARKERS):
                gentle_redirect_count += 1
            # Check for blurting the answer
            if any(phrase in lowered for phrase in _BLURT_ANSWER_PHRASES) and not "?" in tutor_text:
                blurt_count += 1

        # Count concept mentions
        if any(keyword in lowered for keyword in _CONCEPT_KEYWORDS.get(expected_concept, ())):
            concept_mentions += 1

        student_topic = _infer_eval_topic(student_text)
        tutor_topic = _infer_eval_topic(tutor_text)
        if student_topic is not None and tutor_topic is not None:
            if student_topic == tutor_topic:
                topic_match_count += 1
            else:
                topic_mismatch_count += 1

    # Calculate scores
    total_turns = len(turns)
    socratic_ratio = question_count / total_turns if total_turns else 0
    encouragement_ratio = encouragement_count / total_turns if total_turns else 0

    # Socratic quality: mostly questions, high encouragement
    socratic_quality = 1
    if socratic_ratio >= 0.8 and encouragement_ratio >= 0.6:
        socratic_quality = 5
    elif socratic_ratio >= 0.6 and encouragement_ratio >= 0.4:
        socratic_quality = 4
    elif socratic_ratio >= 0.4:
        socratic_quality = 3
    elif socratic_ratio >= 0.2:
        socratic_quality = 2

    # Follow-up continuity: concept mentioned across turns, builds progressively
    continuity_score = 1
    if concept_mentions >= total_turns - 1:
        continuity_score = 5
    elif concept_mentions >= total_turns / 2:
        continuity_score = 4
    elif concept_mentions >= 2:
        continuity_score = 3
    elif concept_mentions >= 1:
        continuity_score = 2

    topical_relevance = 3
    if topic_mismatch_count == 0 and topic_match_count >= max(1, total_turns - 1):
        topical_relevance = 5
    elif topic_mismatch_count == 0 and topic_match_count >= 1:
        topical_relevance = 4
    elif topic_mismatch_count >= max(1, total_turns // 2):
        topical_relevance = 1 if topic_match_count == 0 else 2

    # Grade fit
    advanced_vocab = any(
        any(word in turn.get("tutor_response", "").lower() for word in _ADVANCED_VOCAB)
        for turn in turns
    )
    grade_fit = _score_grade_fit(grade_band, advanced_vocab)

    # Lesson arc: should progress from diagnose → guide → practice → verify → reflect
    goals = [turn.get("turn_goal", "") for turn in turns]
    expected_progression = ["diagnose", "guide", "practice", "verify", "reflect"]
    actual_progression = [g for g in goals if g in expected_progression]

    arc_score = 1
    if len(actual_progression) >= 4:
        # Check if goals are in reasonable order
        is_ordered = all(
            expected_progression.index(g1) <= expected_progression.index(g2)
            for g1, g2 in zip(actual_progression, actual_progression[1:])
            if g1 in expected_progression and g2 in expected_progression
        )
        if is_ordered:
            arc_score = 5
        else:
            arc_score = 4
    elif len(actual_progression) >= 3:
        arc_score = 3
    elif len(actual_progression) >= 2:
        arc_score = 2

    # Correction style: gentle redirects preferred over blurting answers
    correction_score = 5
    if blurt_count > 0:
        correction_score = 1
    elif gentle_redirect_count > 0:
        correction_score = 5
    else:
        # No incorrect answers to correct, neutral score
        correction_score = 4

    return {
        "Socratic quality": socratic_quality,
        "Follow-up continuity": continuity_score,
        "Topical relevance": topical_relevance,
        "Grade fit": grade_fit,
        "Lesson arc": arc_score,
        "Correction style": correction_score,
    }


def _infer_eval_topic(text: str) -> str | None:
    lowered = text.lower()
    if "x" in lowered or "equation" in lowered or "subtract" in lowered or "divide" in lowered:
        return "algebra"
    if any(keyword in lowered for keyword in _CONCEPT_KEYWORDS["photosynthesis basics"]):
        return "photosynthesis"
    if any(keyword in lowered for keyword in _CONCEPT_KEYWORDS["subject-verb agreement"]):
        return "grammar"
    if any(symbol in lowered for symbol in ("+", "-", "*", "/")) and any(char.isdigit() for char in lowered):
        return "arithmetic"
    return None
