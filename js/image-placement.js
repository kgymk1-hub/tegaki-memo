function createImageLayerName() {
  const existingNames = new Set(layers.map((layer) => layer.name));
  if (!existingNames.has("画像")) return "画像";

  let number = 1;
  while (existingNames.has(`画像${number}`)) {
    number += 1;
  }

  return `画像${number}`;
}

function drawImageToLayer(pending, targetLayer, options = {}) {
  if (!targetLayer || !targetLayer.visible) return false;

  if (options.clearBeforeDraw) {
    clearActiveLayerWithoutRender(targetLayer);
  }

  const centerX = pending.x + pending.width / 2;
  const centerY = pending.y + pending.height / 2;

  targetLayer.ctx.save();
  targetLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  targetLayer.ctx.globalCompositeOperation = "source-over";
  targetLayer.ctx.globalAlpha = 1;
  targetLayer.ctx.setLineDash([]);
  targetLayer.ctx.translate(centerX, centerY);
  targetLayer.ctx.rotate((pending.rotation * Math.PI) / 180);
  targetLayer.ctx.drawImage(
    pending.image,
    -pending.drawWidth / 2,
    -pending.drawHeight / 2,
    pending.drawWidth,
    pending.drawHeight
  );
  targetLayer.ctx.restore();

  resetLayerDrawingSettings(targetLayer.ctx);
  return true;
}


function updatePendingImageBounds({ keepCenter = true } = {}) {
  if (!pendingImage) return;

  const centerX = pendingImage.x + pendingImage.width / 2;
  const centerY = pendingImage.y + pendingImage.height / 2;
  const drawWidth = pendingImage.baseWidth * pendingImage.scale;
  const drawHeight = pendingImage.baseHeight * pendingImage.scale;
  const isRotatedSideways = pendingImage.rotation % 180 !== 0;

  pendingImage.drawWidth = drawWidth;
  pendingImage.drawHeight = drawHeight;
  pendingImage.width = isRotatedSideways ? drawHeight : drawWidth;
  pendingImage.height = isRotatedSideways ? drawWidth : drawHeight;

  if (keepCenter) {
    pendingImage.x = centerX - pendingImage.width / 2;
    pendingImage.y = centerY - pendingImage.height / 2;
  }
}

function setPendingImageScale(scalePercent) {
  if (!pendingImage) return;

  pendingImage.scale = Math.min(3, Math.max(0.1, Number(scalePercent) / 100));
  updatePendingImageBounds({ keepCenter: true });
  updateImagePlacementControls();
  renderAllLayers();
}

function rotatePendingImage(deltaDegrees) {
  if (!pendingImage) return;

  pendingImage.rotation = (pendingImage.rotation + deltaDegrees + 360) % 360;
  updatePendingImageBounds({ keepCenter: true });
  updateImagePlacementControls();
  renderAllLayers();
}

function updateImagePlacementControls() {
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
  loadImageBtn.disabled = false;
  imageImportMode.disabled = placingImage;
  updateToolButtons();
  updateLayerUI();
}

function calculateFittedImageRect(image) {
  const scale = Math.min(
    canvas.width / (image.naturalWidth || image.width),
    canvas.height / (image.naturalHeight || image.height),
    1
  );
  const width = (image.naturalWidth || image.width) * scale;
  const height = (image.naturalHeight || image.height) * scale;

  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height
  };
}

function recenterPendingImage() {
  if (!pendingImage) return;

  const placement = calculateFittedImageRect(pendingImage.image);
  pendingImage.baseWidth = placement.width;
  pendingImage.baseHeight = placement.height;
  pendingImage.scale = 1;
  pendingImage.rotation = pendingImage.rotation % 360;
  updatePendingImageBounds({ keepCenter: false });
  pendingImage.x = (canvas.width - pendingImage.width) / 2;
  pendingImage.y = (canvas.height - pendingImage.height) / 2;
  pendingImage.isDragging = false;
  updateImagePlacementControls();
}

