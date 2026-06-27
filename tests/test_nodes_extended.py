"""Extended unit tests for nodes.py — covers gaps not addressed by test_nodes.py."""

from __future__ import annotations

import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


NODES_PATH = Path(__file__).resolve().parents[1] / "nodes.py"

# --------------------------------------------------------------------------- #
# Module loader (same pattern as test_nodes.py)                               #
# --------------------------------------------------------------------------- #

def load_nodes_module():
    """Load nodes.py with mocked external runtime modules."""
    module_name = "nodes_under_test_extended"
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


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

_NODES = None


def get_nodes():
    global _NODES
    if _NODES is None:
        _NODES = load_nodes_module()
    return _NODES


# --------------------------------------------------------------------------- #
# _sanitize_dimension                                                          #
# --------------------------------------------------------------------------- #

class TestSanitizeDimension(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()
        cls.cls = cls.nodes.ComfyUIImageProfile

    # --- tie-break rounding at exact midpoints ---

    def test_exact_midpoint_rounds_up_to_upper(self):
        # 12 is exactly halfway between 8 and 16 (distance = 4 each).
        # The condition is >=, so it must return the upper multiple.
        self.assertEqual(self.cls._sanitize_dimension(12), 16)

    def test_just_below_midpoint_rounds_down(self):
        # 11 is 3 above 8 and 5 below 16 — closer to lower.
        self.assertEqual(self.cls._sanitize_dimension(11), 8)

    def test_just_above_midpoint_rounds_up(self):
        # 13 is 5 above 8 and 3 below 16 — closer to upper.
        self.assertEqual(self.cls._sanitize_dimension(13), 16)

    def test_midpoint_in_middle_range(self):
        # 20 is halfway between 16 and 24.
        self.assertEqual(self.cls._sanitize_dimension(20), 24)

    # --- exact multiples of 8 pass through unchanged ---

    def test_exact_multiple_8(self):
        self.assertEqual(self.cls._sanitize_dimension(8), 8)

    def test_exact_multiple_16(self):
        self.assertEqual(self.cls._sanitize_dimension(16), 16)

    def test_exact_multiple_1024(self):
        self.assertEqual(self.cls._sanitize_dimension(1024), 1024)

    # --- DIM_MIN clamping ---

    def test_value_equal_to_dim_min(self):
        self.assertEqual(self.cls._sanitize_dimension(8), 8)

    def test_value_below_dim_min_clamped_to_8(self):
        # 0 and negative values are clamped to DIM_MIN before rounding.
        self.assertEqual(self.cls._sanitize_dimension(0), 8)
        self.assertEqual(self.cls._sanitize_dimension(1), 8)
        self.assertEqual(self.cls._sanitize_dimension(-1), 8)
        self.assertEqual(self.cls._sanitize_dimension(-999), 8)

    # --- DIM_MAX clamping ---

    def test_value_equal_to_dim_max(self):
        self.assertEqual(self.cls._sanitize_dimension(16384), 16384)

    def test_value_above_dim_max_clamped(self):
        self.assertEqual(self.cls._sanitize_dimension(16385), 16384)
        self.assertEqual(self.cls._sanitize_dimension(99999), 16384)

    def test_near_dim_max_midpoint_rounds_to_upper(self):
        # 16380 is 4 above 16376 and 4 below 16384 — should round up.
        self.assertEqual(self.cls._sanitize_dimension(16380), 16384)

    def test_near_dim_max_below_midpoint_rounds_down(self):
        # 16379 is 3 above 16376 and 5 below 16384 — should round down.
        self.assertEqual(self.cls._sanitize_dimension(16379), 16376)

    # --- non-integer inputs ---

    def test_none_falls_back_to_dim_min(self):
        self.assertEqual(self.cls._sanitize_dimension(None), 8)

    def test_non_numeric_string_falls_back_to_dim_min(self):
        self.assertEqual(self.cls._sanitize_dimension("abc"), 8)
        self.assertEqual(self.cls._sanitize_dimension(""), 8)

    def test_numeric_string_is_accepted(self):
        self.assertEqual(self.cls._sanitize_dimension("512"), 512)

    def test_float_is_truncated_then_rounded(self):
        # int(12.9) == 12, which is the midpoint -> rounds up to 16.
        self.assertEqual(self.cls._sanitize_dimension(12.9), 16)
        # int(12.1) == 12 -> same result.
        self.assertEqual(self.cls._sanitize_dimension(12.1), 16)
        # int(11.9) == 11 -> below midpoint -> 8.
        self.assertEqual(self.cls._sanitize_dimension(11.9), 8)


# --------------------------------------------------------------------------- #
# _sanitize_steps                                                              #
# --------------------------------------------------------------------------- #

class TestSanitizeSteps(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()
        cls.cls = cls.nodes.ComfyUIImageProfile

    # --- clamping below STEPS_MIN ---

    def test_zero_clamped_to_steps_min(self):
        self.assertEqual(self.cls._sanitize_steps(0), 1)

    def test_negative_clamped_to_steps_min(self):
        self.assertEqual(self.cls._sanitize_steps(-10), 1)

    def test_value_equal_to_steps_min(self):
        self.assertEqual(self.cls._sanitize_steps(1), 1)

    # --- clamping above STEPS_MAX ---

    def test_above_steps_max_clamped(self):
        self.assertEqual(self.cls._sanitize_steps(151), 150)
        self.assertEqual(self.cls._sanitize_steps(1000), 150)

    def test_value_equal_to_steps_max(self):
        self.assertEqual(self.cls._sanitize_steps(150), 150)

    # --- mid-range passes through ---

    def test_valid_mid_range(self):
        self.assertEqual(self.cls._sanitize_steps(20), 20)
        self.assertEqual(self.cls._sanitize_steps(75), 75)

    # --- non-integer inputs ---

    def test_none_falls_back_to_steps_min(self):
        self.assertEqual(self.cls._sanitize_steps(None), 1)

    def test_non_numeric_string_falls_back_to_steps_min(self):
        self.assertEqual(self.cls._sanitize_steps("abc"), 1)

    def test_float_string_falls_back_to_steps_min(self):
        # "20.7" cannot be passed to int() directly — falls back to STEPS_MIN.
        self.assertEqual(self.cls._sanitize_steps("20.7"), 1)

    def test_float_value_is_truncated(self):
        # int(20.7) == 20.
        self.assertEqual(self.cls._sanitize_steps(20.7), 20)


# --------------------------------------------------------------------------- #
# _sanitize_profile                                                            #
# --------------------------------------------------------------------------- #

class TestSanitizeProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()
        cls.cls = cls.nodes.ComfyUIImageProfile

    # --- rejects profiles with missing / blank id ---

    def test_missing_id_returns_none(self):
        self.assertIsNone(self.cls._sanitize_profile({"name": "NoId", "width": 512, "height": 512, "steps": 10}))

    def test_blank_id_returns_none(self):
        self.assertIsNone(self.cls._sanitize_profile({"id": "", "name": "BlankId", "width": 512, "height": 512, "steps": 10}))

    def test_whitespace_only_id_returns_none(self):
        self.assertIsNone(self.cls._sanitize_profile({"id": "   ", "name": "WhitespaceId", "width": 512, "height": 512, "steps": 10}))

    # --- rejects profiles with missing / blank name ---

    def test_missing_name_returns_none(self):
        self.assertIsNone(self.cls._sanitize_profile({"id": "ok", "width": 512, "height": 512, "steps": 10}))

    def test_blank_name_returns_none(self):
        self.assertIsNone(self.cls._sanitize_profile({"id": "ok", "name": "", "width": 512, "height": 512, "steps": 10}))

    def test_whitespace_only_name_returns_none(self):
        self.assertIsNone(self.cls._sanitize_profile({"id": "ok", "name": "  \t  ", "width": 512, "height": 512, "steps": 10}))

    # --- whitespace is stripped from id and name ---

    def test_whitespace_stripped_from_id_and_name(self):
        result = self.cls._sanitize_profile({
            "id": "  my-id  ",
            "name": "  My Name  ",
            "width": 512,
            "height": 512,
            "steps": 10,
        })
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "my-id")
        self.assertEqual(result["name"], "My Name")

    # --- valid profile is fully sanitized ---

    def test_valid_profile_returns_sanitized_dict(self):
        result = self.cls._sanitize_profile({
            "id": "p1",
            "name": "Profile One",
            "width": 512,
            "height": 768,
            "steps": 20,
        })
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], "p1")
        self.assertEqual(result["name"], "Profile One")
        self.assertEqual(result["width"], 512)
        self.assertEqual(result["height"], 768)
        self.assertEqual(result["steps"], 20)

    # --- missing dimension / steps keys fall back gracefully ---

    def test_missing_dimension_keys_fall_back(self):
        # width/height/steps absent — _sanitize_dimension(None) == 8, _sanitize_steps(None) == 1.
        result = self.cls._sanitize_profile({"id": "x", "name": "X"})
        self.assertIsNotNone(result)
        self.assertEqual(result["width"], 8)
        self.assertEqual(result["height"], 8)
        self.assertEqual(result["steps"], 1)

    def test_invalid_dimension_values_sanitized(self):
        result = self.cls._sanitize_profile({
            "id": "y",
            "name": "Y",
            "width": "bad",
            "height": None,
            "steps": "not-a-number",
        })
        self.assertIsNotNone(result)
        self.assertEqual(result["width"], 8)
        self.assertEqual(result["height"], 8)
        self.assertEqual(result["steps"], 1)


