# Wave 0 Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the benchmark harness and pedagogy eval pack that establish the event schema, canned prompts, fixed eval set, rubric, and repeatable scoring path.

**Architecture:** Start with a Python backend workspace because Wave 0 is backend and evaluation heavy. Define a stable latency event contract and Socratic scoring contract first, then use those artifacts as the contract layer for later session, LLM, TTS, and reporting work.

**Tech Stack:** Python 3.12, pytest, FastAPI-ready backend package layout, JSON fixtures, Markdown report templates

---

### Task 1: Initialize Python workspace

**Files:**
- Create: `pyproject.toml`
- Create: `backend/__init__.py`
- Create: `backend/benchmarks/__init__.py`
- Create: `backend/monitoring/__init__.py`
- Create: `tests/conftest.py`

**Step 1: Write the failing test**

Create `tests/test_workspace_layout.py` with assertions that backend packages import cleanly.

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_workspace_layout.py -q`
Expected: import or file-not-found failure

**Step 3: Write minimal implementation**

Add the package markers and project config needed for pytest discovery.

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_workspace_layout.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add pyproject.toml backend/__init__.py backend/benchmarks/__init__.py backend/monitoring/__init__.py tests/conftest.py tests/test_workspace_layout.py
git commit -m "build: initialize wave 0 python workspace"
```

### Task 2: Define latency event schema and tracker

**Files:**
- Create: `backend/monitoring/latency_tracker.py`
- Create: `tests/monitoring/test_latency_tracker.py`

**Step 1: Write the failing test**

Test that the tracker:
- accepts only known event names
- records timestamps and metadata
- computes stage durations and summary stats for benchmark runs

**Step 2: Run test to verify it fails**

Run: `pytest tests/monitoring/test_latency_tracker.py -q`
Expected: module or attribute failure

**Step 3: Write minimal implementation**

Implement a small tracker with:
- canonical event names from `docs/ARCHITECTURE.md`
- helpers for event records, stage deltas, and p50/p95 aggregation

**Step 4: Run test to verify it passes**

Run: `pytest tests/monitoring/test_latency_tracker.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/monitoring/latency_tracker.py tests/monitoring/test_latency_tracker.py
git commit -m "feat: add latency tracking primitives"
```

### Task 3: Build canned benchmark prompt fixtures

**Files:**
- Create: `backend/benchmarks/canned_prompts.json`
- Create: `tests/benchmarks/test_canned_prompts.py`

**Step 1: Write the failing test**

Test that the fixture file exists, contains at least 3 canonical prompts, and each prompt has subject, grade band, transcript, and expected tags.

**Step 2: Run test to verify it fails**

Run: `pytest tests/benchmarks/test_canned_prompts.py -q`
Expected: file-not-found or schema failure

**Step 3: Write minimal implementation**

Create the JSON fixture matching the docs eval prompts and benchmark gate needs.

**Step 4: Run test to verify it passes**

Run: `pytest tests/benchmarks/test_canned_prompts.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/benchmarks/canned_prompts.json tests/benchmarks/test_canned_prompts.py
git commit -m "test: add canned benchmark prompts"
```

### Task 4: Build the 30-run benchmark runner

**Files:**
- Create: `backend/benchmarks/run_latency_benchmark.py`
- Create: `tests/benchmarks/test_run_latency_benchmark.py`

**Step 1: Write the failing test**

Test that the runner:
- loads canned prompts
- executes 30 runs per prompt against a pluggable pipeline callable
- emits raw event logs and aggregated p50/p95 summaries
- computes pass/fail against kill criteria

**Step 2: Run test to verify it fails**

Run: `pytest tests/benchmarks/test_run_latency_benchmark.py -q`
Expected: module failure

**Step 3: Write minimal implementation**

Implement a benchmark runner with a fake-pipeline friendly interface and deterministic summary output.

**Step 4: Run test to verify it passes**

Run: `pytest tests/benchmarks/test_run_latency_benchmark.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/benchmarks/run_latency_benchmark.py tests/benchmarks/test_run_latency_benchmark.py
git commit -m "feat: add latency benchmark runner"
```

### Task 5: Add benchmark results template

**Files:**
- Create: `docs/planning/benchmark-results-template.md`
- Create: `tests/docs/test_benchmark_results_template.py`

**Step 1: Write the failing test**

Test that the template includes sections for raw event log, summary table, kill criteria, and branch recommendation.

**Step 2: Run test to verify it fails**

Run: `pytest tests/docs/test_benchmark_results_template.py -q`
Expected: file-not-found or missing text failure

**Step 3: Write minimal implementation**

Write the Markdown template matching `docs/EVAL.md` reporting requirements.

**Step 4: Run test to verify it passes**

Run: `pytest tests/docs/test_benchmark_results_template.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/planning/benchmark-results-template.md tests/docs/test_benchmark_results_template.py
git commit -m "docs: add benchmark results template"
```

### Task 6: Create the pedagogy eval fixtures and rubric

**Files:**
- Create: `eval/test_turns.json`
- Create: `eval/rubric.md`
- Create: `tests/eval/test_eval_fixtures.py`

**Step 1: Write the failing test**

Test that:
- `test_turns.json` contains math, science, and English tracks
- each test turn includes student utterance, grade band, expected concept, and rubric hooks
- `rubric.md` includes the six score dimensions and pass bars from `docs/EVAL.md`

**Step 2: Run test to verify it fails**

Run: `pytest tests/eval/test_eval_fixtures.py -q`
Expected: file-not-found or schema failure

**Step 3: Write minimal implementation**

Add the fixed evaluation dataset and rubric.

**Step 4: Run test to verify it passes**

Run: `pytest tests/eval/test_eval_fixtures.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add eval/test_turns.json eval/rubric.md tests/eval/test_eval_fixtures.py
git commit -m "feat: add pedagogy eval fixtures"
```

### Task 7: Implement Socratic scoring checks

**Files:**
- Create: `eval/socratic_checks.py`
- Create: `tests/eval/test_socratic_checks.py`

**Step 1: Write the failing test**

Test that scoring checks identify:
- tutor turns ending with a forward-moving question
- direct answer leakage
- encouragement markers
- grade-band language fit
- subject correctness hooks

**Step 2: Run test to verify it fails**

Run: `pytest tests/eval/test_socratic_checks.py -q`
Expected: module failure

**Step 3: Write minimal implementation**

Implement pure functions that score a tutor turn against the fixed rubric hooks.

**Step 4: Run test to verify it passes**

Run: `pytest tests/eval/test_socratic_checks.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add eval/socratic_checks.py tests/eval/test_socratic_checks.py
git commit -m "feat: add socratic scoring checks"
```

### Task 8: Verify Wave 0

**Files:**
- Modify: `progress.md`
- Modify: `task_plan.md`
- Modify: `findings.md`

**Step 1: Run focused tests**

Run: `pytest tests/test_workspace_layout.py tests/monitoring/test_latency_tracker.py tests/benchmarks/test_canned_prompts.py tests/benchmarks/test_run_latency_benchmark.py tests/docs/test_benchmark_results_template.py tests/eval/test_eval_fixtures.py tests/eval/test_socratic_checks.py -q`
Expected: PASS

**Step 2: Run full Python gate**

Run: `pytest -q`
Expected: PASS

**Step 3: Update planning files**

Record Wave 0 status, findings, and verification results.

**Step 4: Commit**

```bash
git add progress.md task_plan.md findings.md
git commit -m "docs: record wave 0 execution status"
```
