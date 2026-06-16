const canvas = document.getElementById("drawingCanvas");
const canvasWrap = document.getElementById("canvasWrap");
const ctx = canvas.getContext("2d");

const penBtn = document.getElementById("penBtn");
const markerBtn = document.getElementById("markerBtn");
const lineBtn = document.getElementById("lineBtn");
const rectBtn = document.getElementById("rectBtn");
const ellipseBtn = document.getElementById("ellipseBtn");
const arrowBtn = document.getElementById("arrowBtn");
const dashedLineBtn = document.getElementById("dashedLineBtn");
const textBtn = document.getElementById("textBtn");
const eraserBtn = document.getElementById("eraserBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const customColor = document.getElementById("customColor");
const sizeSelect = document.getElementById("sizeSelect");
const status = document.getElementById("status");
const hint = document.getElementById("hint");
const colorButtons = Array.from(document.querySelectorAll(".colorBtn"));

const backgroundModeSelect = document.getElementById("backgroundModeSelect");
const backgroundColorInput = document.getElementById("backgroundColorInput");
const loadImageBtn = document.getElementById("loadImageBtn");
const imageInput = document.getElementById("imageInput");
const imageImportMode = document.getElementById("imageImportMode");

const layerSelect = document.getElementById("layerSelect");
const addLayerBtn = document.getElementById("addLayerBtn");
const duplicateLayerBtn = document.getElementById("duplicateLayerBtn");
const deleteLayerBtn = document.getElementById("deleteLayerBtn");
const renameLayerBtn = document.getElementById("renameLayerBtn");
const moveLayerUpBtn = document.getElementById("moveLayerUpBtn");
const moveLayerDownBtn = document.getElementById("moveLayerDownBtn");
const mergeLayerDownBtn = document.getElementById("mergeLayerDownBtn");
const toggleLayerVisibilityBtn = document.getElementById("toggleLayerVisibilityBtn");
const layerOpacityInput = document.getElementById("layerOpacityInput");
const layerOpacityValue = document.getElementById("layerOpacityValue");

const presetColorNames = {
  "#111827": "黒",
  "#dc2626": "赤",
  "#2563eb": "青",
  "#16a34a": "緑"
};

const maxHistory = 10;
const maxLayers = 5;
const minShapeDistance = 4;
const renderScale = Math.min(window.devicePixelRatio || 1, 1.5);

let isDrawing = false;
let currentTool = "pen";
let currentColor = "#111827";
let currentSize = Number(sizeSelect.value);
let backgroundMode = "white";
let backgroundColor = "#ffffff";
let lastPoint = null;
let previousPoint = null;
let shapeStartPoint = null;
let canvasWidth = 0;
let canvasHeight = 0;
let history = [];

let layers = [];
let activeLayerId = null;
let nextLayerNumber = 1;

function getDisplaySize() {
  const rect = canvasWrap.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height))
  };
}

function getPointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function isHintVisible() {
  return !hint.classList.contains("hidden");
}

function setHintVisible(visible) {
  hint.classList.toggle("hidden", !visible);
}

function getToolHintText(tool = currentTool) {
  if (isShapeTool(tool)) {
    return "キャンバス上でドラッグして描画します";
  }

  if (tool === "text") {
    return "文字を入れたい位置をタップしてください";
  }

  return "指やタッチペンでここに描けます";
}

function updateHintText() {
  hint.textContent = getToolHintText();
}

function createLayerId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSnapshotFromCanvas(sourceCanvas) {
  if (!sourceCanvas.width || !sourceCanvas.height) return null;

  const snapshot = document.createElement("canvas");
  snapshot.width = sourceCanvas.width;
  snapshot.height = sourceCanvas.height;

  const snapshotCtx = snapshot.getContext("2d");
  if (!snapshotCtx) return null;

  snapshotCtx.drawImage(sourceCanvas, 0, 0);
  return snapshot;
}

function resetDisplaySettings() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

