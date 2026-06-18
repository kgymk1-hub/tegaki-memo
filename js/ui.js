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

  if (tool === "select") {
    return "選択範囲をドラッグして指定します。";
  }

  return "指やタッチペンでここに描けます";
}

function isPlacingImage() {
  return Boolean(pendingImage);
}

function updateImagePlacementBar() {
  const placingImage = isPlacingImage();
  if (imagePlacementBar) imagePlacementBar.hidden = !placingImage;
  document.body.classList.toggle("image-placing", placingImage);
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
    text: "文字",
    select: "選択"
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

  status.textContent = `ツール：${getToolLabel()} / 太さ：${sizeLabel} / ${layerLabel}`;
}

function updateToolButtons() {
  const placingImage = isPlacingImage();

  toolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === currentTool);
    button.disabled = placingImage;
  });

  updateStatus();
}

function alertIfPlacingImage() {
  if (!pendingImage) return false;

  alert(pendingImageActionMessage);
  return true;
}

function syncImagePlacementControls() {
  const placingImage = isPlacingImage();
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

  updateImagePlacementBar();
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
  syncImagePlacementControls();

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
  updateSelectionControls();
  if (imagePanel && placingImage) imagePanel.open = true;
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
  scheduleAutoSave();
}

function getCanvasSizePresetValue(preset) {
  const presets = {
    square: [1000, 1000],
    phonePortrait: [1080, 1920],
    phoneLandscape: [1920, 1080],
    a4Portrait: [1240, 1754],
    a4Landscape: [1754, 1240]
  };
  return presets[preset] || null;
}

function getPinchDistance() {
  const pointers = Array.from(activePointers.values());
  if (pointers.length < 2) return 0;
  return Math.hypot(pointers[0].clientX - pointers[1].clientX, pointers[0].clientY - pointers[1].clientY);
}

function getPinchClientCenter() {
  const pointers = Array.from(activePointers.values());
  return {
    x: (pointers[0].clientX + pointers[1].clientX) / 2,
    y: (pointers[0].clientY + pointers[1].clientY) / 2
  };
}

function handlePinchPointerDown(event) {
  activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  if (activePointers.size < 2) return false;

  event.preventDefault();
  isPinching = true;
  pinchStartDistance = getPinchDistance();
  pinchStartZoom = viewZoom;
  const center = getPinchClientCenter();
  const rect = canvas.getBoundingClientRect();
  pinchCenterCanvasPoint = {
    x: ((center.x - rect.left) * canvas.width) / Math.max(1, rect.width),
    y: ((center.y - rect.top) * canvas.height) / Math.max(1, rect.height)
  };
  if (isDrawing && !isShapeTool() && history.length > 0) {
    const lastHistoryItem = history.pop();
    restoreHistoryItem(lastHistoryItem);
    updateUndoButton();
  }
  resetDrawingState();
  if (typeof resetSelectionState === "function") resetSelectionState();
  if (pendingImage) pendingImage.isDragging = false;
  renderAllLayers();
  return true;
}

function handlePinchPointerMove(event) {
  if (!activePointers.has(event.pointerId)) return false;
  activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  if (!isPinching || activePointers.size < 2) return false;

  event.preventDefault();
  const distance = getPinchDistance();
  if (pinchStartDistance > 0) {
    viewZoom = pinchStartZoom * (distance / pinchStartDistance);
    applyViewZoom({ centerPoint: pinchCenterCanvasPoint, clientPoint: getPinchClientCenter() });
  }
  return true;
}

function handlePinchPointerEnd(event) {
  activePointers.delete(event.pointerId);
  if (!isPinching) return false;

  event.preventDefault();
  if (activePointers.size < 2) {
    isPinching = false;
    pinchStartDistance = 0;
    pinchCenterCanvasPoint = null;
    resetDrawingState();
    updateSelectionControls();
  }
  return true;
}

function toggleAdvancedControls() {
  const advancedControls = document.getElementById("advancedControls");
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  if (!advancedControls) return;
  const isOpen = advancedControls.classList.toggle("open");
  if (menuToggleBtn) menuToggleBtn.setAttribute("aria-expanded", String(isOpen));
}

function closeAdvancedControls() {
  const advancedControls = document.getElementById("advancedControls");
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  if (!advancedControls) return;
  advancedControls.classList.remove("open");
  if (menuToggleBtn) menuToggleBtn.setAttribute("aria-expanded", "false");
}

