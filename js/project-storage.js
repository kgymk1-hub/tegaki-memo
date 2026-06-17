const autoSaveStorageKey = "tegaki-memo:auto-save:v1";
const autoSaveDelay = 1000;

let autoSaveTimer = null;
let autoSaveStatusTimer = null;
let isRestoringProject = false;

function serializeProjectState() {
  return {
    app: "tegaki-memo",
    version: 1,
    savedAt: new Date().toISOString(),
    canvas: {
      width: canvas.width,
      height: canvas.height,
      displayWidth: canvasWidth,
      displayHeight: canvasHeight
    },
    background: {
      mode: backgroundMode,
      color: backgroundColor
    },
    tool: {
      currentTool,
      currentColor,
      currentSize
    },
    activeLayerId,
    nextLayerNumber,
    layers: layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity ?? 1,
      imageData: layer.canvas.toDataURL("image/png")
    }))
  };
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("レイヤー画像の読み込みに失敗しました。"));
    image.src = dataUrl;
  });
}

async function restoreProjectState(projectState) {
  if (!projectState || projectState.app !== "tegaki-memo" || !Array.isArray(projectState.layers)) {
    throw new Error("自動保存データの形式が正しくありません。");
  }

  isRestoringProject = true;
  clearTimeout(autoSaveTimer);

  try {
    pendingImage = null;
    selection = null;
    clipboardImageData = null;
    isSelecting = false;
    selectionStartPoint = null;
    resetDrawingState();

    if (projectState.canvas?.width && projectState.canvas?.height) {
      canvas.width = projectState.canvas.width;
      canvas.height = projectState.canvas.height;
      canvasWidth = projectState.canvas.displayWidth || Math.round(projectState.canvas.width / renderScale);
      canvasHeight = projectState.canvas.displayHeight || Math.round(projectState.canvas.height / renderScale);
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      resetDisplaySettings();
    }

    const restoredLayers = await Promise.all(projectState.layers.map(async (layerData, index) => {
      const layerCanvas = document.createElement("canvas");
      layerCanvas.width = canvas.width;
      layerCanvas.height = canvas.height;

      const layerCtx = layerCanvas.getContext("2d");
      if (!layerCtx) return null;

      const image = await loadImageFromDataUrl(layerData.imageData);
      layerCtx.save();
      layerCtx.setTransform(1, 0, 0, 1, 0, 0);
      layerCtx.globalCompositeOperation = "source-over";
      layerCtx.globalAlpha = 1;
      layerCtx.setLineDash([]);
      layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
      if (image) {
        layerCtx.drawImage(image, 0, 0, layerCanvas.width, layerCanvas.height);
      }
      layerCtx.restore();
      resetLayerDrawingSettings(layerCtx);

      return {
        id: layerData.id || createLayerId(),
        name: layerData.name || `レイヤー${index + 1}`,
        visible: layerData.visible !== false,
        opacity: Math.min(1, Math.max(0.1, Number(layerData.opacity ?? 1))),
        canvas: layerCanvas,
        ctx: layerCtx
      };
    }));

    layers = restoredLayers.filter(Boolean);
    if (layers.length === 0) {
      initializeLayers();
    }

    activeLayerId = layers.some((layer) => layer.id === projectState.activeLayerId)
      ? projectState.activeLayerId
      : layers[0]?.id || null;
    nextLayerNumber = Number(projectState.nextLayerNumber) || layers.length + 1;

    backgroundMode = projectState.background?.mode || "white";
    backgroundColor = projectState.background?.color || "#ffffff";
    currentTool = projectState.tool?.currentTool || "pen";
    currentColor = projectState.tool?.currentColor || "#111827";
    currentSize = Number(projectState.tool?.currentSize) || Number(sizeSelect.value);

    backgroundModeSelect.value = backgroundMode;
    backgroundColorInput.value = backgroundColor;
    sizeSelect.value = String(currentSize);
    setColor(currentColor);
    currentTool = projectState.tool?.currentTool || "pen";

    history = [];
    updateBackgroundView();
    renderAllLayers();
    updateLayerUI();
    updateToolButtons();
    updateUndoButton();
    refreshHint();
    showAutoSaveStatus("前回作業を復元しました");
  } finally {
    isRestoringProject = false;
  }
}

function padProjectFileDate(number) {
  return String(number).padStart(2, "0");
}

function createProjectFileName() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    padProjectFileDate(now.getMonth() + 1),
    padProjectFileDate(now.getDate())
  ].join("");
  const time = [
    padProjectFileDate(now.getHours()),
    padProjectFileDate(now.getMinutes()),
    padProjectFileDate(now.getSeconds())
  ].join("");

  return `tegaki-memo-${date}-${time}.tegaki`;
}