function resetLayerDrawingSettings(layerCtx) {
  layerCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  layerCtx.lineCap = "round";
  layerCtx.lineJoin = "round";
  layerCtx.imageSmoothingEnabled = true;
  layerCtx.globalCompositeOperation = "source-over";
  layerCtx.globalAlpha = 1;
  layerCtx.setLineDash([]);
}

function clearDisplayCanvas() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  resetDisplaySettings();
}

function createLayer(name) {
  const layerCanvas = document.createElement("canvas");
  layerCanvas.width = canvas.width;
  layerCanvas.height = canvas.height;

  const layerCtx = layerCanvas.getContext("2d");
  if (!layerCtx) return null;

  resetLayerDrawingSettings(layerCtx);

  return {
    id: createLayerId(),
    name,
    canvas: layerCanvas,
    ctx: layerCtx,
    visible: true,
    opacity: 1
  };
}

function getActiveLayer() {
  return layers.find((layer) => layer.id === activeLayerId) || null;
}

function getActiveLayerIndex() {
  return layers.findIndex((layer) => layer.id === activeLayerId);
}

function getDrawingContext() {
  const activeLayer = getActiveLayer();
  if (!activeLayer || !activeLayer.visible) return null;
  return activeLayer.ctx;
}

function renderAllLayers() {
  clearDisplayCanvas();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  layers.forEach((layer) => {
    if (!layer.visible) return;
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.globalAlpha = 1;
  });

  ctx.restore();
  resetDisplaySettings();
}

function resizeLayerCanvases() {
  layers.forEach((layer) => {
    const snapshot = createSnapshotFromCanvas(layer.canvas);

    layer.canvas.width = canvas.width;
    layer.canvas.height = canvas.height;

    layer.ctx.save();
    layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

    if (snapshot) {
      layer.ctx.drawImage(snapshot, 0, 0);
    }

    layer.ctx.restore();
    resetLayerDrawingSettings(layer.ctx);
  });
}

function resizeCanvasIfNeeded() {
  const { width, height } = getDisplaySize();
  if (width === canvasWidth && height === canvasHeight) return;

  canvasWidth = width;
  canvasHeight = height;
  canvas.width = Math.max(1, Math.floor(canvasWidth * renderScale));
  canvas.height = Math.max(1, Math.floor(canvasHeight * renderScale));
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  resizeLayerCanvases();
  renderAllLayers();
}

function createLayersSnapshot() {
  return layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity ?? 1,
    canvas: createSnapshotFromCanvas(layer.canvas)
  }));
}

function saveHistory() {
  history.push({
    layersSnapshot: createLayersSnapshot(),
    activeLayerId,
    hintVisible: isHintVisible(),
    nextLayerNumber,
    backgroundMode,
    backgroundColor
  });

  if (history.length > maxHistory) history.shift();
  updateUndoButton();
}

function restoreHistoryItem(item) {
  layers = item.layersSnapshot
    .map((layerSnapshot) => {
      const layerCanvas = document.createElement("canvas");
      layerCanvas.width = canvas.width;
      layerCanvas.height = canvas.height;

      const layerCtx = layerCanvas.getContext("2d");
      if (!layerCtx) return null;

      layerCtx.save();
      layerCtx.setTransform(1, 0, 0, 1, 0, 0);
      layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);

      if (layerSnapshot.canvas) {
        layerCtx.drawImage(layerSnapshot.canvas, 0, 0);
      }

      layerCtx.restore();
      resetLayerDrawingSettings(layerCtx);

      return {
        id: layerSnapshot.id,
        name: layerSnapshot.name,
        visible: layerSnapshot.visible,
        opacity: layerSnapshot.opacity ?? 1,
        canvas: layerCanvas,
        ctx: layerCtx
      };
    })
    .filter(Boolean);

  activeLayerId = item.activeLayerId;
  nextLayerNumber = item.nextLayerNumber;
  backgroundMode = item.backgroundMode ?? "white";
  backgroundColor = item.backgroundColor ?? "#ffffff";
  backgroundModeSelect.value = backgroundMode;
  backgroundColorInput.value = backgroundColor;
  updateHintText();
  setHintVisible(item.hintVisible);
  updateBackgroundView();

  renderAllLayers();
  updateLayerUI();
}

