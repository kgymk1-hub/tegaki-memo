function canSelectOnActiveLayer({ showHint = false } = {}) {
  if (pendingImage) return false;

  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    if (showHint) showDrawingUnavailableHint(noDrawableLayerMessage);
    return false;
  }

  if (!activeLayer.visible) {
    if (showHint) showDrawingUnavailableHint("非表示レイヤーは選択できません。表示に切り替えるか、別のレイヤーを選択してください。");
    return false;
  }

  return true;
}

function normalizeSelectionRect(startPoint, endPoint) {
  const x = Math.min(startPoint.x, endPoint.x);
  const y = Math.min(startPoint.y, endPoint.y);
  const width = Math.abs(endPoint.x - startPoint.x);
  const height = Math.abs(endPoint.y - startPoint.y);
  return { x, y, width, height };
}

function clampSelectionRect(rect) {
  const x = Math.max(0, Math.min(canvas.width, rect.x));
  const y = Math.max(0, Math.min(canvas.height, rect.y));
  const right = Math.max(0, Math.min(canvas.width, rect.x + rect.width));
  const bottom = Math.max(0, Math.min(canvas.height, rect.y + rect.height));
  return {
    x: Math.round(Math.min(x, right)),
    y: Math.round(Math.min(y, bottom)),
    width: Math.round(Math.abs(right - x)),
    height: Math.round(Math.abs(bottom - y))
  };
}

function createSelectionFromPoints(startPoint, endPoint) {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return null;

  const rect = clampSelectionRect(normalizeSelectionRect(startPoint, endPoint));
  if (rect.width < minSelectionSize || rect.height < minSelectionSize) return null;

  return {
    layerId: activeLayer.id,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function startSelection(point) {
  if (!canSelectOnActiveLayer({ showHint: true })) return false;
  isSelecting = true;
  selectionStartPoint = point;
  selection = null;
  setHintVisible(false);
  updateSelectionControls();
  renderAllLayers();
  return true;
}

function updateSelection(point) {
  if (!isSelecting || !selectionStartPoint) return;
  selection = createSelectionFromPoints(selectionStartPoint, point);
  renderAllLayers();
}

function finishSelection(point) {
  if (!isSelecting) return;
  selection = selectionStartPoint ? createSelectionFromPoints(selectionStartPoint, point) : null;
  isSelecting = false;
  selectionStartPoint = null;
  if (!selection) setHintVisible(true);
  updateSelectionControls();
  renderAllLayers();
}

function resetSelectionState() {
  selection = null;
  isSelecting = false;
  selectionStartPoint = null;
}

function clearSelection() {
  resetSelectionState();
  updateSelectionControls();
  renderAllLayers();
  refreshHint();
}

function hasActiveSelectionOnVisibleLayer() {
  const activeLayer = getActiveLayer();
  return Boolean(selection && activeLayer && activeLayer.visible && selection.layerId === activeLayer.id && !pendingImage);
}

function updateSelectionControls() {
  if (!copySelectionBtn) return;
  const activeLayer = getActiveLayer();
  const hasSelection = Boolean(selection && activeLayer && selection.layerId === activeLayer.id);
  const canUseSelection = hasActiveSelectionOnVisibleLayer();
  const canPaste = Boolean(clipboardImageData && activeLayer && activeLayer.visible && !pendingImage);

  copySelectionBtn.disabled = !canUseSelection;
  cutSelectionBtn.disabled = !canUseSelection;
  clearSelectionBtn.disabled = !hasSelection || Boolean(pendingImage);
  pasteSelectionBtn.disabled = !canPaste;
}

function renderSelectionOverlay() {
  if (!selection || pendingImage) return;
  if (selection.layerId !== activeLayerId) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2 * renderScale;
  ctx.setLineDash([6 * renderScale, 4 * renderScale]);
  ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
  ctx.setLineDash([]);
  ctx.restore();
  resetDisplaySettings();
}

function copySelection() {
  if (!hasActiveSelectionOnVisibleLayer()) return;
  const activeLayer = getActiveLayer();
  clipboardImageData = {
    width: selection.width,
    height: selection.height,
    imageData: activeLayer.ctx.getImageData(selection.x, selection.y, selection.width, selection.height)
  };
  updateSelectionControls();
  status.textContent = "選択範囲をコピーしました";
}

function cutSelection() {
  if (!hasActiveSelectionOnVisibleLayer()) return;
  const activeLayer = getActiveLayer();
  saveHistory();
  clipboardImageData = {
    width: selection.width,
    height: selection.height,
    imageData: activeLayer.ctx.getImageData(selection.x, selection.y, selection.width, selection.height)
  };
  activeLayer.ctx.save();
  activeLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  activeLayer.ctx.clearRect(selection.x, selection.y, selection.width, selection.height);
  activeLayer.ctx.restore();
  resetLayerDrawingSettings(activeLayer.ctx);
  renderAllLayers();
  updateSelectionControls();
  scheduleAutoSave();
  status.textContent = "選択範囲を切り取りました";
}

function pasteSelection() {
  const activeLayer = getActiveLayer();
  if (!clipboardImageData || pendingImage || !activeLayer || !activeLayer.visible) return;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = clipboardImageData.width;
  sourceCanvas.height = clipboardImageData.height;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return;
  sourceCtx.putImageData(clipboardImageData.imageData, 0, 0);

  const pasteX = selection?.layerId === activeLayer.id ? selection.x : (canvas.width - clipboardImageData.width) / 2;
  const pasteY = selection?.layerId === activeLayer.id ? selection.y : (canvas.height - clipboardImageData.height) / 2;

  pendingImage = {
    image: sourceCanvas,
    x: Math.max(0, Math.min(canvas.width - clipboardImageData.width, pasteX)),
    y: Math.max(0, Math.min(canvas.height - clipboardImageData.height, pasteY)),
    baseWidth: clipboardImageData.width,
    baseHeight: clipboardImageData.height,
    drawWidth: clipboardImageData.width,
    drawHeight: clipboardImageData.height,
    width: clipboardImageData.width,
    height: clipboardImageData.height,
    scale: 1,
    rotation: 0,
    source: "clipboard",
    targetMode: "current",
    targetLayerId: activeLayer.id,
    layerName: activeLayer.name,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  };

  clearSelection();
  setHintVisible(true);
  updateImagePlacementControls();
  renderAllLayers();
  status.textContent = "貼り付け位置を調整して確定してください";
}