# --------------------------------------------------------------------------- #
# _load_profiles                                                               #
# --------------------------------------------------------------------------- #

class TestLoadProfiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()
        cls.cls = cls.nodes.ComfyUIImageProfile

    # --- non-list JSON falls back to defaults ---

    def test_json_object_falls_back_to_defaults(self):
        profiles = self.cls._load_profiles('{"id": "x", "name": "X"}')
        self.assertEqual(len(profiles), len(self.nodes.DEFAULT_PROFILES))

    def test_json_number_falls_back_to_defaults(self):
        profiles = self.cls._load_profiles("42")
        self.assertEqual(len(profiles), len(self.nodes.DEFAULT_PROFILES))

    def test_json_null_falls_back_to_defaults(self):
        profiles = self.cls._load_profiles("null")
        self.assertEqual(len(profiles), len(self.nodes.DEFAULT_PROFILES))

    # --- list with non-dict entries is skipped ---

    def test_list_with_non_dict_entries_skipped(self):
        payload = json.dumps([
            "a string",
            42,
            None,
            ["nested", "list"],
            {"id": "ok", "name": "Valid", "width": 512, "height": 768, "steps": 10},
        ])
        profiles = self.cls._load_profiles(payload)
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]["id"], "ok")

    # --- empty list falls back to defaults ---

    def test_empty_list_falls_back_to_defaults(self):
        profiles = self.cls._load_profiles("[]")
        self.assertEqual(len(profiles), len(self.nodes.DEFAULT_PROFILES))
        self.assertEqual(profiles[0]["id"], "default-landscape-low")

    # --- all-invalid entries fall back to defaults ---

    def test_all_invalid_entries_fall_back_to_defaults(self):
        # Every entry has a blank name — all are rejected.
        payload = json.dumps([
            {"id": "a", "name": "", "width": 512, "height": 512, "steps": 5},
            {"id": "b", "name": "  ", "width": 512, "height": 512, "steps": 5},
        ])
        profiles = self.cls._load_profiles(payload)
        self.assertEqual(len(profiles), len(self.nodes.DEFAULT_PROFILES))

    # --- valid profiles are sanitized and returned ---

    def test_valid_profiles_are_returned_in_order(self):
        payload = json.dumps([
            {"id": "first", "name": "First", "width": 512, "height": 512, "steps": 5},
            {"id": "second", "name": "Second", "width": 768, "height": 512, "steps": 10},
        ])
        profiles = self.cls._load_profiles(payload)
        self.assertEqual(len(profiles), 2)
        self.assertEqual(profiles[0]["id"], "first")
        self.assertEqual(profiles[1]["id"], "second")

    def test_loaded_profiles_have_sanitized_dimensions(self):
        # Width 11 should round to 8 (closer to lower), height 12 (midpoint) rounds to 16.
        payload = json.dumps([
            {"id": "p", "name": "P", "width": 11, "height": 12, "steps": 5},
        ])
        profiles = self.cls._load_profiles(payload)
        self.assertEqual(profiles[0]["width"], 8)
        self.assertEqual(profiles[0]["height"], 16)

    # --- default profiles themselves are valid ---

    def test_default_profiles_are_all_valid(self):
        profiles = self.cls._load_profiles("[]")
        default_ids = [p["id"] for p in self.nodes.DEFAULT_PROFILES]
        loaded_ids = [p["id"] for p in profiles]
        self.assertEqual(loaded_ids, default_ids)


