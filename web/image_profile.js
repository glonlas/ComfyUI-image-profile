import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "ComfyUI.ImageProfile.Manager";
const TARGET_NODE_NAMES = new Set(["ComfyUIImageProfile", "ComfyUI-Image-profile"]);
const STATE_WIDGET_NAMES = [
  "profiles_json",
  "selected_profile_id",
  "selected_width",
  "selected_height",
  "selected_steps",
];
const STYLE_TAG_ID = "comfyui-image-profile-style";

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
      min-height: 230px;
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
    }

    .cip-placeholder {
      color: var(--cip-muted);
      font-size: 12px;
      border: 1px dashed rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 14px 10px;
      text-align: center;
    }
  `;

  document.head.appendChild(style);
}

function getWidget(node, name) {
  return node.widgets?.find((widget) => widget?.name === name);
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

function fitNode(node) {
  const computed = node.computeSize?.();
  if (!computed || computed.length < 2) {
    return;
  }

  const nextWidth = Math.max(computed[0], 360);
  const nextHeight = Math.max(computed[1], 300);
  node.setSize?.([nextWidth, nextHeight]);
  node.setDirtyCanvas?.(true, true);
  node.graph?.setDirtyCanvas?.(true, true);
}

function mountManagerShell(node, nodeData) {
  if (node.__imageProfileShellMounted) {
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

  const list = document.createElement("div");
  list.className = "cip-list";

  const placeholder = document.createElement("div");
  placeholder.className = "cip-placeholder";
  placeholder.textContent = "Profile manager is initialized. CRUD actions are added in later commits.";

  addButton.addEventListener("click", () => {
    console.info("[ComfyUI-Image-profile] Add profile clicked (shell phase)");
  });

  header.append(title, addButton);
  list.appendChild(placeholder);
  root.append(header, list);

  node.addDOMWidget("image_profile_manager", "ImageProfileManager", root, {
    hideOnZoom: false,
    serialize: false,
    getValue: () => "",
    setValue: () => {},
  });

  node.__imageProfileShellMounted = true;
  node.__imageProfileListEl = list;
  fitNode(node);

  setTimeout(() => fitNode(node), 0);
  setTimeout(() => fitNode(node), 120);
  setTimeout(() => fitNode(node), 260);
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
      mountManagerShell(this, nodeData);
    };
  },
});