function updateUndoButton() {
  undoBtn.disabled = history.length === 0;
}

function getToolLabel() {
  const labels = {
    pen: presetColorNames[currentColor.toLowerCase()] || "指定色",
    eraser: "消しゴム",
    marker: "マーカー",
    line: "直線",
    rect: "四角",
    ellipse: "円",
    arrow: "矢印",
    dashedLine: "点線",
    text: "文字"
  };

  return labels[currentTool] || "ペン";
}

function updateStatus() {
  const sizeLabel = sizeSelect.options[sizeSelect.selectedIndex].text;
  const activeLayer = getActiveLayer();

  const layerLabel = activeLayer
    ? activeLayer.visible ? activeLayer.name : `${activeLayer.name}（非表示）`
    : "レイヤーなし";

  status.textContent = `ペン：${getToolLabel()} / 太さ：${sizeLabel} / ${layerLabel}`;
}

function updateToolButtons() {
  penBtn.classList.toggle("active", currentTool === "pen");
  markerBtn.classList.toggle("active", currentTool === "marker");
  eraserBtn.classList.toggle("active", currentTool === "eraser");
  lineBtn.classList.toggle("active", currentTool === "line");
  rectBtn.classList.toggle("active", currentTool === "rect");
  ellipseBtn.classList.toggle("active", currentTool === "ellipse");
  arrowBtn.classList.toggle("active", currentTool === "arrow");
  dashedLineBtn.classList.toggle("active", currentTool === "dashedLine");
  textBtn.classList.toggle("active", currentTool === "text");
  updateStatus();
}

function updateLayerUI() {
  layerSelect.innerHTML = "";

  [...layers].reverse().forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer.id;
    option.textContent = layer.visible ? layer.name : `${layer.name}（非表示）`;
    layerSelect.appendChild(option);
  });

  layerSelect.value = activeLayerId || "";

  const activeLayer = getActiveLayer();
  const activeIndex = getActiveLayerIndex();

  addLayerBtn.disabled = layers.length >= maxLayers;
  duplicateLayerBtn.disabled = !activeLayer || !activeLayer.visible || layers.length >= maxLayers;
  deleteLayerBtn.disabled = layers.length <= 1;
  renameLayerBtn.disabled = !activeLayer;
  toggleLayerVisibilityBtn.disabled = !activeLayer;
  layerOpacityInput.disabled = !activeLayer;
  moveLayerUpBtn.disabled = !activeLayer || activeIndex === layers.length - 1;
  moveLayerDownBtn.disabled = !activeLayer || activeIndex <= 0;
  const lowerLayer = activeIndex > 0 ? layers[activeIndex - 1] : null;
  mergeLayerDownBtn.disabled = !activeLayer || activeIndex <= 0 || !activeLayer.visible || !lowerLayer?.visible;

  if (activeLayer) {
    toggleLayerVisibilityBtn.textContent = activeLayer.visible ? "非表示" : "表示";
    const opacityPercent = Math.round((activeLayer.opacity ?? 1) * 100);
    layerOpacityInput.value = opacityPercent;
    layerOpacityValue.textContent = `${opacityPercent}%`;
  } else {
    toggleLayerVisibilityBtn.textContent = "表示";
    layerOpacityInput.value = 100;
    layerOpacityValue.textContent = "100%";
  }

  updateUndoButton();
  updateStatus();
}

function setColor(color) {
  currentColor = color;
  customColor.value = color;

  if (currentTool === "eraser") {
    currentTool = "pen";
  }

  colorButtons.forEach((button) => {
    const isSelected = button.dataset.color.toLowerCase() === color.toLowerCase();
    button.classList.toggle("active", isSelected);
  });

  updateToolButtons();
}

function updateBackgroundView() {
  canvasWrap.classList.toggle("transparent-bg", backgroundMode === "transparent");

  if (backgroundMode === "white") {
    canvasWrap.style.backgroundColor = "#ffffff";
  } else if (backgroundMode === "color") {
    canvasWrap.style.backgroundColor = backgroundColor;
  } else {
    canvasWrap.style.backgroundColor = "#ffffff";
  }
}

