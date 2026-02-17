import pandas as pd
import numpy as np
import shap
import json
import joblib
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from utils import align_features, format_shap_explanation, get_logger

app = FastAPI(
    title="SecureEther API",
    description="Ethereum Fraud Detection with Explainable AI",
    version="2.0.0"
)
logger = get_logger()

# ── CORS ──────────────────────────────────────────────────────────────────────
# FIX: In production, replace "*" with your actual frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CONFIG ────────────────────────────────────────────────────────────────────
MODEL_DIR = "../models/"
DATA_PATH = "../data/transaction_dataset.csv"

# ── GLOBAL STATE ──────────────────────────────────────────────────────────────
scaler       = None
imputer      = None
pca          = None
model        = None
interpreter  = None
feature_names = None
explainer    = None
raw_df       = None
# NEW: Pre-computed global SHAP importance (served from global_shap.json)
global_shap_data = None
# NEW: Optimal decision threshold (from Youden's J, stored in metrics.json)
optimal_threshold = 0.5


# ── INPUT SCHEMA for manual feature entry ─────────────────────────────────────
class TransactionFeatures(BaseModel):
    """Allows POST /predict with raw feature values (no CSV lookup needed)."""
    features: dict = Field(..., example={"total ether sent": 1.5, "received tnx": 3})


# ── STARTUP ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def load_models():
    global scaler, imputer, pca, model, interpreter, feature_names
    global explainer, raw_df, global_shap_data, optimal_threshold

    try:
        logger.info("⏳ Loading Models & Data...")

        scaler       = joblib.load(os.path.join(MODEL_DIR, 'scaler.joblib'))
        imputer      = joblib.load(os.path.join(MODEL_DIR, 'imputer.joblib'))
        pca          = joblib.load(os.path.join(MODEL_DIR, 'pca.joblib'))
        model        = joblib.load(os.path.join(MODEL_DIR, 'ensemble_model.joblib'))
        interpreter  = joblib.load(os.path.join(MODEL_DIR, 'shap_interpreter.joblib'))
        feature_names = joblib.load(os.path.join(MODEL_DIR, 'feature_names.joblib'))

        # SHAP explainer on the interpreter (raw-feature model)
        explainer = shap.TreeExplainer(interpreter)

        # Load dataset for ID-based lookup
        if os.path.exists(DATA_PATH):
            raw_df = pd.read_csv(DATA_PATH)
            logger.info(f"✅ Dataset loaded: {len(raw_df)} transactions.")
        else:
            logger.warning(f"⚠️ Dataset not found at {DATA_PATH}.")
            raw_df = pd.DataFrame()

        # NEW: Load pre-computed global SHAP summary
        global_shap_path = os.path.join(MODEL_DIR, 'global_shap.json')
        if os.path.exists(global_shap_path):
            with open(global_shap_path, 'r') as f:
                global_shap_data = json.load(f)
            logger.info("✅ Global SHAP summary loaded.")

        # NEW: Load optimal threshold from metrics
        metrics_path = os.path.join(MODEL_DIR, 'metrics.json')
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                m = json.load(f)
                optimal_threshold = m.get("optimal_threshold", 0.5)
            logger.info(f"✅ Optimal threshold: {optimal_threshold:.4f}")

        logger.info("✅ System Ready.")

    except Exception as e:
        logger.error(f"❌ Error loading resources: {e}")
        raise RuntimeError(f"Startup failed: {e}")


# ── HELPERS ───────────────────────────────────────────────────────────────────
def _run_prediction(input_data: pd.DataFrame):
    """
    Shared prediction logic used by both GET /predict/{id} and POST /predict.
    Returns fraud probability, label, and SHAP explanation.
    """
    # 1. Preprocess
    data_imputed = imputer.transform(input_data)
    data_scaled  = scaler.transform(data_imputed)

    # 2. PCA + Ensemble prediction
    data_pca = pca.transform(data_scaled)
    prob = float(model.predict_proba(data_pca)[0][1])

    # 3. SHAP on raw scaled features (no PCA)
    shap_values = explainer.shap_values(data_scaled)
    top_features = format_shap_explanation(feature_names, shap_values, input_data)

    return prob, top_features, data_scaled


