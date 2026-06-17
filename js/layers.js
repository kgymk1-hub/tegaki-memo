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
  scheduleAutoSave();
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
  resetSelectionState();

  updateLayerUI();
  updateSelectionControls();
  renderAllLayers();
  scheduleAutoSave();
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
  resetSelectionState();

  updateLayerUI();
  updateSelectionControls();
  renderAllLayers();
  scheduleAutoSave();
}

function deleteActiveLayer() {
  if (layers.length <= 1) return;

  const index = getActiveLayerIndex();
  if (index === -1) return;

  saveHistory();

  layers.splice(index, 1);

  const nextActiveLayer = layers[index - 1] || layers[index] || layers[0];
  activeLayerId = nextActiveLayer ? nextActiveLayer.id : null;
  resetSelectionState();

  updateLayerUI();
  updateSelectionControls();
  renderAllLayers();
  scheduleAutoSave();
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
  scheduleAutoSave();
}

function moveActiveLayerUp() {
  const index = getActiveLayerIndex();
  if (index === -1 || index >= layers.length - 1) return;

  saveHistory();

  [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];

  updateLayerUI();
  renderAllLayers();
  scheduleAutoSave();
}

function moveActiveLayerDown() {
  const index = getActiveLayerIndex();
  if (index <= 0) return;

  saveHistory();

  [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];

  updateLayerUI();
  renderAllLayers();
  scheduleAutoSave();
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
  resetSelectionState();

  updateLayerUI();
  updateSelectionControls();
  renderAllLayers();
  scheduleAutoSave();
}

function toggleActiveLayerVisibility() {
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  saveHistory();

  activeLayer.visible = !activeLayer.visible;
  if (!activeLayer.visible && selection?.layerId === activeLayer.id) clearSelection();

  updateLayerUI();
  refreshHint();
  renderAllLayers();
  scheduleAutoSave();
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
  scheduleAutoSave();
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