function beginImagePlacement(image) {
  const targetMode = imageImportMode.value === "new-layer" ? "new" : "current";

  if (targetMode === "new" && layers.length >= maxLayers) {
    alert(`レイヤーは最大${maxLayers}枚までです。現在レイヤーへ読み込むか、不要なレイヤーを削除してください。`);
    return false;
  }

  const activeLayer = getActiveLayer();
  if (targetMode === "current" && !canDrawOnActiveLayer({ showHint: true })) {
    resetDrawingState();
    return false;
  }

  const placement = calculateFittedImageRect(image);
  pendingImage = {
    image,
    x: placement.x,
    y: placement.y,
    // baseWidth/baseHeightは配置開始時にキャンバスへ収めた未回転の表示サイズ。
    // drawWidth/drawHeightはscale適用後の未回転描画サイズ、width/heightは回転後の外接矩形。
    baseWidth: placement.width,
    baseHeight: placement.height,
    drawWidth: placement.width,
    drawHeight: placement.height,
    width: placement.width,
    height: placement.height,
    scale: 1,
    rotation: 0,
    targetMode,
    targetLayerId: targetMode === "current" ? activeLayer.id : null,
    layerName: targetMode === "new" ? createImageLayerName() : activeLayer.name,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  };

  resetDrawingState();
  setHintVisible(true);
  updateImagePlacementControls();
  closeAdvancedControls();
  renderAllLayers();
  return true;
}

function isPointInPendingImage(point) {
  if (!pendingImage) return false;

  return point.x >= pendingImage.x
    && point.x <= pendingImage.x + pendingImage.width
    && point.y >= pendingImage.y
    && point.y <= pendingImage.y + pendingImage.height;
}

function startPendingImageDrag(event) {
  const point = getPointerCanvasPoint(event);

  if (!isPointInPendingImage(point)) {
    setHintVisible(true);
    return;
  }

  pendingImage.isDragging = true;
  pendingImage.dragOffsetX = point.x - pendingImage.x;
  pendingImage.dragOffsetY = point.y - pendingImage.y;
  setHintVisible(false);

  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (_) {
    // Pointer Capture非対応環境では無視する。
  }
}

function movePendingImage(event) {
  if (!pendingImage?.isDragging) return;
  event.preventDefault();

  const point = getPointerCanvasPoint(event);
  pendingImage.x = point.x - pendingImage.dragOffsetX;
  pendingImage.y = point.y - pendingImage.dragOffsetY;
  renderAllLayers();
}

function stopPendingImageDrag(event) {
  if (!pendingImage?.isDragging) return;
  event.preventDefault();

  pendingImage.isDragging = false;

  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch (_) {
    // Pointer Capture非対応環境では無視する。
  }

  renderAllLayers();
}

function confirmPendingImage() {
  if (!pendingImage) return;

  if (pendingImage.targetMode === "new" && layers.length >= maxLayers) {
    alert(`レイヤーは最大${maxLayers}枚までです。不要なレイヤーを削除してください。`);
    return;
  }

  const pending = pendingImage;
  let targetLayer = null;
  let shouldClearBeforeDraw = false;

  if (pending.targetMode === "new") {
    targetLayer = createLayer(createImageLayerName());
    if (!targetLayer) return;
  } else {
    targetLayer = layers.find((layer) => layer.id === pending.targetLayerId) || null;
    shouldClearBeforeDraw = pending.source !== "clipboard";

    if (!targetLayer) {
      alert("画像読込先のレイヤーが見つかりません。画像を取消してから再度読み込んでください。");
      return;
    }

    if (!targetLayer.visible) {
      alert("非表示レイヤーには画像を確定できません。表示に切り替えるか、取消してください。");
      return;
    }
  }

  saveHistory();

  if (pending.targetMode === "new") {
    layers.push(targetLayer);
    activeLayerId = targetLayer.id;
  }

  drawImageToLayer(pending, targetLayer, { clearBeforeDraw: shouldClearBeforeDraw });
  pendingImage = null;
  setHintVisible(false);
  updateSelectionControls();
  updateImagePlacementControls();
  renderAllLayers();
  scheduleAutoSave();
}

function cancelPendingImage() {
  if (!pendingImage) return;

  pendingImage = null;
  updateSelectionControls();
  setHintVisible(shouldShowInitialHint());
  updateImagePlacementControls();
  renderAllLayers();
}

function loadImageFile(event) {
  if (pendingImage) {
    alert("画像を確定または取消してください。");
    imageInput.value = "";
    return;
  }

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
      beginImagePlacement(image);
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
