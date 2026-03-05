# ComfyUI-Image-profile

Custom ComfyUI node that manages multiple named image profiles, where each profile stores:
- latent resolution (`width x height`)
- number of sampler steps

The node has no visible input connectors and outputs:
- `Latent` (`LATENT`)
- `Steps` (`INT`)

## Node Interface
- Display Name: `ComfyUI-Image-profile`
- Category: `Latent/Profile`
- Outputs: `("LATENT", "INT")` as `("Latent", "Steps")`

## Features
- Create, edit, select, duplicate, delete, and drag-reorder profiles.
- Advanced in-node profile manager UI (DOM widget).
- Clear selected profile visual state.
- Always-on `Add Profile` button.
- Resolution presets (based on Z-Image Latent presets) and custom `WxH` entry.
- Per-node persistence in workflow JSON via hidden node widgets.
- Safe backend fallback when profile JSON is malformed.

## Default Starter Profiles
New nodes are seeded with:
- Landscape Low resolution: `404x204`, `5`
- Portrait Low resolution: `204x404`, `5`
- Landscape High resolution: `1152x864`, `8`
- Portrait High resolution: `864x1152`, `8`

## Validation Rules
- Resolution is normalized to nearest multiple of `8` and clamped to `[8, 16384]`.
- Steps must be integer-only and are clamped to `[1, 150]`.
- Duplicate profile names are auto-suffixed (`Name (2)`, `Name (3)`, ...).
- At least one profile must always exist (deleting last profile is blocked).

## Persistence Model
Profiles are stored per node instance in hidden widgets, then serialized into workflow JSON.

`profiles_json` schema:
```json
[
  {
    "id": "uuid-or-stable-id",
    "name": "Portrait Low resolution",
    "width": 864,
    "height": 1152,
    "steps": 8
  }
]
```

Selected output values are mirrored into hidden widgets:
- `selected_profile_id`
- `selected_width`
- `selected_height`
- `selected_steps`

## Installation
1. Place this folder in ComfyUI custom nodes:
   - `ComfyUI/custom_nodes/comfyui-Hires-lowres`
2. Restart ComfyUI.
3. Add node `ComfyUI-Image-profile` from category `Latent/Profile`.

## Manual Verification Checklist
1. Add node and confirm no visible input connectors.
2. Select each starter profile and confirm outputs reflect the selected profile.
3. Add profile from preset resolution and verify output.
4. Add profile with custom resolution (`WxH`) and confirm auto-correction to multiple of 8.
5. Enter out-of-range steps and verify clamping to `[1, 150]`.
6. Edit a profile and verify selected output updates.
7. Duplicate profile and verify auto-suffixed naming.
8. Reorder profiles by drag-and-drop; save/reload workflow and verify order persists.
9. Delete a non-last profile and confirm selection stays valid.
10. Try deleting the last profile and verify it is blocked.
11. Save and reopen workflow, verify all profiles and selected state are restored.

## Known Constraints
- Batch size is fixed at `1` by design.
- Node scope only: no global/shared profile library.
