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

function isPlacingImage() {
  return Boolean(pendingImage);
}

function shouldShowInitialHint() {
  if (isPlacingImage()) return true;

  const activeLayer = getActiveLayer();

  if (!activeLayer) return true;
  if (!activeLayer.visible) return true;
  if (isShapeTool() || currentTool === "text") return true;

  return areVisibleLayersEmpty();
}

function updateHintText() {
  if (pendingImage) {
    hint.textContent = "画像をドラッグで移動し、倍率・90°回転を調整してから確定または取消してください";
    return;
  }

  const activeLayer = getActiveLayer();

  if (activeLayer && !activeLayer.visible) {
    hint.textContent = hiddenLayerDrawingMessage;
    return;
  }

  hint.textContent = getToolHintText();
}

function refreshHint() {
  updateHintText();
  setHintVisible(shouldShowInitialHint());
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
  if (pendingImage) {
    status.textContent = "画像配置中：ドラッグで移動 / 確定または取消してください";
    return;
  }

  const sizeLabel = sizeSelect.options[sizeSelect.selectedIndex].text;
  const activeLayer = getActiveLayer();

  const layerLabel = activeLayer
    ? activeLayer.visible ? activeLayer.name : `${activeLayer.name}（非表示）`
    : "レイヤーなし";

  status.textContent = `ペン：${getToolLabel()} / 太さ：${sizeLabel} / ${layerLabel}`;
}

function updateToolButtons() {
  const placingImage = isPlacingImage();

  toolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === currentTool);
    button.disabled = placingImage;
  });

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

  const placingImage = isPlacingImage();

  addLayerBtn.disabled = placingImage || layers.length >= maxLayers;
  duplicateLayerBtn.disabled = placingImage || !activeLayer || !activeLayer.visible || layers.length >= maxLayers;
  deleteLayerBtn.disabled = placingImage || layers.length <= 1;
  renameLayerBtn.disabled = placingImage || !activeLayer;
  toggleLayerVisibilityBtn.disabled = placingImage || !activeLayer;
  layerOpacityInput.disabled = placingImage || !activeLayer;
  moveLayerUpBtn.disabled = placingImage || !activeLayer || activeIndex === layers.length - 1;
  moveLayerDownBtn.disabled = placingImage || !activeLayer || activeIndex <= 0;
  const lowerLayer = activeIndex > 0 ? layers[activeIndex - 1] : null;
  mergeLayerDownBtn.disabled = placingImage || !activeLayer || activeIndex <= 0 || !activeLayer.visible || !lowerLayer?.visible;
  layerSelect.disabled = placingImage;
  confirmImageBtn.disabled = !placingImage;
  cancelImageBtn.disabled = !placingImage;
  imageScaleInput.disabled = !placingImage;
  rotateImageLeftBtn.disabled = !placingImage;
  rotateImageRightBtn.disabled = !placingImage;

  if (placingImage) {
    const scalePercent = Math.round(pendingImage.scale * 100);
    imageScaleInput.value = scalePercent;
    imageScaleValue.textContent = `${scalePercent}%`;
  } else {
    imageScaleInput.value = 100;
    imageScaleValue.textContent = "100%";
  }

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
  refreshHint();
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

function bindEventListeners() {
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
    if (pendingImage) {
      alert("画像を確定または取消してください。");
      return;
    }

    imageInput.click();
  });

  imageInput.addEventListener("change", loadImageFile);
  confirmImageBtn.addEventListener("click", confirmPendingImage);
  cancelImageBtn.addEventListener("click", cancelPendingImage);
  imageScaleInput.addEventListener("input", (event) => setPendingImageScale(event.target.value));
  rotateImageLeftBtn.addEventListener("click", () => rotatePendingImage(-90));
  rotateImageRightBtn.addEventListener("click", () => rotatePendingImage(90));
  layerOpacityInput.addEventListener("change", updateActiveLayerOpacity);

  layerSelect.addEventListener("change", () => {
    activeLayerId = layerSelect.value;
    updateLayerUI();
    refreshHint();
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
}
