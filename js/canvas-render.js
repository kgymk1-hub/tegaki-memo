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
let renderAllLayersRequested = false;

function requestRenderAllLayers() {
  if (renderAllLayersRequested) return;

  renderAllLayersRequested = true;
  requestAnimationFrame(() => {
    renderAllLayersRequested = false;
    renderAllLayers();
  });
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
  renderPendingImagePreview();
  renderSelectionOverlay();
}

function renderPendingImagePreview() {
  if (!pendingImage) return;

  const centerX = pendingImage.x + pendingImage.width / 2;
  const centerY = pendingImage.y + pendingImage.height / 2;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.setLineDash([]);
  ctx.translate(centerX, centerY);
  ctx.rotate((pendingImage.rotation * Math.PI) / 180);
  ctx.drawImage(
    pendingImage.image,
    -pendingImage.drawWidth / 2,
    -pendingImage.drawHeight / 2,
    pendingImage.drawWidth,
    pendingImage.drawHeight
  );
  ctx.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2 * renderScale;
  ctx.setLineDash([6 * renderScale, 4 * renderScale]);
  ctx.strokeRect(pendingImage.x, pendingImage.y, pendingImage.width, pendingImage.height);
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
    layer.hasContent = snapshot ? layer.hasContent === true : false;
  });
}

function resizeCanvasIfNeeded() {
  const { width, height } = getDisplaySize();
  if (width === canvasWidth && height === canvasHeight) return;

  canvasWidth = width;
  canvasHeight = height;
  canvas.width = Math.max(1, Math.floor(canvasWidth * renderScale));
  canvas.height = Math.max(1, Math.floor(canvasHeight * renderScale));
  applyViewZoom({ preserveScroll: true });
  updateCanvasSizeInputs();

  resizeLayerCanvases();
  recenterPendingImage();
  renderAllLayers();
}
function updateBackgroundView() {
  canvas.classList.toggle("transparent-bg", backgroundMode === "transparent");

  if (backgroundMode === "white") {
    canvas.style.backgroundColor = "#ffffff";
  } else if (backgroundMode === "color") {
    canvas.style.backgroundColor = backgroundColor;
  } else {
    canvas.style.backgroundColor = "#ffffff";
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
function detectLayerHasContent(layer) {
  if (!layer?.canvas?.width || !layer?.canvas?.height) return false;

  const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  const pixels = imageData.data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return true;
  }

  return false;
}

function areVisibleLayersEmpty() {
  return !layers.some((layer) => layer.visible && layer.hasContent === true);
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
  if (alertIfPlacingImage()) return;

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

function resizeProjectCanvas(newWidth, newHeight) {
  if (alertIfPlacingImage()) return;

  const width = Math.round(Number(newWidth));
  const height = Math.round(Number(newHeight));

  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  if (width < 100 || height < 100 || width > 4000 || height > 4000) {
    alert("キャンバスサイズは100〜4000pxの範囲で指定してください。");
    return;
  }

  if (width === canvas.width && height === canvas.height) {
    updateCanvasSizeInputs();
    return;
  }

  const ok = window.confirm("キャンバスサイズを変更します。縮小すると、はみ出た部分は切り取られます。よろしいですか？");
  if (!ok) return;

  saveHistory();
  resetDrawingState();
  if (typeof resetSelectionState === "function") resetSelectionState();

  layers.forEach((layer) => {
    const tempCanvas = createSnapshotFromCanvas(layer.canvas);
    layer.canvas.width = width;
    layer.canvas.height = height;
    layer.ctx = layer.canvas.getContext("2d");

    layer.ctx.save();
    layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    layer.ctx.globalCompositeOperation = "source-over";
    layer.ctx.globalAlpha = 1;
    layer.ctx.setLineDash([]);
    layer.ctx.clearRect(0, 0, width, height);
    if (tempCanvas) layer.ctx.drawImage(tempCanvas, 0, 0);
    layer.ctx.restore();
    resetLayerDrawingSettings(layer.ctx);
    layer.hasContent = detectLayerHasContent(layer);
  });

  canvas.width = width;
  canvas.height = height;
  canvasWidth = Math.max(1, Math.round(width / renderScale));
  canvasHeight = Math.max(1, Math.round(height / renderScale));
  resetDisplaySettings();
  applyViewZoom({ preserveScroll: true });
  updateCanvasSizeInputs();
  updateSelectionControls();
  renderAllLayers();
  scheduleAutoSave();
}
