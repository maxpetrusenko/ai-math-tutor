from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "scripts" / "check_frontend_bundle_budget.py"


def load_budget_module():
    spec = importlib.util.spec_from_file_location("check_frontend_bundle_budget", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_bundle_fixture(tmp_path: Path, payload_bytes: int) -> Path:
    build_dir = tmp_path / "frontend" / ".next"
    chunk_dir = build_dir / "static" / "chunks" / "app" / "session"
    chunk_dir.mkdir(parents=True)
    chunk_path = chunk_dir / "page.js"
    chunk_path.write_bytes(bytes((index * 131 + 17) % 256 for index in range(payload_bytes)))
    (build_dir / "app-build-manifest.json").write_text(
        json.dumps({"pages": {"/session/page": ["static/chunks/app/session/page.js"]}}),
        encoding="utf-8",
    )
    return build_dir


def test_bundle_budget_reports_routes_over_gzip_budget(tmp_path: Path) -> None:
    budget = load_budget_module()
    build_dir = write_bundle_fixture(tmp_path, payload_bytes=8_192)

    violations = budget.check_bundle_budgets(build_dir, {"/session/page": 64})

    assert len(violations) == 1
    assert violations[0].route == "/session/page"
    assert violations[0].budget_bytes == 64
    assert violations[0].gzip_bytes > 64


def test_bundle_budget_passes_routes_under_gzip_budget(tmp_path: Path) -> None:
    budget = load_budget_module()
    build_dir = write_bundle_fixture(tmp_path, payload_bytes=128)

    assert budget.check_bundle_budgets(build_dir, {"/session/page": 1024}) == []


def test_root_build_runs_frontend_bundle_budget_gate() -> None:
    package_json = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))

    assert "python3 scripts/check_frontend_bundle_budget.py" in package_json["scripts"]["build"]
