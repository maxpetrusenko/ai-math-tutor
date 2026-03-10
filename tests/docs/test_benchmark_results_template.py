from pathlib import Path


def test_benchmark_results_template_contains_required_sections() -> None:
    template = Path("docs/planning/benchmark-results-template.md").read_text()

    assert "Raw Event Log" in template
    assert "Summary Latency Table" in template
    assert "Kill Criteria Check" in template
    assert "Branch Recommendation" in template
