from __future__ import annotations

import sys
from pathlib import Path

# Keep repo-root imports available under pytest's importlib collection mode.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