function setBackgroundMode(mode, options = {}) {
  if (!options.skipHistory && mode !== backgroundMode) saveHistory();
  backgroundMode = mode;
  updateBackgroundView();
}

function setBackgroundColor(color, options = {}) {
  if (!options.skipHistory && color !== backgroundColor) saveHistory();
  backgroundColor = color;
  updateBackgroundView();
}

function applyStrokeStyle(targetCtx, options = {}) {
  const tool = options.tool || currentTool;

  targetCtx.lineWidth = currentSize;
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.setLineDash([]);

  if (tool === "eraser") {
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.globalAlpha = 1;
    targetCtx.strokeStyle = "rgba(0, 0, 0, 1)";
    targetCtx.fillStyle = "rgba(0, 0, 0, 1)";
  } else {
    targetCtx.globalCompositeOperation = "source-over";
    targetCtx.globalAlpha = tool === "marker" ? 0.35 : 1;
    targetCtx.strokeStyle = currentColor;
    targetCtx.fillStyle = currentColor;
  }

  if (tool === "dashedLine") {
    targetCtx.setLineDash([Math.max(8, currentSize * 2), Math.max(6, currentSize * 1.5)]);
  }
}

function resetAfterDrawing(targetCtx) {
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.globalAlpha = 1;
  targetCtx.setLineDash([]);
}

function isLayerCanvasEmpty(layer) {
  if (!layer?.canvas?.width || !layer?.canvas?.height) return true;

  const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const pixels = imageData.data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return false;
  }

  return true;
}

function areVisibleLayersEmpty() {
  return layers
    .filter((layer) => layer.visible)
    .every((layer) => isLayerCanvasEmpty(layer));
}

function isShapeTool(tool = currentTool) {
  return ["line", "rect", "ellipse", "arrow", "dashedLine"].includes(tool);
}

function getTextFontSize() {
  if (currentSize <= 3) return 16;
  if (currentSize <= 7) return 24;
  if (currentSize <= 14) return 36;
  return 48;
}

function drawDot(point) {
  const targetCtx = getDrawingContext();
  if (!targetCtx) return;

  applyStrokeStyle(targetCtx);
  targetCtx.beginPath();
  targetCtx.arc(point.x, point.y, currentSize / 2, 0, Math.PI * 2);
  targetCtx.fill();
  resetAfterDrawing(targetCtx);
}

function drawSmoothLine(point) {
  const targetCtx = getDrawingContext();
  if (!targetCtx) return;

  applyStrokeStyle(targetCtx);

  if (!lastPoint) {
    drawDot(point);
    lastPoint = point;
    previousPoint = point;
    return;
  }

  const midPoint = {
    x: (lastPoint.x + point.x) / 2,
    y: (lastPoint.y + point.y) / 2
  };

  targetCtx.beginPath();
  targetCtx.moveTo(previousPoint.x, previousPoint.y);
  targetCtx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
  targetCtx.stroke();
  resetAfterDrawing(targetCtx);

  previousPoint = midPoint;
  lastPoint = point;
}

