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
  recenterPendingImage();
  renderAllLayers();
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
  if (pendingImage) {
    alert("画像を確定または取消してください。");
    return;
  }

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
