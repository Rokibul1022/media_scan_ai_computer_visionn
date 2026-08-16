"""
MediScan AI - Vision Detection Service (YOLO + OpenCV fallback)

Runs YOLOv8 bone-fracture / anomaly detection on medical X-ray / scan images and
returns findings with normalized bounding boxes (0-1) so the frontend can draw
markers directly on the image.

Run inside the venv:
    server/venv/bin/python -m uvicorn vision_service:app --host 0.0.0.0 --port 5070
"""

import io
import os
import gc
import math
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse

# Keep CPU/memory usage low on shared/limited instances (e.g. Render Standard).
# Set BEFORE torch/ultralytics are imported (they are imported lazily below).
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "2")

app = FastAPI(title="MediScan Vision Service", version="1.0.0")

MODEL_PATH = os.getenv(
    "YOLO_MODEL",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "yolov8_fracture_best.pt"),
)
CONF_THRESHOLD = float(os.getenv("YOLO_CONF", "0.15"))
# Downscale incoming images to at most this many pixels on the long edge before
# any processing. YOLO internally resizes to 640 anyway, so full-res decoding
# only wastes memory (phone X-ray photos can be 12MP+ and OOM a 2GB instance).
MAX_IMG_DIM = int(os.getenv("MAX_IMG_DIM", "1280"))

_model = None
_model_names = {}


def load_model():
    """Load the YOLO model once (lazy). Returns (model, names) or (None, {})."""
    global _model, _model_names
    if _model is not None:
        return _model, _model_names
    try:
        from ultralytics import YOLO

        if not os.path.exists(MODEL_PATH):
            print(f"[vision] model not found at {MODEL_PATH} - using OpenCV fallback")
            return None, {}
        print(f"[vision] loading YOLO model from {MODEL_PATH} ...")
        import torch

        torch.set_num_threads(1)
        _model = YOLO(MODEL_PATH)
        _model_names = _model.names if hasattr(_model, "names") else {}
        print(f"[vision] model ready. classes: {_model_names}")
        return _model, _model_names
    except Exception as e:
        print(f"[vision] could not load YOLO model ({e}) - using OpenCV fallback")
        return None, {}


# ------------------------------------------------------------------
# OpenCV heuristic anomaly detection (works without a trained model)
# ------------------------------------------------------------------

def _cluster_boxes(cells, cell_w, cell_h):
    """Merge adjacent dense cells into rectangular regions (normalized)."""
    regions = []
    taken = set()
    for i, (r, c) in enumerate(cells):
        if i in taken:
            continue
        cluster = {(r, c)}
        taken.add(i)
        changed = True
        while changed:
            changed = False
            for j, (r2, c2) in enumerate(cells):
                if j in taken:
                    continue
                for (r1, c1) in cluster:
                    if abs(r1 - r2) <= 1 and abs(c1 - c2) <= 1:
                        cluster.add((r2, c2))
                        taken.add(j)
                        changed = True
                        break
        rows = [x[0] for x in cluster]
        cols = [x[1] for x in cluster]
        regions.append((min(rows), max(rows), min(cols), max(cols)))
    return regions


def _box_from_contour(cnt, w, h, pad=0.04):
    """Convert a contour to a normalized box with padding, clamped to image."""
    x, y, bw, bh = cv2.boundingRect(cnt)
    padx, pady = pad * w, pad * h
    x0 = max(0.0, x - padx) / w
    y0 = max(0.0, y - pady) / h
    x1 = min(1.0, (x + bw + padx) / w)
    y1 = min(1.0, (y + bh + pady) / h)
    return {
        "x": round(x0, 4),
        "y": round(y0, 4),
        "width": round(max(0.01, x1 - x0), 4),
        "height": round(max(0.01, y1 - y0), 4),
    }


def _box_iou(a, b):
    """Intersection-over-union of two normalized boxes (dicts with x,y,width,height)."""
    ax1, ay1 = a["x"], a["y"]
    ax2, ay2 = ax1 + a["width"], ay1 + a["height"]
    bx1, by1 = b["x"], b["y"]
    bx2, by2 = bx1 + b["width"], by1 + b["height"]
    iw = max(0.0, min(ax2, bx2) - max(ax1, bx1))
    ih = max(0.0, min(ay2, by2) - max(ay1, by1))
    inter = iw * ih
    union = a["width"] * a["height"] + b["width"] * b["height"] - inter
    return inter / union if union > 0 else 0.0


