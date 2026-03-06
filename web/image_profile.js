import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "ComfyUI.ImageProfile.Manager";
const TARGET_NODE_NAMES = new Set(["ComfyUIImageProfile", "ComfyUI-Image-profile", "Image Profile"]);
const STATE_WIDGET_NAMES = [
  "profiles_json",
  "selected_profile_id",
  "selected_width",
  "selected_height",
  "selected_steps",
];
const STYLE_TAG_ID = "comfyui-image-profile-style";
const CUSTOM_RESOLUTION_VALUE = "__custom__";
const DIM_MULTIPLE = 8;
const DIM_MIN = 8;
const DIM_MAX = 16384;
const STEPS_MIN = 1;
const STEPS_MAX = 150;
const DEFAULT_NODE_MIN_WIDTH = 460;
const DEFAULT_NODE_MIN_HEIGHT = 520;

const RESOLUTION_PRESETS = [
  "1024x1024 ( 1:1 )",
  "1152x896 ( 9:7 )",
  "896x1152 ( 7:9 )",
  "1152x864 ( 4:3 )",
  "864x1152 ( 3:4 )",
  "1248x832 ( 3:2 )",
  "832x1248 ( 2:3 )",
  "1280x720 ( 16:9 )",
  "720x1280 ( 9:16 )",
  "1344x576 ( 21:9 )",
  "576x1344 ( 9:21 )",
  "1280x1280 ( 1:1 )",
  "1440x1120 ( 9:7 )",
  "1120x1440 ( 7:9 )",
  "1472x1104 ( 4:3 )",
  "1104x1472 ( 3:4 )",
  "1536x1024 ( 3:2 )",
  "1024x1536 ( 2:3 )",
  "1536x864 ( 16:9 )",
  "864x1536 ( 9:16 )",
  "1680x720 ( 21:9 )",
  "720x1680 ( 9:21 )",
  "1536x1536 ( 1:1 )",
  "1728x1344 ( 9:7 )",
  "1344x1728 ( 7:9 )",
  "1728x1296 ( 4:3 )",
  "1296x1728 ( 3:4 )",
  "1872x1248 ( 3:2 )",
  "1248x1872 ( 2:3 )",
  "2048x1152 ( 16:9 )",
  "1152x2048 ( 9:16 )",
  "2016x864 ( 21:9 )",
  "864x2016 ( 9:21 )",
];

const DEFAULT_PROFILES = [
  { id: "default-landscape-low", name: "Landscape Low resolution", width: 404, height: 204, steps: 5 },
  { id: "default-portrait-low", name: "Portrait Low resolution", width: 204, height: 404, steps: 5 },
  { id: "default-landscape-high", name: "Landscape High resolution", width: 1152, height: 864, steps: 8 },
  { id: "default-portrait-high", name: "Portrait High resolution", width: 864, height: 1152, steps: 8 },
];

