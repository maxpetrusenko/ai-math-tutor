"""Guards the locked production Python dependency set.

Production images build with ``pip install -c constraints.txt .`` so image
builds cannot drift on floating ``pyproject.toml`` ranges. The lock is only
useful if it stays a pure pin set, covers every direct dependency, and is
actually applied by both Dockerfiles that ship the backend.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONSTRAINTS_PATH = ROOT / "constraints.txt"
PRODUCTION_DOCKERFILES = (
    ROOT / "backend" / "Dockerfile",
    ROOT / "backend" / "Dockerfile.worker",
)

PIN_LINE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*==[A-Za-z0-9][A-Za-z0-9.!+_-]*$")


def _normalize(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).strip().lower()


def _read_pins() -> dict[str, str]:
    pins: dict[str, str] = {}
    for raw_line in CONSTRAINTS_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        assert PIN_LINE_PATTERN.match(line), f"non-pin constraint line: {raw_line!r}"
        name, version = line.split("==", 1)
        pins[_normalize(name)] = version
    return pins


def test_constraints_file_is_a_pure_pin_set() -> None:
    assert CONSTRAINTS_PATH.exists(), "constraints.txt is required for production image builds"
    pins = _read_pins()
    assert len(pins) >= 50, f"suspiciously small lock set: {len(pins)} pins"


def test_constraints_cover_every_direct_dependency() -> None:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    pins = _read_pins()
    missing = []
    for dependency in project["project"]["dependencies"]:
        name = re.split(r"[<>=!~;\[ ]", dependency.strip(), maxsplit=1)[0]
        if _normalize(name) not in pins:
            missing.append(dependency)
    assert not missing, f"direct dependencies missing from constraints.txt: {missing}"


def test_production_dockerfiles_apply_the_constraints() -> None:
    for dockerfile in PRODUCTION_DOCKERFILES:
        text = dockerfile.read_text(encoding="utf-8")
        assert any(
            line.strip().startswith("COPY") and "constraints.txt" in line
            for line in text.splitlines()
        ), f"{dockerfile.name} must copy constraints.txt into the image"
        install_lines = [line for line in text.splitlines() if "pip install" in line]
        assert install_lines, f"{dockerfile.name} has no pip install command"
        assert all("-c constraints.txt" in line for line in install_lines), (
            f"{dockerfile.name} must apply constraints.txt on every pip install"
        )


def test_constraints_header_documents_regeneration() -> None:
    header = "\n".join(CONSTRAINTS_PATH.read_text(encoding="utf-8").splitlines()[:25])
    assert "uv pip compile" in header, "header must show the regeneration command"
    assert "x86_64-unknown-linux-gnu" in header, "header must name the lock target platform"
    assert "3.11" in header, "header must name the locked Python version"
    assert "bump" in header.lower(), "header must document the bump procedure"