def _merge_close_same(findings, gap=0.35):
    """
    Collapse findings that share label + description and sit near each other
    (e.g. several boxes along the same fracture line) into one union box.
    Runs to a fixpoint so a chain of touching segments merges into a single
    box, and keeps the highest confidence.
    """
    work = [dict(f) for f in findings]
    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(work):
            a = work[i]
            j = i + 1
            while j < len(work):
                b = work[j]
                if a.get("label") == b.get("label") and a.get("description") == b.get("description"):
                    ba, bb = a["box"], b["box"]
                    ax1, ay1 = ba["x"], ba["y"]
                    ax2, ay2 = ax1 + ba["width"], ay1 + ba["height"]
                    bx1, by1 = bb["x"], bb["y"]
                    bx2, by2 = bx1 + bb["width"], by1 + bb["height"]
                    dx = max(0.0, max(ax1, bx1) - min(ax2, bx2))
                    dy = max(0.0, max(ay1, by1) - min(ay2, by2))
                    gap_x = gap * max(ba["width"], bb["width"])
                    gap_y = gap * max(ba["height"], bb["height"])
                    if dx <= gap_x and dy <= gap_y:
                        a["box"] = {
                            "x": round(min(ax1, bx1), 4),
                            "y": round(min(ay1, by1), 4),
                            "width": round(max(ax2, bx2) - min(ax1, bx1), 4),
                            "height": round(max(ay2, by2) - min(ay1, by1), 4),
                        }
                        a["confidence"] = max(a.get("confidence") or 0, b.get("confidence") or 0)
                        work.pop(j)
                        changed = True
                        continue
                j += 1
            i += 1
    return work


def nms_findings(findings, iou_thr=0.3, max_n=8):
    """Non-max suppression: drop boxes that heavily overlap an already-kept box."""
    kept = []
    for f in sorted(findings, key=lambda f: -f.get("confidence", 0)):
        if any(_box_iou(f["box"], k["box"]) > iou_thr for k in kept):
            continue
        kept.append(f)
        if len(kept) >= max_n:
            break
    return kept


def classify_image(gray):
    """Cheap check: scanned text document (bright bg) vs medical scan / X-ray (dark bg)."""
    mean = float(gray.mean())
    white = float((gray > 200).mean())
    if mean > 130 and white > 0.30:
        return "document"
    return "scan"


def _downscale(img, max_dim=MAX_IMG_DIM):
    """Resize so the longest edge is <= max_dim. Returns (img, w, h)."""
    h, w = img.shape[:2]
    m = max(h, w)
    if m <= max_dim:
        return img, w, h
    scale = max_dim / m
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    return cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA), nw, nh


