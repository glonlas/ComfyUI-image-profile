"""Node definitions for ComfyUI-Image-profile."""

from __future__ import annotations

import json
from typing import Any

import torch
import comfy.model_management

DIM_MULTIPLE = 8
DIM_MIN = 8
DIM_MAX = 16384
STEPS_MIN = 1
STEPS_MAX = 150

DEFAULT_PROFILES: list[dict[str, Any]] = [
    {
        "id": "default-landscape-low",
        "name": "Landscape Low resolution",
        "width": 404,
        "height": 204,
        "steps": 5,
    },
    {
        "id": "default-portrait-low",
        "name": "Portrait Low resolution",
        "width": 204,
        "height": 404,
        "steps": 5,
    },
    {
        "id": "default-landscape-high",
        "name": "Landscape High resolution",
        "width": 1152,
        "height": 864,
        "steps": 8,
    },
    {
        "id": "default-portrait-high",
        "name": "Portrait High resolution",
        "width": 864,
        "height": 1152,
        "steps": 8,
    },
]


class ComfyUIImageProfile:
    """Emit a latent and step count from a selected image profile."""

    def __init__(self) -> None:
        self.device = comfy.model_management.intermediate_device()

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "profiles_json": ("STRING", {"default": "[]", "multiline": False}),
                "selected_profile_id": ("STRING", {"default": ""}),
                "selected_width": ("INT", {"default": 1152, "min": DIM_MIN, "max": DIM_MAX, "step": DIM_MULTIPLE}),
                "selected_height": ("INT", {"default": 864, "min": DIM_MIN, "max": DIM_MAX, "step": DIM_MULTIPLE}),
                "selected_steps": ("INT", {"default": 8, "min": STEPS_MIN, "max": STEPS_MAX, "step": 1}),
            }
        }

    RETURN_TYPES = ("LATENT", "INT")
    RETURN_NAMES = ("Latent", "Steps")
    FUNCTION = "generate"
    CATEGORY = "Latent/Profile"

    @staticmethod
    def _clamp(value: int, minimum: int, maximum: int) -> int:
        return max(minimum, min(maximum, value))

    @classmethod
    def _sanitize_dimension(cls, value: Any) -> int:
        try:
            integer = int(value)
        except (TypeError, ValueError):
            integer = DIM_MIN

        integer = cls._clamp(integer, DIM_MIN, DIM_MAX)
        lower = (integer // DIM_MULTIPLE) * DIM_MULTIPLE
        upper = lower + DIM_MULTIPLE

        if lower < DIM_MIN:
            lower = DIM_MIN
        if upper > DIM_MAX:
            upper = DIM_MAX

        if integer - lower >= upper - integer:
            return upper
        return lower

    @classmethod
    def _sanitize_steps(cls, value: Any) -> int:
        try:
            integer = int(value)
        except (TypeError, ValueError):
            integer = STEPS_MIN
        return cls._clamp(integer, STEPS_MIN, STEPS_MAX)

    @classmethod
    def _sanitize_profile(cls, profile: dict[str, Any]) -> dict[str, Any] | None:
        profile_id = str(profile.get("id", "")).strip()
        name = str(profile.get("name", "")).strip()
        if not profile_id or not name:
            return None

        return {
            "id": profile_id,
            "name": name,
            "width": cls._sanitize_dimension(profile.get("width")),
            "height": cls._sanitize_dimension(profile.get("height")),
            "steps": cls._sanitize_steps(profile.get("steps")),
        }

    @classmethod
    def _load_profiles(cls, profiles_json: str) -> list[dict[str, Any]]:
        try:
            parsed = json.loads(profiles_json)
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = []

        if not isinstance(parsed, list):
            parsed = []

        valid_profiles: list[dict[str, Any]] = []
        for candidate in parsed:
            if not isinstance(candidate, dict):
                continue
            profile = cls._sanitize_profile(candidate)
            if profile is not None:
                valid_profiles.append(profile)

        if valid_profiles:
            return valid_profiles

        return [cls._sanitize_profile(profile) for profile in DEFAULT_PROFILES if cls._sanitize_profile(profile) is not None]

    def _resolve_selected_profile(
        self,
        profiles: list[dict[str, Any]],
        selected_profile_id: str,
        selected_width: int,
        selected_height: int,
        selected_steps: int,
    ) -> dict[str, Any]:
        selected = next((p for p in profiles if p["id"] == selected_profile_id), None)
        if selected is not None:
            return selected

        return {
            "id": profiles[0]["id"],
            "name": "Selected",
            "width": self._sanitize_dimension(selected_width),
            "height": self._sanitize_dimension(selected_height),
            "steps": self._sanitize_steps(selected_steps),
        }

    def generate(
        self,
        profiles_json: str,
        selected_profile_id: str,
        selected_width: int,
        selected_height: int,
        selected_steps: int,
    ):
        profiles = self._load_profiles(profiles_json)
        selected = self._resolve_selected_profile(
            profiles,
            selected_profile_id=selected_profile_id,
            selected_width=selected_width,
            selected_height=selected_height,
            selected_steps=selected_steps,
        )

        width = selected["width"]
        height = selected["height"]
        steps = selected["steps"]

        latent = torch.zeros([1, 4, height // 8, width // 8], device=self.device)
        return ({"samples": latent}, steps)


NODE_CLASS_MAPPINGS = {
    "ComfyUIImageProfile": ComfyUIImageProfile,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIImageProfile": "ComfyUI-Image-profile",
}
