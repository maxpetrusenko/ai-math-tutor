from __future__ import annotations

from backend.providers.base import BaseAvatarProvider
from backend.providers.registry import ProviderRegistry


@ProviderRegistry.register_avatar
class TalkingHeadAvatarProvider(BaseAvatarProvider):
    """Self-hosted TalkingHead avatar provider."""

    provider_name = "talkinghead"

    def __init__(
        self,
        model_url: str | None = None,
    ) -> None:
        self.model_url = model_url or "/avatars/nerdy-tutor.glb?v=7a05c998"

    def get_initial_config(self) -> dict[str, object]:
        return {
            "provider": self.provider_name,
            "type": "3d",
            "assetRef": "nerdy-tutor",
            "model_url": self.model_url,
            "features": {
                "lip_sync": True,
                "eye_tracking": True,
                "head_rotation": True,
                "idle_animation": True,
            },
        }