function drawShape(targetCtx, startPoint, endPoint, tool = currentTool) {
  applyStrokeStyle(targetCtx, { tool });
  targetCtx.beginPath();

  if (tool === "rect") {
    targetCtx.rect(startPoint.x, startPoint.y, endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    targetCtx.stroke();
  } else if (tool === "ellipse") {
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;
    const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
    const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;
    targetCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    targetCtx.stroke();
  } else {
    targetCtx.moveTo(startPoint.x, startPoint.y);
    targetCtx.lineTo(endPoint.x, endPoint.y);
    targetCtx.stroke();

    if (tool === "arrow") {
      const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
      const headLength = Math.max(14, currentSize * 3);
      targetCtx.beginPath();
      targetCtx.moveTo(endPoint.x, endPoint.y);
      targetCtx.lineTo(endPoint.x - headLength * Math.cos(angle - Math.PI / 6), endPoint.y - headLength * Math.sin(angle - Math.PI / 6));
      targetCtx.moveTo(endPoint.x, endPoint.y);
      targetCtx.lineTo(endPoint.x - headLength * Math.cos(angle + Math.PI / 6), endPoint.y - headLength * Math.sin(angle + Math.PI / 6));
      targetCtx.stroke();
    }
  }

  resetAfterDrawing(targetCtx);
}

function drawShapePreview(endPoint) {
  if (!shapeStartPoint) return;
  renderAllLayers();
  ctx.save();
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  drawShape(ctx, shapeStartPoint, endPoint);
  ctx.restore();
  resetDisplaySettings();
}

function drawTextAt(point) {
  const activeLayer = getActiveLayer();

  const finishTextTool = () => {
    setTool("pen");
    setHintVisible(false);
  };

  if (!activeLayer || !activeLayer.visible) {
    finishTextTool();
    return;
  }

  const text = window.prompt("入力する文字を入力してください。");
  if (text === null) {
    finishTextTool();
    return;
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    finishTextTool();
    return;
  }

  saveHistory();

  const targetCtx = activeLayer.ctx;
  applyStrokeStyle(targetCtx, { tool: "pen" });
  targetCtx.font = `${getTextFontSize()}px sans-serif`;
  targetCtx.textBaseline = "top";
  targetCtx.fillText(trimmedText, point.x, point.y);
  resetAfterDrawing(targetCtx);
  renderAllLayers();
  finishTextTool();
}

function startDrawing(event) {
  event.preventDefault();

  const activeLayer = getActiveLayer();
  if (!activeLayer || !activeLayer.visible) return;

  const point = getPointerPoint(event);

  if (currentTool === "text") {
    drawTextAt(point);
    return;
  }

  if (!isShapeTool()) {
    saveHistory();
  }

  setHintVisible(false);
  isDrawing = true;
  lastPoint = point;
  previousPoint = point;
  shapeStartPoint = isShapeTool() ? point : null;

  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (_) {
    // Pointer Captureが使えない環境でも描画自体は継続する。
  }

  if (!isShapeTool()) {
    drawDot(point);
  }
  renderAllLayers();
}

function draw(event) {
  if (!isDrawing) return;
  event.preventDefault();

  if (isShapeTool()) {
    drawShapePreview(getPointerPoint(event));
    return;
  }

  const events = typeof event.getCoalescedEvents === "function"
    ? event.getCoalescedEvents()
    : [event];

  for (const coalescedEvent of events) {
    drawSmoothLine(getPointerPoint(coalescedEvent));
  }

  renderAllLayers();
}

function getPointDistance(startPoint, endPoint) {
  if (!startPoint || !endPoint) return 0;
  return Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
}

function stopDrawing(event) {
  if (!isDrawing) return;
  event.preventDefault();

  const targetCtx = getDrawingContext();
  const endPoint = getPointerPoint(event);

  if (targetCtx && isShapeTool() && shapeStartPoint) {
    if (getPointDistance(shapeStartPoint, endPoint) >= minShapeDistance) {
      saveHistory();
      drawShape(targetCtx, shapeStartPoint, endPoint);
    }
  } else if (targetCtx && lastPoint && previousPoint) {
    applyStrokeStyle(targetCtx);
    targetCtx.beginPath();
    targetCtx.moveTo(previousPoint.x, previousPoint.y);
    targetCtx.lineTo(lastPoint.x, lastPoint.y);
    targetCtx.stroke();
    resetAfterDrawing(targetCtx);
  }

  isDrawing = false;
  lastPoint = null;
  previousPoint = null;
  shapeStartPoint = null;

  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch (_) {
    // Pointer Captureが使えない環境では何もしない。
  }

  renderAllLayers();
}

function clearActiveLayerWithoutRender(layer) {
  layer.ctx.save();
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  layer.ctx.globalCompositeOperation = "source-over";
  layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  layer.ctx.restore();
  resetLayerDrawingSettings(layer.ctx);
}

function clearActiveLayer() {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  clearActiveLayerWithoutRender(activeLayer);
  renderAllLayers();
}

function clearCanvas() {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  const ok = window.confirm("現在のレイヤーを消去しますか？");
  if (!ok) return;

  saveHistory();
  clearActiveLayer();
  updateHintText();
  setHintVisible(areVisibleLayersEmpty());
}

function undo() {
  const item = history.pop();
  if (!item) return;

  restoreHistoryItem(item);
  updateUndoButton();
}

function addLayer() {
  if (layers.length >= maxLayers) return;

  saveHistory();

  const layer = createLayer(String(nextLayerNumber));
  if (!layer) return;

  layers.push(layer);
  activeLayerId = layer.id;
  nextLayerNumber += 1;

  updateLayerUI();
  renderAllLayers();
}

function duplicateActiveLayer() {
  const activeLayer = getActiveLayer();
  const index = getActiveLayerIndex();

  if (!activeLayer || index === -1) return;

  if (layers.length >= maxLayers) {
    alert(`レイヤーは最大${maxLayers}枚までです。不要なレイヤーを削除してください。`);
    return;
  }

  if (!activeLayer.visible) {
    alert("表示中のレイヤーのみ複製できます。");
    return;
  }

  const duplicatedLayer = createLayer(`${activeLayer.name} コピー`);
  if (!duplicatedLayer) return;

  saveHistory();

  duplicatedLayer.visible = true;
  duplicatedLayer.opacity = activeLayer.opacity ?? 1;
  duplicatedLayer.ctx.save();
  duplicatedLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  duplicatedLayer.ctx.globalCompositeOperation = "source-over";
  duplicatedLayer.ctx.globalAlpha = 1;
  duplicatedLayer.ctx.drawImage(activeLayer.canvas, 0, 0);
  duplicatedLayer.ctx.restore();
  resetLayerDrawingSettings(duplicatedLayer.ctx);

  layers.splice(index + 1, 0, duplicatedLayer);
  activeLayerId = duplicatedLayer.id;

  updateLayerUI();
  renderAllLayers();
}

function deleteActiveLayer() {
  if (layers.length <= 1) return;

  const index = getActiveLayerIndex();
  if (index === -1) return;

  saveHistory();

  layers.splice(index, 1);

  const nextActiveLayer = layers[index - 1] || layers[index] || layers[0];
  activeLayerId = nextActiveLayer ? nextActiveLayer.id : null;

  updateLayerUI();
  renderAllLayers();
}

function renameActiveLayer() {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  const newName = window.prompt("新しいレイヤー名を入力してください。", activeLayer.name);

  if (newName === null) return;

  const trimmedName = newName.trim();

  if (!trimmedName) {
    alert("レイヤー名は空欄にできません。");
    return;
  }

  saveHistory();

  activeLayer.name = trimmedName;

  updateLayerUI();
  renderAllLayers();
}

function moveActiveLayerUp() {
  const index = getActiveLayerIndex();
  if (index === -1 || index >= layers.length - 1) return;

  saveHistory();

  [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];

  updateLayerUI();
  renderAllLayers();
}

function moveActiveLayerDown() {
  const index = getActiveLayerIndex();
  if (index <= 0) return;

  saveHistory();

  [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];

  updateLayerUI();
  renderAllLayers();
}

function mergeActiveLayerDown() {
  const index = getActiveLayerIndex();
  if (index <= 0) return;

  const activeLayer = layers[index];
  const lowerLayer = layers[index - 1];

  if (!activeLayer || !lowerLayer) return;

  if (!activeLayer.visible) {
    alert("非表示のレイヤーは下へ結合できません。");
    return;
  }

  if (!lowerLayer.visible) {
    alert("結合先の下レイヤーが非表示のため、下へ結合できません。");
    return;
  }

  const ok = window.confirm("現在のレイヤーを下のレイヤーへ結合しますか？");
  if (!ok) return;

  saveHistory();

  lowerLayer.ctx.save();
  lowerLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  lowerLayer.ctx.globalCompositeOperation = "source-over";
  lowerLayer.ctx.globalAlpha = activeLayer.opacity ?? 1;
  lowerLayer.ctx.drawImage(activeLayer.canvas, 0, 0);
  lowerLayer.ctx.globalAlpha = 1;
  lowerLayer.ctx.restore();
  resetLayerDrawingSettings(lowerLayer.ctx);

  layers.splice(index, 1);
  activeLayerId = lowerLayer.id;

  updateLayerUI();
  renderAllLayers();
}

function toggleActiveLayerVisibility() {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  saveHistory();

  activeLayer.visible = !activeLayer.visible;

  updateLayerUI();
  renderAllLayers();
}

function updateActiveLayerOpacity() {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  const opacity = Math.max(0.1, Number(layerOpacityInput.value) / 100);
  if (opacity === (activeLayer.opacity ?? 1)) return;

  saveHistory();
  activeLayer.opacity = opacity;
  layerOpacityValue.textContent = `${Math.round(opacity * 100)}%`;

  renderAllLayers();
  updateStatus();
}

function createExportCanvas() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;

  const exportCtx = exportCanvas.getContext("2d");
  if (!exportCtx) return null;

  if (backgroundMode !== "transparent") {
    exportCtx.fillStyle = backgroundMode === "color" ? backgroundColor : "#ffffff";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  layers.forEach((layer) => {
    if (!layer.visible) return;
    exportCtx.globalAlpha = layer.opacity ?? 1;
    exportCtx.drawImage(layer.canvas, 0, 0);
    exportCtx.globalAlpha = 1;
  });

  return exportCanvas;
}

function savePng() {
  const exportCanvas = createExportCanvas();

  if (!exportCanvas) {
    alert("画像の保存に失敗しました。別のブラウザで試してください。");
    return;
  }

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      alert("画像の保存に失敗しました。別のブラウザで試してください。");
      return;
    }

    const now = new Date();
    const pad = (number) => String(number).padStart(2, "0");
    const fileName = `tegaki-memo-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.png`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function createImageLayerName() {
  const existingNames = new Set(layers.map((layer) => layer.name));
  if (!existingNames.has("画像")) return "画像";

  let number = 1;
  while (existingNames.has(`画像${number}`)) {
    number += 1;
  }

  return `画像${number}`;
}

function drawImportedImage(image, targetLayer, options = {}) {
  if (!targetLayer || !targetLayer.visible) return;

  if (options.clearBeforeDraw) {
    clearActiveLayerWithoutRender(targetLayer);
  }

  const scale = Math.min(
    targetLayer.canvas.width / image.naturalWidth,
    targetLayer.canvas.height / image.naturalHeight,
    1
  );

  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = (targetLayer.canvas.width - drawWidth) / 2;
  const drawY = (targetLayer.canvas.height - drawHeight) / 2;

  targetLayer.ctx.save();
  targetLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  targetLayer.ctx.globalCompositeOperation = "source-over";
  targetLayer.ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  targetLayer.ctx.restore();

  resetLayerDrawingSettings(targetLayer.ctx);
  setHintVisible(false);
  renderAllLayers();
}

function importImage(image) {
  const shouldCreateLayer = imageImportMode.value === "new-layer";

  if (shouldCreateLayer) {
    if (layers.length >= maxLayers) {
      alert(`レイヤーは最大${maxLayers}枚までです。現在レイヤーへ読み込むか、不要なレイヤーを削除してください。`);
      return;
    }

    const imageLayer = createLayer(createImageLayerName());
    if (!imageLayer) return;

    layers.push(imageLayer);
    activeLayerId = imageLayer.id;
    drawImportedImage(image, imageLayer, { clearBeforeDraw: false });
    updateLayerUI();
    return;
  }

  const activeLayer = getActiveLayer();

  if (!activeLayer || !activeLayer.visible) {
    alert("表示中のレイヤーを選択してから画像を読み込んでください。");
    return;
  }

  drawImportedImage(image, activeLayer, { clearBeforeDraw: true });
}

function loadImageFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください。");
    imageInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const image = new Image();

    image.onload = () => {
      if (imageImportMode.value === "new-layer" && layers.length >= maxLayers) {
        alert(`レイヤーは最大${maxLayers}枚までです。現在レイヤーへ読み込むか、不要なレイヤーを削除してください。`);
        imageInput.value = "";
        return;
      }

      saveHistory();
      importImage(image);
      imageInput.value = "";
    };

    image.onerror = () => {
      alert("画像の読み込みに失敗しました。");
      imageInput.value = "";
    };

    image.src = reader.result;
  };

  reader.onerror = () => {
    alert("ファイルの読み込みに失敗しました。");
    imageInput.value = "";
  };

  reader.readAsDataURL(file);
}