function ensureStyles() {
  if (document.getElementById(STYLE_TAG_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = `
    .cip-root {
      --cip-bg: linear-gradient(165deg, #0d1a1f 0%, #0e131c 100%);
      --cip-border: rgba(255, 255, 255, 0.12);
      --cip-text: #e8f0ff;
      --cip-muted: #9aa8c7;
      --cip-accent: #3ba3ff;
      --cip-accent-2: #69d1ff;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--cip-border);
      border-radius: 12px;
      background: var(--cip-bg);
      color: var(--cip-text);
      box-sizing: border-box;
      width: 100%;
      min-height: 320px;
      overflow: hidden;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
    }

    .cip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .cip-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--cip-text);
    }

    .cip-add {
      border: 1px solid rgba(105, 209, 255, 0.45);
      border-radius: 8px;
      background: linear-gradient(160deg, rgba(59, 163, 255, 0.2), rgba(105, 209, 255, 0.08));
      color: var(--cip-text);
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: transform 120ms ease, filter 120ms ease;
    }

    .cip-add:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
    }

    .cip-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 150px;
      overflow-y: visible;
      overflow-x: hidden;
      padding-right: 2px;
      padding-bottom: 4px;
      box-sizing: border-box;
    }

    .cip-profile {
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.04);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 7px;
      flex: 0 0 auto;
      box-sizing: border-box;
      width: 100%;
      overflow: hidden;
      transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
    }

    .cip-profile.is-selected {
      border-color: rgba(59, 163, 255, 0.98);
      background: linear-gradient(160deg, rgba(59, 163, 255, 0.28), rgba(105, 209, 255, 0.18));
      box-shadow: inset 0 0 0 1px rgba(59, 163, 255, 0.5), 0 0 0 1px rgba(59, 163, 255, 0.32);
    }

    .cip-profile.is-drop-target {
      border-color: rgba(105, 209, 255, 0.95);
      box-shadow: inset 0 0 0 1px rgba(105, 209, 255, 0.45);
    }

    .cip-profile-top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: baseline;
      min-width: 0;
    }

    .cip-profile-name {
      font-size: 12px;
      font-weight: 700;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cip-selected-pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(105, 209, 255, 0.9);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10px;
      letter-spacing: 0.02em;
      color: #bde9ff;
      background: rgba(59, 163, 255, 0.25);
    }

    .cip-profile-meta {
      font-size: 11px;
      color: var(--cip-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cip-profile-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    .cip-actions {
      display: flex;
      gap: 6px;
      margin-left: auto;
    }

    .cip-btn {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.2);
      color: var(--cip-text);
      font-size: 11px;
      line-height: 1;
      padding: 5px 7px;
      cursor: pointer;
    }

    .cip-btn:hover {
      filter: brightness(1.12);
    }

    .cip-btn-icon {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .cip-icon {
      width: 13px;
      height: 13px;
      display: inline-flex;
      color: var(--cip-text);
    }

    .cip-icon svg {
      width: 13px;
      height: 13px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .cip-empty {
      color: var(--cip-muted);
      font-size: 12px;
      border: 1px dashed rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 14px 10px;
      text-align: center;
    }

    .cip-form {
      margin-top: 8px;
      border: 1px solid rgba(105, 209, 255, 0.3);
      border-radius: 10px;
      background: rgba(10, 16, 24, 0.65);
      padding: 10px;
      display: none;
      flex-direction: column;
      gap: 7px;
    }

    .cip-form.is-open {
      display: flex;
    }

    .cip-label {
      font-size: 11px;
      color: var(--cip-muted);
      margin-bottom: 2px;
    }

    .cip-input, .cip-select {
      width: 100%;
      border-radius: 7px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: rgba(0, 0, 0, 0.25);
      color: var(--cip-text);
      font-size: 12px;
      padding: 6px 8px;
      box-sizing: border-box;
    }

    .cip-row {
      display: flex;
      gap: 8px;
    }

    .cip-col {
      flex: 1;
    }

    .cip-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 7px;
      margin-top: 4px;
    }
  `;

  document.head.appendChild(style);
}

function getWidget(node, name) {
  return node.widgets?.find((widget) => widget?.name === name);
}

function setWidgetValue(node, name, value) {
  const widget = getWidget(node, name);
  if (!widget) {
    return;
  }

  widget.value = value;
  widget.callback?.(value);
}

function hideStateWidgets(node) {
  for (const widgetName of STATE_WIDGET_NAMES) {
    const widget = getWidget(node, widgetName);
    if (!widget) {
      continue;
    }

    widget.hidden = true;
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
  }
}

function fitNode(node, { enforceDefaultMinimum = false } = {}) {
  const computed = node.computeSize?.();
  if (!computed || computed.length < 2) {
    return;
  }

  const currentWidth = Number(node.size?.[0]) || 0;
  const currentHeight = Number(node.size?.[1]) || 0;
  const minWidth = enforceDefaultMinimum ? DEFAULT_NODE_MIN_WIDTH : 0;
  const minHeight = enforceDefaultMinimum ? DEFAULT_NODE_MIN_HEIGHT : 0;

  const targetWidth = Math.max(computed[0], minWidth);
  const targetHeight = Math.max(computed[1], minHeight);
  const nextWidth = Math.max(targetWidth, currentWidth);
  const nextHeight = Math.max(targetHeight, currentHeight);

  if (nextWidth !== currentWidth || nextHeight !== currentHeight) {
    node.setSize?.([nextWidth, nextHeight]);
  }

  node.setDirtyCanvas?.(true, true);
  node.graph?.setDirtyCanvas?.(true, true);
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function createIconButton(kind, label) {
  const button = document.createElement("button");
  button.className = "cip-btn cip-btn-icon";
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);

  const icon = document.createElement("span");
  icon.className = "cip-icon";

  if (kind === "edit") {
    icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>`;
  } else {
    icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>`;
  }

  button.appendChild(icon);
  return button;
}

function parseResolution(text) {
  const match = String(text ?? "").trim().match(/^(\d+)\s*x\s*(\d+)(?:\s|$)/i);
  if (!match) {
    return null;
  }

  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

function toProfile(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const name = String(candidate.name ?? "").trim();
  const id = String(candidate.id ?? "").trim() || createId();
  const width = Number.parseInt(candidate.width, 10);
  const height = Number.parseInt(candidate.height, 10);
  const steps = Number.parseInt(candidate.steps, 10);

  if (!name || Number.isNaN(width) || Number.isNaN(height) || Number.isNaN(steps)) {
    return null;
  }

  return {
    id,
    name,
    width,
    height,
    steps,
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function sanitizeDimension(value) {
  let integer = Number.parseInt(value, 10);
  if (Number.isNaN(integer)) {
    integer = DIM_MIN;
  }
  integer = clamp(integer, DIM_MIN, DIM_MAX);

  const lower = Math.max(DIM_MIN, Math.floor(integer / DIM_MULTIPLE) * DIM_MULTIPLE);
  const upper = Math.min(DIM_MAX, lower + DIM_MULTIPLE);
  const nextValue = integer - lower >= upper - integer ? upper : lower;

  return {
    value: nextValue,
    corrected: nextValue !== Number.parseInt(value, 10),
  };
}

function sanitizeSteps(value) {
  let integer = Number.parseInt(value, 10);
  if (Number.isNaN(integer)) {
    integer = 8;
  }
  const nextValue = clamp(integer, STEPS_MIN, STEPS_MAX);

  return {
    value: nextValue,
    corrected: nextValue !== Number.parseInt(value, 10),
  };
}

function notify(message, severity = "info") {
  if (typeof app.extensionManager?.toast?.add === "function") {
    app.extensionManager.toast.add({
      severity,
      summary: "Image Profile",
      detail: message,
      life: 3500,
    });
    return;
  }
  app.ui.dialog.show(message);
}

function makeUniqueName(baseName, profiles, excludeId = null) {
  const desired = String(baseName ?? "").trim() || "Profile";
  const taken = new Set(
    profiles
      .filter((profile) => profile.id !== excludeId)
      .map((profile) => profile.name.trim().toLowerCase()),
  );

  if (!taken.has(desired.toLowerCase())) {
    return desired;
  }

  let index = 2;
  while (true) {
    const candidate = `${desired} (${index})`;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
    index += 1;
  }
}

function loadProfilesFromWidgets(node) {
  const profilesWidget = getWidget(node, "profiles_json");
  const raw = String(profilesWidget?.value ?? "[]").trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return DEFAULT_PROFILES.map((profile) => ({ ...profile }));
  }

  const sanitized = parsed.map(toProfile).filter((value) => value !== null);
  if (sanitized.length === 0) {
    return DEFAULT_PROFILES.map((profile) => ({ ...profile }));
  }

  return sanitized;
}

function initializeState(node) {
  const profiles = loadProfilesFromWidgets(node);
  const selectedProfileId = String(getWidget(node, "selected_profile_id")?.value ?? "").trim();

  let selectedId = selectedProfileId;
  if (!profiles.some((profile) => profile.id === selectedId)) {
    selectedId = profiles[0]?.id ?? "";
  }

  return {
    profiles,
    selectedId,
    editingId: null,
  };
}

function syncStateFromWidgets(node) {
  if (!node.__imageProfileManagerMounted) {
    return;
  }

  node.__imageProfileState = initializeState(node);
  closeForm(node);
  renderProfiles(node);
}

function chooseActiveProfile(state) {
  return state.profiles.find((profile) => profile.id === state.selectedId) ?? state.profiles[0] ?? null;
}

function normalizeSelection(state) {
  if (state.profiles.length === 0) {
    state.selectedId = "";
    return;
  }

  if (!state.profiles.some((profile) => profile.id === state.selectedId)) {
    state.selectedId = state.profiles[0].id;
  }
}

function persistState(node) {
  const state = node.__imageProfileState;
  if (!state) {
    return;
  }
  normalizeSelection(state);

  setWidgetValue(node, "profiles_json", JSON.stringify(state.profiles));

  const active = chooseActiveProfile(state);
  if (active) {
    state.selectedId = active.id;
    setWidgetValue(node, "selected_profile_id", active.id);
    setWidgetValue(node, "selected_width", active.width);
    setWidgetValue(node, "selected_height", active.height);
    setWidgetValue(node, "selected_steps", active.steps);
  } else {
    setWidgetValue(node, "selected_profile_id", "");
    setWidgetValue(node, "selected_width", 1152);
    setWidgetValue(node, "selected_height", 864);
    setWidgetValue(node, "selected_steps", 8);
  }

  node.setDirtyCanvas?.(true, true);
  node.graph?.setDirtyCanvas?.(true, true);
}

function createField(labelText, inputElement) {
  const wrapper = document.createElement("div");
  const label = document.createElement("div");
  label.className = "cip-label";
  label.textContent = labelText;
  wrapper.append(label, inputElement);
  return wrapper;
}

function buildFormUI(root) {
  const form = document.createElement("div");
  form.className = "cip-form";

  const nameInput = document.createElement("input");
  nameInput.className = "cip-input";
  nameInput.type = "text";
  nameInput.placeholder = "Portrait Low resolution";

  const presetSelect = document.createElement("select");
  presetSelect.className = "cip-select";

  const customOption = document.createElement("option");
  customOption.value = CUSTOM_RESOLUTION_VALUE;
  customOption.textContent = "Custom (enter WxH)";
  presetSelect.appendChild(customOption);

  for (const preset of RESOLUTION_PRESETS) {
    const option = document.createElement("option");
    option.value = preset;
    option.textContent = preset;
    presetSelect.appendChild(option);
  }

  const customResolutionInput = document.createElement("input");
  customResolutionInput.className = "cip-input";
  customResolutionInput.type = "text";
  customResolutionInput.placeholder = "1152x864";

  const stepsInput = document.createElement("input");
  stepsInput.className = "cip-input";
  stepsInput.type = "number";
  stepsInput.step = "1";
  stepsInput.min = "1";
  stepsInput.max = "150";
  stepsInput.value = "8";

  const row = document.createElement("div");
  row.className = "cip-row";

  const left = document.createElement("div");
  left.className = "cip-col";
  left.append(createField("Preset Resolution", presetSelect));

  const right = document.createElement("div");
  right.className = "cip-col";
  right.append(createField("Steps", stepsInput));

  row.append(left, right);

  form.append(
    createField("Profile Name", nameInput),
    row,
    createField("Custom Resolution (WxH)", customResolutionInput),
  );

  const actions = document.createElement("div");
  actions.className = "cip-form-actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "cip-btn";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";

  const saveButton = document.createElement("button");
  saveButton.className = "cip-btn";
  saveButton.type = "button";
  saveButton.textContent = "Save";

  actions.append(cancelButton, saveButton);
  form.appendChild(actions);

  root.appendChild(form);

  return {
    form,
    nameInput,
    presetSelect,
    customResolutionInput,
    stepsInput,
    saveButton,
    cancelButton,
  };
}

function renderProfiles(node) {
  const state = node.__imageProfileState;
  const list = node.__imageProfileListEl;
  if (!state || !list) {
    return;
  }

  list.innerHTML = "";

  if (state.profiles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "cip-empty";
    empty.textContent = "No profiles yet. Click Add Profile to create one.";
    list.appendChild(empty);
    fitNode(node);
    return;
  }

  for (const profile of state.profiles) {
    const isSelected = profile.id === state.selectedId;
    const card = document.createElement("div");
    card.className = `cip-profile${isSelected ? " is-selected" : ""}`;
    card.draggable = true;

    const top = document.createElement("div");
    top.className = "cip-profile-top";

    const name = document.createElement("div");
    name.className = "cip-profile-name";
    name.textContent = profile.name;

    const meta = document.createElement("div");
    meta.className = "cip-profile-meta";
    meta.textContent = `${profile.width}x${profile.height} • ${profile.steps} steps`;

    if (isSelected) {
      const selectedPill = document.createElement("div");
      selectedPill.className = "cip-selected-pill";
      selectedPill.textContent = "Selected";
      top.append(name, selectedPill);
    } else {
      top.append(name);
    }

    const actions = document.createElement("div");
    actions.className = "cip-actions";

    const editButton = createIconButton("edit", "Edit profile");
    const deleteButton = createIconButton("delete", "Delete profile");

    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openForm(node, "edit", profile.id);
    });

    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.profiles.length <= 1) {
        app.ui.dialog.show("At least one profile must exist.");
        return;
      }
      state.profiles = state.profiles.filter((candidate) => candidate.id !== profile.id);
      if (state.selectedId === profile.id) {
        state.selectedId = state.profiles[0]?.id ?? "";
      }
      persistState(node);
      renderProfiles(node);
    });

    actions.append(editButton, deleteButton);

    const footer = document.createElement("div");
    footer.className = "cip-profile-footer";
    footer.append(meta, actions);

    card.addEventListener("click", () => {
      state.selectedId = profile.id;
      persistState(node);
      renderProfiles(node);
    });

    card.addEventListener("dragstart", (event) => {
      node.__draggingProfileId = profile.id;
      event.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      node.__draggingProfileId = null;
      card.classList.remove("is-drop-target");
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("is-drop-target");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("is-drop-target");
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-drop-target");
      const draggingId = node.__draggingProfileId;
      if (!draggingId || draggingId === profile.id) {
        return;
      }

      const sourceIndex = state.profiles.findIndex((entry) => entry.id === draggingId);
      const targetIndex = state.profiles.findIndex((entry) => entry.id === profile.id);
      if (sourceIndex === -1 || targetIndex === -1) {
        return;
      }

      const reordered = [...state.profiles];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      state.profiles = reordered;

      persistState(node);
      renderProfiles(node);
    });

    card.append(top, footer);
    list.appendChild(card);
  }

  fitNode(node);
}

