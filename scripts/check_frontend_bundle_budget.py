from __future__ import annotations

import argparse
import gzip
import json
from dataclasses import dataclass
from pathlib import Path

DEFAULT_ROUTE_BUDGET_BYTES = 150 * 1024
ROUTE_BUDGET_BYTES = {
    "/session/page": 280 * 1024,
}


@dataclass(frozen=True)
class BundleBudgetViolation:
    route: str
    gzip_bytes: int
    budget_bytes: int


def _gzip_size(path: Path) -> int:
    return len(gzip.compress(path.read_bytes(), compresslevel=9))


def _route_budget(route: str, budgets: dict[str, int]) -> int:
    return budgets.get(route, DEFAULT_ROUTE_BUDGET_BYTES)


def check_bundle_budgets(build_dir: Path, budgets: dict[str, int] | None = None) -> list[BundleBudgetViolation]:
    budgets = budgets or ROUTE_BUDGET_BYTES
    manifest_path = build_dir / "app-build-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    pages = manifest.get("pages")
    if not isinstance(pages, dict):
        raise ValueError(f"Invalid app build manifest: {manifest_path}")

    violations: list[BundleBudgetViolation] = []
    for route, files in sorted(pages.items()):
        if not isinstance(files, list):
            continue
        gzip_bytes = 0
        for file_name in files:
            if not isinstance(file_name, str) or not file_name.endswith((".js", ".css")):
                continue
            asset_path = build_dir / file_name
            if asset_path.exists():
                gzip_bytes += _gzip_size(asset_path)
        budget_bytes = _route_budget(route, budgets)
        if gzip_bytes > budget_bytes:
            violations.append(BundleBudgetViolation(route, gzip_bytes, budget_bytes))
    return violations


def format_bytes(value: int) -> str:
    return f"{value / 1024:.1f} KiB"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fail when frontend route bundles exceed production budgets.")
    parser.add_argument(
        "--build-dir",
        type=Path,
        default=Path("frontend/.next"),
        help="Next.js build directory containing app-build-manifest.json",
    )
    args = parser.parse_args(argv)

    violations = check_bundle_budgets(args.build_dir)
    if not violations:
        print(
            "bundle-budget: ok "
            f"default={format_bytes(DEFAULT_ROUTE_BUDGET_BYTES)} "
            + " ".join(f"{route}={format_bytes(budget)}" for route, budget in sorted(ROUTE_BUDGET_BYTES.items()))
        )
        return 0

    print("bundle-budget: failed")
    for violation in violations:
        print(
            f"bundle-budget: {violation.route} is {format_bytes(violation.gzip_bytes)} "
            f"> budget {format_bytes(violation.budget_bytes)}"
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