function initializeLayers() {
  layers = [];
  activeLayerId = null;
  nextLayerNumber = 1;

  const firstLayer = createLayer(String(nextLayerNumber));
  if (!firstLayer) return;

  layers.push(firstLayer);
  activeLayerId = firstLayer.id;
  nextLayerNumber += 1;

  updateLayerUI();
  renderAllLayers();
}

function setTool(tool) {
  currentTool = tool;
  updateHintText();

  if (isShapeTool(tool) || tool === "text") {
    setHintVisible(true);
  } else {
    setHintVisible(areVisibleLayersEmpty());
  }

  updateToolButtons();
}

penBtn.addEventListener("click", () => setTool("pen"));
markerBtn.addEventListener("click", () => setTool("marker"));
eraserBtn.addEventListener("click", () => setTool("eraser"));
lineBtn.addEventListener("click", () => setTool("line"));
rectBtn.addEventListener("click", () => setTool("rect"));
ellipseBtn.addEventListener("click", () => setTool("ellipse"));
arrowBtn.addEventListener("click", () => setTool("arrow"));
dashedLineBtn.addEventListener("click", () => setTool("dashedLine"));
textBtn.addEventListener("click", () => setTool("text"));

colorButtons.forEach((button) => {
  button.addEventListener("click", () => setColor(button.dataset.color));
});

