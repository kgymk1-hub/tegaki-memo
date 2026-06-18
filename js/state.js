const APP_VERSION = "1.0.0";

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
const selectBtn = document.getElementById("selectBtn");
const eraserBtn = document.getElementById("eraserBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const loadProjectBtn = document.getElementById("loadProjectBtn");
const projectFileInput = document.getElementById("projectFileInput");
const clearAutoSaveBtn = document.getElementById("clearAutoSaveBtn");
const customColor = document.getElementById("customColor");
const sizeSelect = document.getElementById("sizeSelect");
const status = document.getElementById("status");
const hint = document.getElementById("hint");
const colorButtons = Array.from(document.querySelectorAll(".colorBtn"));
const toolButtons = [
  penBtn,
  markerBtn,
  eraserBtn,
  lineBtn,
  rectBtn,
  ellipseBtn,
  arrowBtn,
  dashedLineBtn,
  textBtn,
  selectBtn
];

const backgroundModeSelect = document.getElementById("backgroundModeSelect");
const backgroundColorInput = document.getElementById("backgroundColorInput");
const loadImageBtn = document.getElementById("loadImageBtn");
const imageInput = document.getElementById("imageInput");
const imageImportMode = document.getElementById("imageImportMode");
const confirmImageBtn = document.getElementById("confirmImageBtn");
const cancelImageBtn = document.getElementById("cancelImageBtn");
const imageScaleInput = document.getElementById("imageScaleInput");
const imageScaleValue = document.getElementById("imageScaleValue");
const rotateImageLeftBtn = document.getElementById("rotateImageLeftBtn");
const rotateImageRightBtn = document.getElementById("rotateImageRightBtn");
const imagePlacementBar = document.getElementById("imagePlacementBar");
const copySelectionBtn = document.getElementById("copySelectionBtn");
const cutSelectionBtn = document.getElementById("cutSelectionBtn");
const pasteSelectionBtn = document.getElementById("pasteSelectionBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const canvasWidthInput = document.getElementById("canvasWidthInput");
const canvasHeightInput = document.getElementById("canvasHeightInput");
const canvasSizePreset = document.getElementById("canvasSizePreset");
const applyCanvasSizeBtn = document.getElementById("applyCanvasSizeBtn");
const zoomValue = document.getElementById("zoomValue");
const viewZoomInput = document.getElementById("viewZoomInput");
const fitViewBtn = document.getElementById("fitViewBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
const imagePanel = document.getElementById("imagePanel");
const quickCategoryRow = document.getElementById("quickCategoryRow");
const quickPanelRow = document.getElementById("quickPanelRow");
const quickPanelContents = Array.from(document.querySelectorAll("[data-quick-panel-content]"));
const quickCategoryButtons = Array.from(document.querySelectorAll("[data-quick-panel]"));

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
const minSelectionSize = 4;
const hiddenLayerDrawingMessage = "非表示レイヤーには描画できません。表示に切り替えるか、別のレイヤーを選択してください。";
const noDrawableLayerMessage = "描画できるレイヤーがありません。";
const pendingImageActionMessage = "画像を確定または取消してください。";
// renderScale は高DPI端末向けの内部解像度倍率。
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
// canvas.width / canvas.height は実際の内部ピクセルサイズ。
// canvasWidth / canvasHeight はCSS表示上の基準サイズ。
let canvasWidth = 0;
let canvasHeight = 0;
let history = [];
let pendingImage = null;
let selection = null;
let clipboardImageData = null;
let isSelecting = false;
let selectionStartPoint = null;
let viewZoom = 1;
let activeQuickPanel = "";
let isPinching = false;
let pinchStartDistance = 0;
let pinchStartZoom = 1;
let pinchCenterCanvasPoint = null;
const minViewZoom = 0.05;
const maxViewZoom = 4;
const activePointers = new Map();

let layers = [];
let activeLayerId = null;
let nextLayerNumber = 1;
