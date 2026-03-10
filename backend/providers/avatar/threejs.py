from __future__ import annotations

from backend.providers.base import BaseAvatarProvider
from backend.providers.registry import ProviderRegistry

@ProviderRegistry.register_avatar
class ThreeJSAvatarProvider(BaseAvatarProvider):
    """Three.js 3D avatar provider."""

    provider_name = "threejs"

    def __init__(
        self,
        model_url: str | None = None,
        scale: float = 1.0,
        enable_shadows: bool = True,
    ) -> None:
        self.model_url = model_url or "/models/avatar.glb"
        self.scale = scale
        self.enable_shadows = enable_shadows

    def get_initial_config(self) -> dict[str, object]:
        return {
            "provider": self.provider_name,
            "type": "3d",
            "model_url": self.model_url,
            "scale": self.scale,
            "enable_shadows": self.enable_shadows,
            "features": {
                "lip_sync": True,
                "eye_tracking": True,
                "head_rotation": True,
                "idle_animation": True,
            },
        }