def opencv_anomalies(img_rgb, img_w, img_h):
    """
    Detect suspicious regions on X-rays / scans without a trained model.

    Strategy (targets fracture and lesion signatures):
      1. Black-hat morphology  -> dark cracks/gaps inside bright bone (fracture lines)
      2. White-hat morphology  -> bright dense blobs (lesions, hardware)
      3. Saliency: cells whose local contrast stands out vs the surrounding grid
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    scale = 1024.0 / max(img_w, img_h)
    gw, gh = max(64, int(round(img_w * scale))), max(64, int(round(img_h * scale)))
    gray = cv2.resize(gray, (gw, gh), interpolation=cv2.INTER_AREA)

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    eq = clahe.apply(gray)
    blur = cv2.GaussianBlur(eq, (5, 5), 0)
    h, w = blur.shape

    findings = []

    # ---- 1. Dark crack lines within bright bone (fractures) ----
    crack_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    blackhat = cv2.morphologyEx(blur, cv2.MORPH_BLACKHAT, crack_kernel)
    # bone = bright tissue mask
    _, bone = cv2.threshold(blur, 110, 255, cv2.THRESH_BINARY)
    bone = cv2.morphologyEx(bone, cv2.MORPH_DILATE, np.ones((15, 15), np.uint8))
    _, crack_mask = cv2.threshold(blackhat, 35, 255, cv2.THRESH_BINARY)
    crack_mask = cv2.bitwise_and(crack_mask, bone)
    crack_mask = cv2.morphologyEx(crack_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(crack_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        area = bw * bh
        if area < 0.004 * w * h or area > 0.35 * w * h:
            continue
        # fracture lines tend to be elongated
        aspect = max(bw, bh) / max(1.0, min(bw, bh))
        label = "Possible fracture line" if aspect > 2.2 else "Possible irregularity"
        findings.append({
            "label": label,
            "description": "A crack-like dark structure was detected inside the bone. Please have a radiologist confirm.",
            "severity": "warning",
            "confidence": round(min(0.92, 0.55 + 0.15 * min(3.0, area / (0.02 * w * h))), 3),
            "box": _box_from_contour(cnt, w, h),
        })

    # ---- 2. Bright dense blobs (lesions / hardware / foreign bodies) ----
    tophat = cv2.morphologyEx(blur, cv2.MORPH_TOPHAT, crack_kernel)
    _, bright_mask = cv2.threshold(tophat, 28, 255, cv2.THRESH_BINARY)
    bright_mask = cv2.morphologyEx(bright_mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(bright_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        area = bw * bh
        if area < 0.005 * w * h or area > 0.3 * w * h:
            continue
        findings.append({
            "label": "Dense bright spot",
            "description": "A very dense bright region was detected. Worth a second look by a radiologist.",
            "severity": "warning",
            "confidence": 0.7,
            "box": _box_from_contour(cnt, w, h),
        })

    # ---- 3. Grid symmetry check: flag cells that differ from their mirror cell ----
    # (fractures/lesions usually break left-right or axis symmetry on a scan)
    grid = 10
    cell_h, cell_w = h // grid, w // grid
    body = cv2.threshold(blur, 60, 255, cv2.THRESH_BINARY)[1]
    body = cv2.morphologyEx(body, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    for r in range(grid):
        for c in range(grid):
            if c == 0 or c >= grid // 2:
                continue
            mr = grid - 1 - c
            cell_a = blur[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w]
            cell_b = blur[r * cell_h:(r + 1) * cell_h, mr * cell_w:(mr + 1) * cell_w]
            # both cells must overlap body
            a_body = float(np.count_nonzero(body[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w]))
            b_body = float(np.count_nonzero(body[r * cell_h:(r + 1) * cell_h, mr * cell_w:(mr + 1) * cell_w]))
            if a_body / (cell_h * cell_w) < 0.4 or b_body / (cell_h * cell_w) < 0.4:
                continue
            diff = abs(float(cell_a.mean()) - float(cell_b.mean()))
            if diff > 38:
                findings.append({
                    "label": "Asymmetric region",
                    "description": "This area differs noticeably from its mirrored counterpart, which can indicate a fault.",
                    "severity": "warning",
                    "confidence": round(min(0.85, 0.5 + diff / 140), 3),
                    "box": {
                        "x": round((c * cell_w) / w, 4),
                        "y": round((r * cell_h) / h, 4),
                        "width": round(cell_w / w, 4),
                        "height": round(cell_h / h, 4),
                    },
                })

    # ---- merge + NMS: collapse duplicate / overlapping findings into one ----
    return nms_findings(_merge_close_same(findings))


# ------------------------------------------------------------------
# Endpoint
# ------------------------------------------------------------------

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        img_arr = np.frombuffer(raw, np.uint8)
        img_bgr = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return JSONResponse(status_code=400, content={"error": "Could not decode image"})
        del img_arr, raw
        # Downscale before any heavy work to keep memory flat on small instances.
        img_bgr, w, h = _downscale(img_bgr)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    # Report/document images must NOT be scanned for faults — read, don't mark.
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    image_type = classify_image(gray)
    if image_type == "document":
        return {
            "engine": "none",
            "image_type": "document",
            "model_available": False,
            "findings": [],
            "note": "This looks like a report/document rather than a medical scan — its text was read instead of scanning for faults.",
        }

    model, names = load_model()
    yolo_findings = []
    opencv_findings = opencv_anomalies(img_rgb, w, h)

    if model is not None:
        try:
            results = model(img_bgr, conf=CONF_THRESHOLD, imgsz=640, verbose=False)
            for r in results:
                if r.boxes is None:
                    continue
                for box in r.boxes:
                    x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    label = names.get(cls, f"class_{cls}")
                    yolo_findings.append({
                        "label": humanize(label),
                        "description": f"Automated YOLO detection ({label}) at {conf:.0%} confidence.",
                        "severity": "critical" if conf >= 0.7 else "warning",
                        "confidence": round(conf, 3),
                        "box": {
                            "x": round(max(0.0, x1) / w, 4),
                            "y": round(max(0.0, y1) / h, 4),
                            "width": round(min(1.0, (x2 - x1) / w), 4),
                            "height": round(min(1.0, (y2 - y1) / h), 4),
                        },
                    })
        except Exception as e:
            print(f"[vision] yolo inference failed ({e})")

    # Combine both engines: YOLO is the primary evidence; the OpenCV fallback
    # only adds extra, non-overlapping candidates when it is reasonably sure
    # (or when YOLO found nothing at all).
    combined = list(yolo_findings)
    min_oc_conf = 0.55 if yolo_findings else 0.0
    for f in opencv_findings:
        if (f.get("confidence") or 0) >= min_oc_conf:
            combined.append(f)

    findings = nms_findings(_merge_close_same(combined), max_n=8)
    used = "yolo" if yolo_findings else "opencv"

    note = "AI scan review complete."
    if findings:
        note = f"{used.upper()} detected {len(findings)} potential area(s) to review."
    else:
        note = "No obvious faults detected by automated scan review. Please confirm with your doctor."

    # Free large buffers eagerly so memory stays flat across requests.
    del img_bgr, img_rgb, gray
    gc.collect()

    return {
        "engine": used,
        "image_type": image_type,
        "model_available": model is not None,
        "findings": findings,
        "note": note,
    }


def humanize(label: str) -> str:
    label = label.replace("_", " ").strip()
    if not label:
        return "Detected finding"
    if any(k in label.lower() for k in ("fracture", "positive", "break")):
        return f"Possible {label}"
    return label.title()


@app.get("/health")
async def health():
    model, names = load_model()
    return {
        "status": "ok",
        "version": "1.1.0",
        "model_loaded": model is not None,
        "max_img_dim": MAX_IMG_DIM,
        "classes": names,
    }


@app.get("/")
async def root():
    return {"service": "MediScan Vision Service", "status": "running"}