# --------------------------------------------------------------------------- #
# _resolve_selected_profile                                                    #
# --------------------------------------------------------------------------- #

class TestResolveSelectedProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()
        cls.node = cls.nodes.ComfyUIImageProfile()

    def _profiles(self):
        return [
            {"id": "alpha", "name": "Alpha", "width": 512, "height": 768, "steps": 20},
            {"id": "beta",  "name": "Beta",  "width": 768, "height": 512, "steps": 30},
        ]

    # --- match found ---

    def test_match_found_returns_exact_profile(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="beta",
            selected_width=999,
            selected_height=999,
            selected_steps=999,
        )
        # Must return the matched profile object verbatim — no re-sanitization.
        self.assertEqual(result["id"], "beta")
        self.assertEqual(result["name"], "Beta")
        self.assertEqual(result["width"], 768)
        self.assertEqual(result["height"], 512)
        self.assertEqual(result["steps"], 30)

    def test_match_found_first_profile(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="alpha",
            selected_width=0,
            selected_height=0,
            selected_steps=0,
        )
        self.assertEqual(result["id"], "alpha")
        self.assertEqual(result["name"], "Alpha")

    # --- no match — fallback uses sanitized selected dims ---

    def test_no_match_id_is_first_profiles_id(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="nonexistent",
            selected_width=512,
            selected_height=512,
            selected_steps=20,
        )
        self.assertEqual(result["id"], "alpha")

    def test_no_match_name_is_selected(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="nonexistent",
            selected_width=512,
            selected_height=512,
            selected_steps=20,
        )
        self.assertEqual(result["name"], "Selected")

    def test_no_match_selected_width_sanitized(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="nonexistent",
            selected_width=11,   # rounds to 8
            selected_height=512,
            selected_steps=20,
        )
        self.assertEqual(result["width"], 8)

    def test_no_match_selected_height_sanitized(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="nonexistent",
            selected_width=512,
            selected_height=12,  # midpoint -> 16
            selected_steps=20,
        )
        self.assertEqual(result["height"], 16)

    def test_no_match_selected_steps_clamped(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="nonexistent",
            selected_width=512,
            selected_height=512,
            selected_steps=999,  # clamped to STEPS_MAX=150
        )
        self.assertEqual(result["steps"], 150)

    def test_no_match_steps_below_min_clamped(self):
        result = self.node._resolve_selected_profile(
            self._profiles(),
            selected_profile_id="nonexistent",
            selected_width=512,
            selected_height=512,
            selected_steps=-5,  # clamped to STEPS_MIN=1
        )
        self.assertEqual(result["steps"], 1)


