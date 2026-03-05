"""Node definitions for ComfyUI-Image-profile."""

import torch
import comfy.model_management


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
                "selected_width": ("INT", {"default": 1152, "min": 8, "max": 16384, "step": 8}),
                "selected_height": ("INT", {"default": 864, "min": 8, "max": 16384, "step": 8}),
                "selected_steps": ("INT", {"default": 8, "min": 1, "max": 150, "step": 1}),
            }
        }

    RETURN_TYPES = ("LATENT", "INT")
    RETURN_NAMES = ("Latent", "Steps")
    FUNCTION = "generate"
    CATEGORY = "Latent/Profile"

    def generate(
        self,
        profiles_json: str,
        selected_profile_id: str,
        selected_width: int,
        selected_height: int,
        selected_steps: int,
    ):
        _ = profiles_json
        _ = selected_profile_id

        width = int(selected_width)
        height = int(selected_height)
        steps = int(selected_steps)

        latent = torch.zeros([1, 4, height // 8, width // 8], device=self.device)
        return ({"samples": latent}, steps)


NODE_CLASS_MAPPINGS = {
    "ComfyUIImageProfile": ComfyUIImageProfile,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIImageProfile": "ComfyUI-Image-profile",
}
