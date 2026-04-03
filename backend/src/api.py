import pandas as pd
import numpy as np
import shap
import json
import joblib
import os
import httpx  # Required for making async API calls to Etherscan
from dotenv import load_dotenv # <-- NEW: Load environment variables
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from utils import align_features, format_shap_explanation, get_logger

# Load variables from the .env file
load_dotenv()

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

# NEW: Etherscan API Key (Set this as an environment variable in production)
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "YOUR_FREE_ETHERSCAN_API_KEY")


# ── GLOBAL STATE ──────────────────────────────────────────────────────────────
scaler       = None
imputer      = None
pca          = None
model        = None
interpreter  = None
feature_names = None
explainer    = None
raw_df       = None
global_shap_data = None
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

        # Load pre-computed global SHAP summary
        global_shap_path = os.path.join(MODEL_DIR, 'global_shap.json')
        if os.path.exists(global_shap_path):
            with open(global_shap_path, 'r') as f:
                global_shap_data = json.load(f)
            logger.info("✅ Global SHAP summary loaded.")

        # Load optimal threshold from metrics
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
    """Quick liveness probe."""
    return {
        "status": "ok",
        "models_loaded": model is not None,
        "dataset_loaded": raw_df is not None and not raw_df.empty
    }

@app.get("/stats")
async def get_model_stats():
    """Returns training metrics."""
    try:
        with open(os.path.join(MODEL_DIR, 'metrics.json'), 'r') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/global-importance")
async def get_global_importance():
    """Returns top-20 global feature importances."""
    if global_shap_data is None:
        raise HTTPException(
            status_code=503,
            detail="Global SHAP data not available. Re-run train.py."
        )
    return {"global_importance": global_shap_data}

@app.get("/predict/{txn_id}")
async def predict_by_id(txn_id: int):
    """Predict fraud probability for a transaction by its CSV row index."""
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
        is_fraud = bool(prob > optimal_threshold)

        actual_label = None
        if 'FLAG' in raw_df.columns:
            actual_label = int(raw_df.iloc[txn_id]['FLAG'])

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

@app.post("/predict")
async def predict_from_features(payload: TransactionFeatures):
    """Predict fraud from a dictionary of feature values."""
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


# ── NEW: LIVE ETHEREUM FETCHING ───────────────────────────────────────────────
@app.get("/predict-live/{address}")
async def predict_live_address(address: str):
    """
    Fetches live transaction history for an address from Etherscan,
    extracts features, and runs the fraud detection model.
    """
    if ETHERSCAN_API_KEY == "YOUR_FREE_ETHERSCAN_API_KEY":
        raise HTTPException(
            status_code=500, 
            detail="Etherscan API key not configured. Please set ETHERSCAN_API_KEY."
        )

# Fetch max 1000 recent transactions to build a profile using Etherscan API V2
    url = f"https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address={address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey={ETHERSCAN_API_KEY}"

    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()

    if data.get("status") != "1" and data.get("message") != "No transactions found":
        raise HTTPException(status_code=400, detail=f"Etherscan Error: {data.get('result')}")

    txns = data.get("result", [])
    if not txns or not isinstance(txns, list):
        raise HTTPException(status_code=404, detail="No transactions found for this address.")

    # 1. Feature Engineering: Map raw blockchain data to our model's expected features
    received_tx = 0
    sent_tx = 0
    total_ether_received = 0.0
    total_ether_sent = 0.0

    for tx in txns:
        val_eth = float(tx.get("value", 0)) / 1e18  # Convert Wei to Ether
        
        # Check if address is receiver or sender
        if str(tx.get("to")).lower() == address.lower():
            received_tx += 1
            total_ether_received += val_eth
        elif str(tx.get("from")).lower() == address.lower():
            sent_tx += 1
            total_ether_sent += val_eth

    # Build the dictionary mapping to the dataset columns. 
    # The 'align_features' utility will handle missing columns by filling them with 0 or medians.
    live_features = {
        "Received Tnx": received_tx,
        "Sent tnx": sent_tx,
        "Total Ether received": total_ether_received,
        "Total Ether sent": total_ether_sent,
        "Total transactions (including tnx to create contract": received_tx + sent_tx
    }

    try:
        # 2. Run Prediction
        row = pd.DataFrame([live_features])
        input_data = align_features(row, feature_names)

        prob, top_features, _ = _run_prediction(input_data)
        is_fraud = bool(prob > optimal_threshold)

        return {
            "address": address,
            "transactions_analyzed": len(txns),
            "fraud_probability": prob,
            "is_fraud": is_fraud,
            "threshold_used": optimal_threshold,
            "extracted_features": live_features,
            "explanation": top_features,
        }

    except Exception as e:
        logger.error(f"Live Prediction Error for address {address}: {e}")
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")