# --------------------------------------------------------------------------- #
# generate — latent shape math and device wiring                               #
# --------------------------------------------------------------------------- #

class TestGenerate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()
        cls.node = cls.nodes.ComfyUIImageProfile()

    def _single_profile_json(self, width, height, steps):
        return json.dumps([{"id": "p", "name": "P", "width": width, "height": height, "steps": steps}])

    # --- latent shape math ---

    def test_latent_height_is_height_divided_by_8(self):
        latent, _ = self.node.generate(
            profiles_json=self._single_profile_json(512, 768, 10),
            selected_profile_id="p",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        # height=768 -> 768//8=96
        self.assertEqual(latent["samples"]["shape"][2], 96)

    def test_latent_width_is_width_divided_by_8(self):
        latent, _ = self.node.generate(
            profiles_json=self._single_profile_json(512, 768, 10),
            selected_profile_id="p",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        # width=512 -> 512//8=64
        self.assertEqual(latent["samples"]["shape"][3], 64)

    def test_latent_batch_and_channels_are_fixed(self):
        latent, _ = self.node.generate(
            profiles_json=self._single_profile_json(512, 512, 10),
            selected_profile_id="p",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        shape = latent["samples"]["shape"]
        self.assertEqual(shape[0], 1)   # batch
        self.assertEqual(shape[1], 4)   # channels

    def test_latent_device_matches_constructor(self):
        latent, _ = self.node.generate(
            profiles_json=self._single_profile_json(512, 512, 10),
            selected_profile_id="p",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        self.assertEqual(latent["samples"]["device"], "cpu")

    # --- steps passthrough ---

    def test_steps_from_matched_profile_passed_through(self):
        _, steps = self.node.generate(
            profiles_json=self._single_profile_json(512, 512, 42),
            selected_profile_id="p",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        self.assertEqual(steps, 42)

    def test_steps_from_fallback_selected(self):
        # Profile id does not match — fallback uses selected_steps.
        _, steps = self.node.generate(
            profiles_json=self._single_profile_json(512, 512, 42),
            selected_profile_id="nonexistent",
            selected_width=512,
            selected_height=512,
            selected_steps=77,
        )
        self.assertEqual(steps, 77)

    def test_generate_result_is_tuple_of_two(self):
        result = self.node.generate(
            profiles_json=self._single_profile_json(512, 512, 10),
            selected_profile_id="p",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        self.assertIsInstance(result, tuple)
        self.assertEqual(len(result), 2)

    def test_latent_dict_has_samples_key(self):
        latent, _ = self.node.generate(
            profiles_json=self._single_profile_json(512, 512, 10),
            selected_profile_id="p",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        self.assertIn("samples", latent)

    def test_generate_falls_back_to_defaults_on_empty_json(self):
        # Empty profiles_json causes fallback to DEFAULT_PROFILES; first profile selected.
        latent, steps = self.node.generate(
            profiles_json="[]",
            selected_profile_id="default-landscape-low",
            selected_width=8,
            selected_height=8,
            selected_steps=1,
        )
        # default-landscape-low: width=404->400 (404: lower=400, upper=408; 404-400=4 >= 408-404=4 -> 408?
        # Let's just check steps == 5 (the default profile value)
        self.assertEqual(steps, 5)


# --------------------------------------------------------------------------- #
# INPUT_TYPES structure                                                        #
# --------------------------------------------------------------------------- #

class TestInputTypes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()
        cls.cls = cls.nodes.ComfyUIImageProfile

    def test_input_types_has_required_key(self):
        spec = self.cls.INPUT_TYPES()
        self.assertIn("required", spec)

    def test_required_fields_present(self):
        required = self.cls.INPUT_TYPES()["required"]
        for field in ("profiles_json", "selected_profile_id", "selected_width", "selected_height", "selected_steps"):
            self.assertIn(field, required, f"Missing required field: {field}")

    def test_profiles_json_is_string_type(self):
        required = self.cls.INPUT_TYPES()["required"]
        self.assertEqual(required["profiles_json"][0], "STRING")

    def test_selected_width_is_int_type(self):
        required = self.cls.INPUT_TYPES()["required"]
        self.assertEqual(required["selected_width"][0], "INT")

    def test_selected_height_is_int_type(self):
        required = self.cls.INPUT_TYPES()["required"]
        self.assertEqual(required["selected_height"][0], "INT")

    def test_selected_steps_is_int_type(self):
        required = self.cls.INPUT_TYPES()["required"]
        self.assertEqual(required["selected_steps"][0], "INT")

    def test_width_min_max_match_constants(self):
        spec = self.cls.INPUT_TYPES()["required"]["selected_width"][1]
        self.assertEqual(spec["min"], self.nodes.DIM_MIN)
        self.assertEqual(spec["max"], self.nodes.DIM_MAX)
        self.assertEqual(spec["step"], self.nodes.DIM_MULTIPLE)

    def test_steps_min_max_match_constants(self):
        spec = self.cls.INPUT_TYPES()["required"]["selected_steps"][1]
        self.assertEqual(spec["min"], self.nodes.STEPS_MIN)
        self.assertEqual(spec["max"], self.nodes.STEPS_MAX)


# --------------------------------------------------------------------------- #
# NODE_CLASS_MAPPINGS / NODE_DISPLAY_NAME_MAPPINGS contract                   #
# --------------------------------------------------------------------------- #

class TestNodeMappings(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nodes = get_nodes()

    def test_node_class_mappings_has_correct_key(self):
        self.assertIn("ComfyUIImageProfile", self.nodes.NODE_CLASS_MAPPINGS)

    def test_node_class_mappings_points_to_class(self):
        cls = self.nodes.NODE_CLASS_MAPPINGS["ComfyUIImageProfile"]
        self.assertIs(cls, self.nodes.ComfyUIImageProfile)

    def test_node_display_name_mappings_has_correct_key(self):
        self.assertIn("ComfyUIImageProfile", self.nodes.NODE_DISPLAY_NAME_MAPPINGS)

    def test_node_display_name_is_string(self):
        display = self.nodes.NODE_DISPLAY_NAME_MAPPINGS["ComfyUIImageProfile"]
        self.assertIsInstance(display, str)
        self.assertTrue(display.strip(), "Display name must be non-empty")

    def test_node_class_has_required_attributes(self):
        cls = self.nodes.ComfyUIImageProfile
        for attr in ("RETURN_TYPES", "RETURN_NAMES", "FUNCTION", "CATEGORY"):
            self.assertTrue(hasattr(cls, attr), f"Missing class attribute: {attr}")

    def test_return_types_matches_return_names_length(self):
        cls = self.nodes.ComfyUIImageProfile
        self.assertEqual(len(cls.RETURN_TYPES), len(cls.RETURN_NAMES))

    def test_function_attribute_names_existing_method(self):
        cls = self.nodes.ComfyUIImageProfile
        self.assertTrue(callable(getattr(cls, cls.FUNCTION, None)),
                        f"FUNCTION='{cls.FUNCTION}' does not resolve to a callable on the class")


if __name__ == "__main__":
    unittest.main()