customColor.addEventListener("input", (event) => {
  setColor(event.target.value);
});

sizeSelect.addEventListener("change", () => {
  currentSize = Number(sizeSelect.value);
  updateStatus();
});

backgroundModeSelect.addEventListener("change", () => {
  setBackgroundMode(backgroundModeSelect.value);
});

backgroundColorInput.addEventListener("change", () => {
  setBackgroundColor(backgroundColorInput.value);
});

loadImageBtn.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", loadImageFile);
layerOpacityInput.addEventListener("change", updateActiveLayerOpacity);

layerSelect.addEventListener("change", () => {
  activeLayerId = layerSelect.value;
  updateLayerUI();
});

addLayerBtn.addEventListener("click", addLayer);
duplicateLayerBtn.addEventListener("click", duplicateActiveLayer);
deleteLayerBtn.addEventListener("click", deleteActiveLayer);
renameLayerBtn.addEventListener("click", renameActiveLayer);
moveLayerUpBtn.addEventListener("click", moveActiveLayerUp);
moveLayerDownBtn.addEventListener("click", moveActiveLayerDown);
mergeLayerDownBtn.addEventListener("click", mergeActiveLayerDown);
toggleLayerVisibilityBtn.addEventListener("click", toggleActiveLayerVisibility);

clearBtn.addEventListener("click", clearCanvas);
undoBtn.addEventListener("click", undo);
saveBtn.addEventListener("click", savePng);

canvas.addEventListener("pointerdown", startDrawing, { passive: false });
canvas.addEventListener("pointermove", draw, { passive: false });
canvas.addEventListener("pointerup", stopDrawing, { passive: false });
canvas.addEventListener("pointercancel", stopDrawing, { passive: false });
canvas.addEventListener("pointerleave", stopDrawing, { passive: false });

window.addEventListener("resize", resizeCanvasIfNeeded);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
  });
}

resizeCanvasIfNeeded();
initializeLayers();
updateHintText();
updateToolButtons();
updateUndoButton();
updateBackgroundView();