function validateProjectState(projectState) {
  if (!projectState || typeof projectState !== "object") return false;
  if (projectState.app !== "tegaki-memo") return false;
  if (!projectState.version) return false;
  if (!projectState.canvas || typeof projectState.canvas !== "object") return false;
  if (!Array.isArray(projectState.layers)) return false;
  if (projectState.layers.length === 0) return false;

  return projectState.layers.every((layer) => (
    layer
    && typeof layer === "object"
    && typeof layer.imageData === "string"
    && layer.imageData.length > 0
  ));
}

function downloadProjectFile() {
  if (isPlacingImage && isPlacingImage()) {
    alert("画像を確定または取消してください。");
    return;
  }

  try {
    const projectState = serializeProjectState();
    const json = JSON.stringify(projectState, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = createProjectFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    scheduleAutoSave();
  } catch (error) {
    console.error("プロジェクトファイルの保存に失敗しました。", error);
    alert("プロジェクトファイルを保存できませんでした。");
  }
}

function openProjectFilePicker() {
  if (isPlacingImage && isPlacingImage()) {
    alert("画像を確定または取消してください。");
    return;
  }

  projectFileInput.click();
}

function readProjectFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("ファイルの読み込みに失敗しました。"));
    reader.readAsText(file);
  });
}

async function loadProjectFile(file) {
  if (!file) return;

  const text = await readProjectFileAsText(file);
  const projectState = JSON.parse(text);

  if (!validateProjectState(projectState)) {
    throw new Error("プロジェクトファイルの形式が正しくありません。");
  }

  const shouldLoad = window.confirm("現在の作業内容を置き換えて、プロジェクトファイルを読み込みますか？");
  if (!shouldLoad) return;

  await restoreProjectState(projectState);
  pendingImage = null;
  selection = null;
  isSelecting = false;
  selectionStartPoint = null;
  resetDrawingState();
  history = [];
  updateImagePlacementControls();
  updateLayerUI();
  updateToolButtons();
  updateUndoButton();
  refreshHint();
  autoSaveNow();
  showAutoSaveStatus("プロジェクトファイルを読み込みました");
}

async function handleProjectFileSelected(event) {
  const file = event.target.files?.[0];

  try {
    await loadProjectFile(file);
  } catch (error) {
    console.error("プロジェクトファイルの読み込みに失敗しました。", error);
    alert("プロジェクトファイルを読み込めませんでした。");
  } finally {
    event.target.value = "";
  }
}

function scheduleAutoSave() {
  if (isRestoringProject) return;

  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveNow();
  }, autoSaveDelay);
}

function autoSaveNow() {
  if (isRestoringProject) return false;

  try {
    const projectState = serializeProjectState();
    localStorage.setItem(autoSaveStorageKey, JSON.stringify(projectState));
    showAutoSaveStatus("自動保存しました");
    return true;
  } catch (error) {
    console.error("自動保存に失敗しました。localStorage容量を超えた可能性があります。", error);
    showAutoSaveStatus("自動保存に失敗しました（容量不足の可能性）");
    return false;
  }
}

function loadAutoSaveData() {
  try {
    const rawData = localStorage.getItem(autoSaveStorageKey);
    return rawData ? JSON.parse(rawData) : null;
  } catch (error) {
    console.error("自動保存データの読み込みに失敗しました。", error);
    return null;
  }
}

function clearAutoSaveData() {
  try {
    localStorage.removeItem(autoSaveStorageKey);
    showAutoSaveStatus("自動保存データを削除しました");
    return true;
  } catch (error) {
    console.error("自動保存データの削除に失敗しました。", error);
    showAutoSaveStatus("自動保存データの削除に失敗しました");
    return false;
  }
}

function showAutoSaveStatus(message) {
  if (!status || !message) return;

  status.textContent = message;

  window.clearTimeout(autoSaveStatusTimer);
  autoSaveStatusTimer = window.setTimeout(() => {
    if (!isRestoringProject && typeof updateStatus === "function") {
      updateStatus();
    }
  }, 1500);
}

async function restoreAutoSaveOnStartup() {
  const autoSaveData = loadAutoSaveData();
  if (!autoSaveData) return false;

  const shouldRestore = window.confirm("前回の作業データがあります。復元しますか？");
  if (!shouldRestore) return false;

  try {
    await restoreProjectState(autoSaveData);
    return true;
  } catch (error) {
    console.error("前回作業の復元に失敗しました。新規状態で開始します。", error);
    showAutoSaveStatus("前回作業の復元に失敗しました");
    return false;
  }
}
