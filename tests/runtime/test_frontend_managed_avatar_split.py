"""Guard the /session bundle split: the managed avatar session (which pulls
livekit-client, ~107 kB gzip) must stay a lazily loaded chunk so the default
local-avatar session path never downloads it.

Source-level guard because the behavioral proof (a smaller First Load JS in the
built output) needs a full `next build`; these checks fail fast on the exact
regression that would silently re-bundle livekit-client into /session.

Covers the static reference shapes that can re-bundle a module: value imports
(including side-effect imports like `import "../ManagedAvatarSession";`) and
value re-exports (`export { X } from "..."`). Type-only references are ignored
because they are erased at compile time and cannot pull a module into the
bundle.
"""

from __future__ import annotations

import re
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
STAGE = FRONTEND / "components" / "session" / "TutorSessionAvatarStage.tsx"

PROD_ROOTS = (FRONTEND / "components", FRONTEND / "lib", FRONTEND / "app")
MANAGED_SESSION_MODULE = "components/ManagedAvatarSession.tsx"

# import { X } from "m";  import X, { Y } from "m";  import * as ns from "m"
STATIC_IMPORT_RE = re.compile(
    r"^\s*import(?!\s+type\b)[^;]*from\s*[\"'](?P<module>[^\"']+)[\"']",
    re.MULTILINE,
)
# side-effect import:  import "m";
SIDE_EFFECT_IMPORT_RE = re.compile(
    r"^\s*import\s+[\"'](?P<module>[^\"']+)[\"']",
    re.MULTILINE,
)
# value re-export:  export { X } from "m";  export * from "m";
VALUE_REEXPORT_RE = re.compile(
    r"^\s*export(?!\s+type\b)[^;]*from\s*[\"'](?P<module>[^\"']+)[\"']",
    re.MULTILINE,
)

_STATIC_REFERENCE_RES = (STATIC_IMPORT_RE, SIDE_EFFECT_IMPORT_RE, VALUE_REEXPORT_RE)


def _production_sources():
    for root in PROD_ROOTS:
        for path in sorted(root.rglob("*.ts*")):
            if ".test." in path.name:
                continue
            yield path


def _matches_module(match: re.Match[str], needle: str) -> bool:
    imported_from = match.group("module")
    return imported_from == needle or imported_from.endswith(f"/{needle}")


def _static_value_imports_of(path: Path, needle: str) -> bool:
    source = path.read_text(encoding="utf-8")
    for regex in _STATIC_REFERENCE_RES:
        for match in regex.finditer(source):
            if _matches_module(match, needle):
                return True
    return False


def test_stage_lazy_loads_managed_avatar_session():
    source = STAGE.read_text(encoding="utf-8")

    assert "React.lazy(" in source, (
        "TutorSessionAvatarStage must lazy-load the managed avatar session so "
        "livekit-client stays out of the default /session first load"
    )
    assert 'import("../ManagedAvatarSession")' in source, (
        "the managed avatar session must be pulled in through a dynamic import "
        "so it becomes its own async chunk"
    )
    assert not _static_value_imports_of(STAGE, "ManagedAvatarSession"), (
        "a static value import of ManagedAvatarSession would put livekit-client "
        "back into the /session first load; keep it behind React.lazy"
    )


def test_livekit_client_is_only_statically_imported_by_the_managed_session():
    offenders = []
    for path in _production_sources():
        rel = path.relative_to(FRONTEND).as_posix()
        if rel == MANAGED_SESSION_MODULE:
            continue
        source = path.read_text(encoding="utf-8")
        for regex in _STATIC_REFERENCE_RES:
            for match in regex.finditer(source):
                if match.group("module") != "livekit-client":
                    continue
                offenders.append(f"{rel}:{source[:match.start()].count(chr(10)) + 1}")
    assert not offenders, (
        "livekit-client may only be statically imported by "
        f"{MANAGED_SESSION_MODULE} (the lazy chunk); found: {offenders}"
    )


def test_only_the_stage_reaches_the_managed_session_module_at_runtime():
    offenders = []
    for path in _production_sources():
        rel = path.relative_to(FRONTEND).as_posix()
        if rel == MANAGED_SESSION_MODULE:
            continue
        if _static_value_imports_of(path, "ManagedAvatarSession"):
            offenders.append(rel)
    assert not offenders, (
        "ManagedAvatarSession must only be reachable through the stage's lazy "
        f"import (type-only references are fine); static references found: {offenders}"
    )
