"""Unit tests for nodes.py."""

from __future__ import annotations

import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


NODES_PATH = Path(__file__).resolve().parents[1] / "nodes.py"


def load_nodes_module():
    """Load nodes.py with mocked external runtime modules."""
    module_name = "nodes_under_test"
    sys.modules.pop(module_name, None)

    fake_torch = types.ModuleType("torch")
    fake_torch.zeros = lambda shape, device=None: {"shape": shape, "device": device}

    fake_comfy = types.ModuleType("comfy")
    fake_model_management = types.ModuleType("comfy.model_management")
    fake_model_management.intermediate_device = lambda: "cpu"
    fake_comfy.model_management = fake_model_management

    previous = {
        "torch": sys.modules.get("torch"),
        "comfy": sys.modules.get("comfy"),
        "comfy.model_management": sys.modules.get("comfy.model_management"),
    }
    sys.modules["torch"] = fake_torch
    sys.modules["comfy"] = fake_comfy
    sys.modules["comfy.model_management"] = fake_model_management

    try:
        spec = importlib.util.spec_from_file_location(module_name, NODES_PATH)
        if spec is None or spec.loader is None:
            raise RuntimeError("Unable to load nodes.py spec")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        for name, original in previous.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original


class TestComfyUIImageProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = load_nodes_module()
        cls.node_cls = cls.nodes.ComfyUIImageProfile

    def test_sanitize_dimension_rounds_and_clamps(self):
        self.assertEqual(self.node_cls._sanitize_dimension(11), 8)
        self.assertEqual(self.node_cls._sanitize_dimension(12), 16)
        self.assertEqual(self.node_cls._sanitize_dimension(-100), 8)
        self.assertEqual(self.node_cls._sanitize_dimension(20000), 16384)

    def test_load_profiles_falls_back_to_defaults_on_invalid_json(self):
        profiles = self.node_cls._load_profiles("not-json")
        self.assertEqual(len(profiles), len(self.nodes.DEFAULT_PROFILES))
        self.assertEqual(profiles[0]["id"], "default-landscape-low")

    def test_load_profiles_filters_invalid_profiles(self):
        payload = json.dumps(
            [
                {"id": "ok", "name": "Valid", "width": 512, "height": 768, "steps": 20},
                {"id": "missing-name", "width": 512, "height": 768, "steps": 20},
                {"name": "missing-id", "width": 512, "height": 768, "steps": 20},
            ]
        )
        profiles = self.node_cls._load_profiles(payload)
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]["id"], "ok")
        self.assertEqual(profiles[0]["name"], "Valid")
        self.assertEqual(profiles[0]["width"], 512)
        self.assertEqual(profiles[0]["height"], 768)
        self.assertEqual(profiles[0]["steps"], 20)

    def test_resolve_selected_profile_falls_back_to_first_profile(self):
        node = self.node_cls()
        profiles = [
            {"id": "first", "name": "First", "width": 512, "height": 768, "steps": 20},
            {"id": "second", "name": "Second", "width": 768, "height": 512, "steps": 30},
        ]
        selected = node._resolve_selected_profile(
            profiles,
            selected_profile_id="missing",
            selected_width=111,
            selected_height=222,
            selected_steps=0,
        )
        self.assertEqual(selected["id"], "first")
        self.assertEqual(selected["name"], "Selected")
        self.assertEqual(selected["width"], 112)
        self.assertEqual(selected["height"], 224)
        self.assertEqual(selected["steps"], 1)

    def test_generate_returns_latent_and_steps(self):
        node = self.node_cls()
        profiles_json = json.dumps(
            [
                {"id": "p1", "name": "Profile One", "width": 1152, "height": 864, "steps": 14},
            ]
        )
        latent, steps = node.generate(
            profiles_json=profiles_json,
            selected_profile_id="p1",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )

        self.assertEqual(steps, 14)
        self.assertEqual(latent["samples"]["shape"], [1, 4, 108, 144])
        self.assertEqual(latent["samples"]["device"], "cpu")


if __name__ == "__main__":
    unittest.main()
