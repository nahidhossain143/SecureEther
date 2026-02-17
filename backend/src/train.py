import pandas as pd
import numpy as np
import joblib
import time
import json
import os
import warnings

# Scikit-Learn & ML Libraries
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_curve, auc,
    accuracy_score, precision_score, recall_score, f1_score
)
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier
import shap

warnings.filterwarnings('ignore')

# --- CONFIG ---
DATA_PATH = "../data/transaction_dataset.csv"
MODEL_DIR = "../models/"
SEED = 42

def train_models():
    print("🚀 Starting SecureEther Training Pipeline...")
    start_total_time = time.time()

    os.makedirs(MODEL_DIR, exist_ok=True)

    # ── 1. Load & Clean ──────────────────────────────────────────────────────
    print("\n📂 [1/9] Loading Data...")
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    print(f"   Loaded {len(df)} rows, {df.shape[1]} columns.")

    cols_to_drop = ['Index', 'Address', 'FLAG']
    if 'FLAG' not in df.columns:
        raise ValueError("Target 'FLAG' column not found.")

    y = df['FLAG']
    X = df.drop(columns=[c for c in cols_to_drop if c in df.columns])

    # Select numeric features only
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    X = X[numeric_cols]
    print(f"   Numeric features retained: {len(numeric_cols)}")

    # FIX 1: Report class distribution so the imbalance is visible in logs
    fraud_pct = y.mean() * 100
    print(f"   Class Distribution → Fraud: {fraud_pct:.2f}% | Legit: {100 - fraud_pct:.2f}%")

    # ── 2. Split (BEFORE SMOTE — prevents data leakage) ──────────────────────
    print("\n✂️  [2/9] Splitting Data (80/20, stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=y
    )
    print(f"   Train: {len(X_train)} | Test: {len(X_test)}")

    # ── 3. Imputation & Scaling ───────────────────────────────────────────────
    print("\n⚙️  [3/9] Imputing (Median) & Scaling (StandardScaler)...")
    imputer = SimpleImputer(strategy='median')
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp  = imputer.transform(X_test)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_imp)
    X_test_scaled  = scaler.transform(X_test_imp)

    # ── 4. SMOTE (on training set only) ──────────────────────────────────────
    print("\n⚖️  [4/9] Applying SMOTE (Training Data Only)...")
    smote = SMOTE(random_state=SEED)
    X_train_res, y_train_res = smote.fit_resample(X_train_scaled, y_train)
    print(f"   Before SMOTE: {X_train_scaled.shape[0]} samples "
          f"({y_train.sum()} fraud)")
    print(f"   After  SMOTE: {X_train_res.shape[0]} samples "
          f"({y_train_res.sum()} fraud)")

    # ── 5. PCA (95% variance) ─────────────────────────────────────────────────
    print("\n📉 [5/9] Applying PCA (95% Variance Retained)...")
    pca_start = time.time()
    pca = PCA(n_components=0.95, random_state=SEED)
    X_train_pca = pca.fit_transform(X_train_res)
    X_test_pca  = pca.transform(X_test_scaled)
    pca_time = time.time() - pca_start

    reduction_pct = (1 - X_train_pca.shape[1] / len(numeric_cols)) * 100
    print(f"   Features: {len(numeric_cols)} → {X_train_pca.shape[1]} components "
          f"({reduction_pct:.1f}% reduction) in {pca_time:.2f}s")

    # ── 6. Ensemble Model (Soft Voting RF + XGBoost) ──────────────────────────
    print("\n🧠 [6/9] Training Soft Voting Ensemble (RF + XGBoost)...")
    train_start = time.time()

    rf = RandomForestClassifier(
        n_estimators=200,       # UPGRADE: 100→200 for better stability
        max_depth=12,           # UPGRADE: 10→12, slightly deeper trees
        min_samples_leaf=2,     # NEW: prevents overfitting on tiny leaves
        random_state=SEED,
        n_jobs=-1
    )
    xgb = XGBClassifier(
        n_estimators=200,       # UPGRADE: default→200
        max_depth=6,
        learning_rate=0.05,     # NEW: slower learning = better generalisation
        subsample=0.8,          # NEW: row subsampling (regularisation)
        colsample_bytree=0.8,   # NEW: column subsampling (regularisation)
        eval_metric='logloss',
        random_state=SEED,
        n_jobs=-1
    )

    ensemble = VotingClassifier(
        estimators=[('rf', rf), ('xgb', xgb)],
        voting='soft'
    )
    ensemble.fit(X_train_pca, y_train_res)
    train_time = time.time() - train_start
    print(f"   Training completed in {train_time:.2f}s")

    # ── 7. Evaluation ─────────────────────────────────────────────────────────
    print("\n📊 [7/9] Evaluating on Held-Out Test Set...")
    preds = ensemble.predict(X_test_pca)
    probs = ensemble.predict_proba(X_test_pca)[:, 1]

    acc       = accuracy_score(y_test, preds)
    precision = precision_score(y_test, preds)
    recall    = recall_score(y_test, preds)
    f1        = f1_score(y_test, preds)
    report    = classification_report(y_test, preds, output_dict=True)
    cm        = confusion_matrix(y_test, preds).tolist()

    fpr, tpr, thresholds = roc_curve(y_test, probs)
    roc_auc   = auc(fpr, tpr)

    # FIX 2: Add per-class precision/recall/f1 into top-level metrics
    # so the frontend Dashboard can show them directly
    metrics_data = {
        "accuracy":          round(acc, 6),
        "precision":         round(precision, 6),
        "recall":            round(recall, 6),
        "f1_score":          round(f1, 6),
        "roc_auc":           round(roc_auc, 6),
        "training_time_sec": round(train_time, 4),
        "pca_time_sec":      round(pca_time, 4),
        "n_features_original": len(numeric_cols),
        "n_components_pca":  int(X_train_pca.shape[1]),
        "confusion_matrix":  cm,
        "classification_report": report,
        "roc_curve": {
            "fpr": fpr.tolist()[::10],
            "tpr": tpr.tolist()[::10]
        },
        # NEW: optimal threshold via Youden's J statistic
        "optimal_threshold": float(
            thresholds[np.argmax(tpr - fpr)]
        )
    }

    with open(os.path.join(MODEL_DIR, 'metrics.json'), 'w') as f:
        json.dump(metrics_data, f, indent=4)

    print(f"   Accuracy : {acc:.4f}")
    print(f"   Precision: {precision:.4f}")
    print(f"   Recall   : {recall:.4f}")
    print(f"   F1-Score : {f1:.4f}")
    print(f"   ROC-AUC  : {roc_auc:.4f}")

    # ── 8. SHAP Interpreter (on RAW scaled features — as per proposal §4.4) ──
    print("\n🔍 [8/9] Training SHAP Interpreter (on raw scaled features)...")
    shap_start = time.time()

    # FIX 3: interpreter is trained on X_train_res (SMOTE-balanced, scaled)
    # NOT on PCA-transformed data, so SHAP values map back to named features
    interpreter = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='logloss',
        random_state=SEED,
        n_jobs=-1
    )
    interpreter.fit(X_train_res, y_train_res)

    # NEW: Pre-compute global SHAP summary and save it so the API can serve
    # a "global feature importance" endpoint without re-computing every call.
    print("   Computing global SHAP values (background sample of 200)...")
    background = shap.sample(X_train_res, 200, random_state=SEED)
    explainer_global = shap.TreeExplainer(interpreter, background)

    # Use a small representative test subset for the global summary
    sample_size = min(500, X_test_scaled.shape[0])
    shap_sample = X_test_scaled[:sample_size]
    global_shap = explainer_global.shap_values(shap_sample)

    # global_shap may be a list [class0, class1] for binary classifiers
    if isinstance(global_shap, list):
        global_shap = global_shap[1]

    mean_abs_shap = np.abs(global_shap).mean(axis=0)
    global_importance = [
        {"feature": str(numeric_cols[i]), "mean_abs_shap": float(mean_abs_shap[i])}
        for i in np.argsort(mean_abs_shap)[::-1][:20]   # Top 20 features
    ]

    with open(os.path.join(MODEL_DIR, 'global_shap.json'), 'w') as f:
        json.dump(global_importance, f, indent=4)

    shap_time = time.time() - shap_start
    print(f"   SHAP Interpreter ready in {shap_time:.2f}s")

    # ── 9. Save Artifacts ─────────────────────────────────────────────────────
    print("\n💾 [9/9] Saving Artifacts...")
    joblib.dump(scaler,      os.path.join(MODEL_DIR, 'scaler.joblib'))
    joblib.dump(imputer,     os.path.join(MODEL_DIR, 'imputer.joblib'))
    joblib.dump(pca,         os.path.join(MODEL_DIR, 'pca.joblib'))
    joblib.dump(ensemble,    os.path.join(MODEL_DIR, 'ensemble_model.joblib'))
    joblib.dump(interpreter, os.path.join(MODEL_DIR, 'shap_interpreter.joblib'))
    joblib.dump(numeric_cols, os.path.join(MODEL_DIR, 'feature_names.joblib'))

    total_time = time.time() - start_total_time
    print(f"\n✅ Pipeline Complete in {total_time:.2f}s")
    print(f"   Accuracy : {acc:.4f} | F1: {f1:.4f} | AUC: {roc_auc:.4f}")
    print(f"   Artifacts saved to: {os.path.abspath(MODEL_DIR)}")


if __name__ == "__main__":
    train_models()