function setFormOpen(node, isOpen) {
  const form = node.__imageProfileForm?.form;
  if (!form) {
    return;
  }

  if (isOpen) {
    form.classList.add("is-open");
  } else {
    form.classList.remove("is-open");
  }

  fitNode(node);
}

function resolvePresetValue(profile) {
  const direct = `${profile.width}x${profile.height}`;
  const matchingPreset = RESOLUTION_PRESETS.find((preset) => {
    const parsed = parseResolution(preset);
    return parsed && parsed.width === profile.width && parsed.height === profile.height;
  });

  if (matchingPreset) {
    return {
      preset: matchingPreset,
      custom: direct,
    };
  }

  return {
    preset: CUSTOM_RESOLUTION_VALUE,
    custom: direct,
  };
}

function openForm(node, mode, profileId = null) {
  const state = node.__imageProfileState;
  const formState = node.__imageProfileForm;
  if (!state || !formState) {
    return;
  }

  const profile = mode === "edit"
    ? state.profiles.find((candidate) => candidate.id === profileId) ?? null
    : null;

  if (profile) {
    const resolved = resolvePresetValue(profile);
    formState.nameInput.value = profile.name;
    formState.presetSelect.value = resolved.preset;
    formState.customResolutionInput.value = resolved.custom;
    formState.stepsInput.value = String(profile.steps);
    state.editingId = profile.id;
  } else {
    formState.nameInput.value = "";
    formState.presetSelect.value = RESOLUTION_PRESETS[0] ?? CUSTOM_RESOLUTION_VALUE;
    formState.customResolutionInput.value = "";
    formState.stepsInput.value = "8";
    state.editingId = null;
  }

  setFormOpen(node, true);
}

