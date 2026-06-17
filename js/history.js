function createLayersSnapshot() {
  return layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity ?? 1,
    hasContent: layer.hasContent === true,
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
    backgroundColor,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    displayWidth: canvasWidth,
    displayHeight: canvasHeight
  });

  if (history.length > maxHistory) history.shift();
  updateUndoButton();
}

function restoreHistoryItem(item) {
  if (item.canvasWidth && item.canvasHeight) {
    canvas.width = item.canvasWidth;
    canvas.height = item.canvasHeight;
    canvasWidth = item.displayWidth || Math.round(item.canvasWidth / renderScale);
    canvasHeight = item.displayHeight || Math.round(item.canvasHeight / renderScale);
    resetDisplaySettings();
    applyViewZoom({ preserveScroll: true });
    updateCanvasSizeInputs();
  }

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

      const restoredLayer = {
        id: layerSnapshot.id,
        name: layerSnapshot.name,
        visible: layerSnapshot.visible,
        opacity: layerSnapshot.opacity ?? 1,
        hasContent: false,
        canvas: layerCanvas,
        ctx: layerCtx
      };
      restoredLayer.hasContent = typeof layerSnapshot.hasContent === "boolean"
        ? layerSnapshot.hasContent
        : detectLayerHasContent(restoredLayer);
      return restoredLayer;
    })
    .filter(Boolean);

  activeLayerId = item.activeLayerId;
  nextLayerNumber = item.nextLayerNumber;
  backgroundMode = item.backgroundMode ?? "white";
  backgroundColor = item.backgroundColor ?? "#ffffff";
  backgroundModeSelect.value = backgroundMode;
  backgroundColorInput.value = backgroundColor;
  updateHintText();
  setHintVisible(item.hintVisible || shouldShowInitialHint());
  updateBackgroundView();

  renderAllLayers();
  updateLayerUI();
}

function updateUndoButton() {
  undoBtn.disabled = history.length === 0;
}

function undo() {
  const item = history.pop();
  if (!item) return;

  restoreHistoryItem(item);
  updateUndoButton();
}