function bindEventListeners() {
  const menuToggleButton = document.getElementById("menuToggleBtn");
  const menuCloseButton = document.getElementById("menuCloseBtn");
  if (menuToggleButton) menuToggleButton.addEventListener("click", toggleAdvancedControls);
  if (menuCloseButton) menuCloseButton.addEventListener("click", closeAdvancedControls);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAdvancedControls();
  });

  penBtn.addEventListener("click", () => setTool("pen"));
  markerBtn.addEventListener("click", () => setTool("marker"));
  eraserBtn.addEventListener("click", () => setTool("eraser"));
  lineBtn.addEventListener("click", () => setTool("line"));
  rectBtn.addEventListener("click", () => setTool("rect"));
  ellipseBtn.addEventListener("click", () => setTool("ellipse"));
  arrowBtn.addEventListener("click", () => setTool("arrow"));
  dashedLineBtn.addEventListener("click", () => setTool("dashedLine"));
  textBtn.addEventListener("click", () => setTool("text"));
  selectBtn.addEventListener("click", () => setTool("select"));

  colorButtons.forEach((button) => {
    button.addEventListener("click", () => setColor(button.dataset.color));
  });

  customColor.addEventListener("input", (event) => {
    setColor(event.target.value);
  });

  sizeSelect.addEventListener("change", () => {
    currentSize = Number(sizeSelect.value);
    updateStatus();
    scheduleAutoSave();
  });

  backgroundModeSelect.addEventListener("change", () => {
    setBackgroundMode(backgroundModeSelect.value);
    scheduleAutoSave();
  });

  backgroundColorInput.addEventListener("change", () => {
    setBackgroundColor(backgroundColorInput.value);
    scheduleAutoSave();
  });

  loadImageBtn.addEventListener("click", () => {
    if (alertIfPlacingImage()) return;

    imageInput.click();
  });

  imageInput.addEventListener("change", loadImageFile);
  confirmImageBtn.addEventListener("click", confirmPendingImage);
  cancelImageBtn.addEventListener("click", cancelPendingImage);
  imageScaleInput.addEventListener("input", (event) => setPendingImageScale(event.target.value));
  rotateImageLeftBtn.addEventListener("click", () => rotatePendingImage(-90));
  rotateImageRightBtn.addEventListener("click", () => rotatePendingImage(90));
  copySelectionBtn.addEventListener("click", copySelection);
  cutSelectionBtn.addEventListener("click", cutSelection);
  pasteSelectionBtn.addEventListener("click", pasteSelection);
  clearSelectionBtn.addEventListener("click", clearSelection);
  layerOpacityInput.addEventListener("change", updateActiveLayerOpacity);

  canvasSizePreset.addEventListener("change", () => {
    const presetSize = getCanvasSizePresetValue(canvasSizePreset.value);
    if (!presetSize) return;
    canvasWidthInput.value = presetSize[0];
    canvasHeightInput.value = presetSize[1];
  });

  applyCanvasSizeBtn.addEventListener("click", () => {
    resizeProjectCanvas(canvasWidthInput.value, canvasHeightInput.value);
  });

  if (viewZoomInput) {
    viewZoomInput.addEventListener("change", applyZoomInputValue);
    viewZoomInput.addEventListener("blur", applyZoomInputValue);
    viewZoomInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyZoomInputValue();
        viewZoomInput.blur();
      }
    });
  }

  if (fitViewBtn) {
    fitViewBtn.addEventListener("click", fitViewToCanvas);
  }

  resetZoomBtn.addEventListener("click", () => {
    viewZoom = 1;
    applyViewZoom({ preserveScroll: true });
  });

  layerSelect.addEventListener("change", () => {
    activeLayerId = layerSelect.value;
    if (selection) {
      selection = null;
      isSelecting = false;
      selectionStartPoint = null;
      renderAllLayers();
    }
    updateLayerUI();
    refreshHint();
    scheduleAutoSave();
  });

  addLayerBtn.addEventListener("click", addLayer);
  duplicateLayerBtn.addEventListener("click", duplicateActiveLayer);
  deleteLayerBtn.addEventListener("click", deleteActiveLayer);
  renameLayerBtn.addEventListener("click", renameActiveLayer);
  moveLayerUpBtn.addEventListener("click", moveActiveLayerUp);
  moveLayerDownBtn.addEventListener("click", moveActiveLayerDown);
  mergeLayerDownBtn.addEventListener("click", mergeActiveLayerDown);
  toggleLayerVisibilityBtn.addEventListener("click", toggleActiveLayerVisibility);

  clearBtn.addEventListener("click", clearCurrentLayerWithConfirm);
  undoBtn.addEventListener("click", () => {
    undo();
    scheduleAutoSave();
  });
  clearAutoSaveBtn.addEventListener("click", async () => {
    const ok = window.confirm("前回作業データを削除しますか？");
    if (ok) await clearAutoSaveData();
  });
  saveBtn.addEventListener("click", savePng);
  saveProjectBtn.addEventListener("click", downloadProjectFile);
  loadProjectBtn.addEventListener("click", openProjectFilePicker);
  projectFileInput.addEventListener("change", handleProjectFileSelected);

  canvas.addEventListener("pointerdown", (event) => {
    if (handlePinchPointerDown(event)) return;
    if (!isPinching) startDrawing(event);
  }, { passive: false });
  canvas.addEventListener("pointermove", (event) => {
    if (handlePinchPointerMove(event)) return;
    if (!isPinching) draw(event);
  }, { passive: false });
  canvas.addEventListener("pointerup", (event) => {
    if (handlePinchPointerEnd(event)) return;
    if (!isPinching) stopDrawing(event);
  }, { passive: false });
  canvas.addEventListener("pointercancel", (event) => {
    if (handlePinchPointerEnd(event)) return;
    if (!isPinching) stopDrawing(event);
  }, { passive: false });
  canvas.addEventListener("pointerleave", (event) => {
    if (handlePinchPointerEnd(event)) return;

    activePointers.delete(event.pointerId);
    stopDrawing(event);
  }, { passive: false });

  window.addEventListener("resize", () => applyViewZoom({ preserveScroll: true }));
}