function closeForm(node) {
  const state = node.__imageProfileState;
  if (state) {
    state.editingId = null;
  }
  setFormOpen(node, false);
}

function saveForm(node) {
  const state = node.__imageProfileState;
  const formState = node.__imageProfileForm;
  if (!state || !formState) {
    return;
  }

  const name = String(formState.nameInput.value ?? "").trim();
  const preset = formState.presetSelect.value;
  const custom = String(formState.customResolutionInput.value ?? "").trim();
  const resolutionText = preset === CUSTOM_RESOLUTION_VALUE ? custom : preset;
  const parsedResolution = parseResolution(resolutionText);
  const steps = Number.parseInt(formState.stepsInput.value, 10);

  if (!name) {
    app.ui.dialog.show("Profile name is required.");
    return;
  }

  if (!parsedResolution) {
    app.ui.dialog.show("Resolution must follow WxH format, for example 1152x864.");
    return;
  }

  if (!/^-?\d+$/.test(String(formState.stepsInput.value ?? "").trim())) {
    app.ui.dialog.show("Steps must be an integer value.");
    return;
  }

  const widthSanitized = sanitizeDimension(parsedResolution.width);
  const heightSanitized = sanitizeDimension(parsedResolution.height);
  const stepsSanitized = sanitizeSteps(steps);
  const notices = [];

  if (widthSanitized.corrected || heightSanitized.corrected) {
    notices.push(
      `Resolution auto-corrected to ${widthSanitized.value}x${heightSanitized.value} (multiple of ${DIM_MULTIPLE}).`,
    );
  }
  if (stepsSanitized.corrected) {
    notices.push(`Steps clamped to ${stepsSanitized.value} (${STEPS_MIN}-${STEPS_MAX}).`);
  }

  if (state.editingId) {
    const uniqueName = makeUniqueName(name, state.profiles, state.editingId);
    state.profiles = state.profiles.map((profile) => {
      if (profile.id !== state.editingId) {
        return profile;
      }

      return {
        ...profile,
        name: uniqueName,
        width: widthSanitized.value,
        height: heightSanitized.value,
        steps: stepsSanitized.value,
      };
    });

    state.selectedId = state.editingId;
  } else {
    const uniqueName = makeUniqueName(name, state.profiles);
    const created = {
      id: createId(),
      name: uniqueName,
      width: widthSanitized.value,
      height: heightSanitized.value,
      steps: stepsSanitized.value,
    };

    state.profiles = [...state.profiles, created];
    state.selectedId = created.id;
  }

  persistState(node);
  if (notices.length > 0) {
    notify(notices.join(" "), "warn");
  }
  closeForm(node);
  renderProfiles(node);
}