# ── ROUTES ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Quick liveness probe — useful for deployment monitoring."""
    return {
        "status": "ok",
        "models_loaded": model is not None,
        "dataset_loaded": raw_df is not None and not raw_df.empty
    }


@app.get("/stats")
async def get_model_stats():
    """Returns training metrics (accuracy, AUC, confusion matrix, ROC curve)."""
    try:
        with open(os.path.join(MODEL_DIR, 'metrics.json'), 'r') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NEW ENDPOINT: Global feature importance via pre-computed SHAP
@app.get("/global-importance")
async def get_global_importance():
    """
    Returns top-20 global feature importances (mean |SHAP|).
    Computed at training time so this is instant — no re-computation.
    """
    if global_shap_data is None:
        raise HTTPException(
            status_code=503,
            detail="Global SHAP data not available. Re-run train.py."
        )
    return {"global_importance": global_shap_data}


@app.get("/predict/{txn_id}")
async def predict_by_id(txn_id: int):
    """
    Predict fraud probability for a transaction by its CSV row index.
    Returns probability, label, SHAP explanation, and original feature values.
    """
    if raw_df is None or raw_df.empty:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")

    if txn_id < 0 or txn_id >= len(raw_df):
        raise HTTPException(
            status_code=404,
            detail=f"Transaction ID {txn_id} out of range (0–{len(raw_df)-1})."
        )

    try:
        row        = raw_df.iloc[[txn_id]]
        input_data = align_features(row, feature_names)

        prob, top_features, _ = _run_prediction(input_data)

        # FIX: Use optimal_threshold instead of hardcoded 0.5
        is_fraud = bool(prob > optimal_threshold)

        logger.info(
            f"ID: {txn_id} | Prob: {prob:.4f} | "
            f"Fraud: {is_fraud} | Threshold: {optimal_threshold:.4f}"
        )

        # Include actual label if available (useful for UI to show ground truth)
        actual_label = None
        if 'FLAG' in raw_df.columns:
            actual_label = int(raw_df.iloc[txn_id]['FLAG'])

        # FIX: Replace NaN/Inf with None before JSON serialization.
        # Columns like 'ERC20 most sent token type' are empty for many rows —
        # pandas reads them as float NaN which Python's json module rejects
        # with "Out of range float values are not JSON compliant".
        def sanitize(v):
            if isinstance(v, float) and (v != v or v == float('inf') or v == float('-inf')):
                return None
            return v

        raw_record  = row.to_dict(orient='records')[0]
        safe_record = {k: sanitize(v) for k, v in raw_record.items()}

        return {
            "transaction_id":    txn_id,
            "fraud_probability": prob,
            "is_fraud":          is_fraud,
            "threshold_used":    optimal_threshold,
            "actual_label":      actual_label,
            "explanation":       top_features,
            "original_data":     safe_record
        }

    except Exception as e:
        logger.error(f"Prediction Error for ID {txn_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# NEW ENDPOINT: Predict from raw feature values (no CSV needed)
@app.post("/predict")
async def predict_from_features(payload: TransactionFeatures):
    """
    Predict fraud from a dictionary of feature values.
    Useful for the Transaction Checker UI when a user enters values manually
    rather than looking up an existing row by ID.
    """
    try:
        row = pd.DataFrame([payload.features])
        input_data = align_features(row, feature_names)

        prob, top_features, _ = _run_prediction(input_data)
        is_fraud = bool(prob > optimal_threshold)

        return {
            "fraud_probability": prob,
            "is_fraud":         is_fraud,
            "threshold_used":   optimal_threshold,
            "explanation":      top_features,
        }

    except Exception as e:
        logger.error(f"POST /predict Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))