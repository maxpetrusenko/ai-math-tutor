"""Guards the locked production Python dependency set.

Production images build with ``pip install -c constraints.txt .`` so image
builds cannot drift on floating ``pyproject.toml`` ranges. The lock is only
useful if it stays a pure pin set, keeps satisfying every direct dependency's
version range, and is actually applied by both Dockerfiles that ship the
backend.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

from packaging.specifiers import SpecifierSet
from packaging.version import Version

ROOT = Path(__file__).resolve().parents[2]
CONSTRAINTS_PATH = ROOT / "constraints.txt"
PRODUCTION_DOCKERFILES = (
    ROOT / "backend" / "Dockerfile",
    ROOT / "backend" / "Dockerfile.worker",
)

PIN_LINE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*==[A-Za-z0-9][A-Za-z0-9.!+_-]*$")
PROJECT_INSTALL_PATTERN = re.compile(r"(^|\s)\.(\s|\\|$)")


def _normalize(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).strip().lower()


def _split_dependency(dependency: str) -> tuple[str, str]:
    match = re.match(r"^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(.*)$", dependency.strip())
    if match is None:
        raise AssertionError(f"unparsable dependency in pyproject.toml: {dependency!r}")
    return match.group(1), match.group(2).strip()


def _read_pins() -> dict[str, str]:
    pins: dict[str, str] = {}
    for raw_line in CONSTRAINTS_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if not PIN_LINE_PATTERN.match(line):
            raise AssertionError(f"non-pin constraint line: {raw_line!r}")
        name, version = line.split("==", 1)
        normalized = _normalize(name)
        if normalized in pins:
            raise AssertionError(f"duplicate constraint for {normalized}")
        pins[normalized] = version
    return pins


def test_constraints_file_is_a_pure_pin_set() -> None:
    assert CONSTRAINTS_PATH.exists(), "constraints.txt is required for production image builds"
    pins = _read_pins()
    assert len(pins) >= 50, f"suspiciously small lock set: {len(pins)} pins"


def test_constraints_pins_still_satisfy_direct_dependencies() -> None:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    pins = _read_pins()
    missing: list[str] = []
    out_of_range: list[str] = []
    for dependency in project["project"]["dependencies"]:
        name, specifier = _split_dependency(dependency)
        pinned = pins.get(_normalize(name))
        if pinned is None:
            missing.append(dependency)
            continue
        if not SpecifierSet(specifier).contains(Version(pinned)):
            out_of_range.append(f"{name}=={pinned} violates {specifier!r}")
    assert not missing, f"direct dependencies missing from constraints.txt: {missing}"
    assert not out_of_range, f"stale constraints.txt pins (regenerate the lock): {out_of_range}"


def _pip_install_commands(text: str) -> list[str]:
    """Extract pip-install command segments, whether inline or on continuation lines."""

    commands: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("RUN "):
            line = line[len("RUN ") :]
        for segment in re.split(r"&&|;", line):
            segment = segment.strip().rstrip("\\").strip()
            if segment.startswith("pip install"):
                commands.append(segment)
    return commands


def test_production_dockerfiles_apply_the_constraints() -> None:
    for dockerfile in PRODUCTION_DOCKERFILES:
        text = dockerfile.read_text(encoding="utf-8")
        lines = [line.strip() for line in text.splitlines()]
        assert "WORKDIR /app" in lines, (
            f"{dockerfile.name} must keep WORKDIR /app for the relative constraints path"
        )
        assert any(
            line.startswith("COPY") and "constraints.txt" in line for line in lines
        ), f"{dockerfile.name} must copy constraints.txt into the image"
        commands = _pip_install_commands(text)
        assert commands, f"{dockerfile.name} has no pip install command"
        project_installs = [line for line in commands if PROJECT_INSTALL_PATTERN.search(line)]
        assert project_installs, f"{dockerfile.name} never installs the local project"
        for line in project_installs:
            assert "-c constraints.txt" in line, (
                f"{dockerfile.name} must apply constraints.txt when installing the project: {line!r}"
            )


def test_constraints_header_documents_regeneration() -> None:
    header = "\n".join(CONSTRAINTS_PATH.read_text(encoding="utf-8").splitlines()[:25])
    assert "uv pip compile" in header, "header must show the regeneration command"
    assert "x86_64-unknown-linux-gnu" in header, "header must name the lock target platform"
    assert "3.11" in header, "header must name the locked Python version"
    assert "bump" in header.lower(), "header must document the bump procedure"