function bindFormEvents(node) {
  const formState = node.__imageProfileForm;
  if (!formState) {
    return;
  }

  formState.presetSelect.addEventListener("change", () => {
    if (formState.presetSelect.value !== CUSTOM_RESOLUTION_VALUE) {
      formState.customResolutionInput.value = "";
    }
  });

  formState.cancelButton.addEventListener("click", () => {
    closeForm(node);
  });

  formState.saveButton.addEventListener("click", () => {
    saveForm(node);
  });
}

function mountManager(node) {
  if (node.__imageProfileManagerMounted) {
    syncStateFromWidgets(node);
    return;
  }

  ensureStyles();

  const root = document.createElement("div");
  root.className = "cip-root";

  const header = document.createElement("div");
  header.className = "cip-header";

  const title = document.createElement("div");
  title.className = "cip-title";
  title.textContent = "Image Profiles";

  const addButton = document.createElement("button");
  addButton.className = "cip-add";
  addButton.type = "button";
  addButton.textContent = "+ Add Profile";

  header.append(title, addButton);

  const list = document.createElement("div");
  list.className = "cip-list";

  root.append(header, list);

  node.__imageProfileState = initializeState(node);
  node.__imageProfileListEl = list;
  node.__imageProfileForm = buildFormUI(root);

  bindFormEvents(node);

  addButton.addEventListener("click", () => {
    openForm(node, "create");
  });

  node.addDOMWidget("image_profile_manager", "ImageProfileManager", root, {
    hideOnZoom: false,
    serialize: false,
    getValue: () => "",
    setValue: () => {},
  });

  persistState(node);
  renderProfiles(node);

  node.__imageProfileManagerMounted = true;
  fitNode(node, { enforceDefaultMinimum: true });

  setTimeout(() => fitNode(node, { enforceDefaultMinimum: true }), 0);
  setTimeout(() => fitNode(node, { enforceDefaultMinimum: true }), 120);
  setTimeout(() => fitNode(node, { enforceDefaultMinimum: true }), 260);
}

app.registerExtension({
  name: EXTENSION_NAME,

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (!TARGET_NODE_NAMES.has(nodeData?.name)) {
      return;
    }

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function onNodeCreatedImageProfile() {
      onNodeCreated?.apply(this, arguments);
      hideStateWidgets(this);
      mountManager(this);
      setTimeout(() => syncStateFromWidgets(this), 0);
    };

    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function onConfigureImageProfile() {
      const result = onConfigure?.apply(this, arguments);
      hideStateWidgets(this);
      syncStateFromWidgets(this);
      return result;
    };
  },
});
