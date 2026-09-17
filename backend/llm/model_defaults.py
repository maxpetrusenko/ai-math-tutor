"""Default model ids for runtime-selectable providers.

Kept free of provider SDK imports: boot-path modules such as
``backend.session.runtime_options`` read these model names without pulling the
LangChain provider stacks into process startup. The SDKs load on demand when a
live model is constructed.
"""

from __future__ import annotations

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-0"
DEFAULT_CARTESIA_MODEL = "sonic-2"
DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
