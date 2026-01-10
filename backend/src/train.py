import pandas as pd
import numpy as np
import joblib
import time
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_curve, auc, accuracy_score
)
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier
import shap

# --- Configuration ---
DATA_PATH = "../data/transaction_dataset.csv"
MODEL_DIR = "../models/"
SEED = 42

def train_models():
    start_total_time = time.time()
    
    # 1. Load & Clean
    print("🚀 Loading Data...")
    df = pd.read_csv(DATA_PATH)
    
    # Drop Identifiers
    cols_to_drop = ['Index', 'Address']
    if 'FLAG' in df.columns:
        y = df['FLAG']
        X = df.drop(columns=cols_to_drop + ['FLAG'])
    else:
        raise ValueError("Target 'FLAG' column not found.")
        
    # Select numeric features only
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    X = X[numeric_cols]
    
    # 2. Imputation (Median)
    print("⚙️ Imputing & Scaling...")
    imputer = SimpleImputer(strategy='median')
    X_imputed = imputer.fit_transform(X)
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imputed)
    
    # 3. SMOTE Balancing
    print("⚖️ Applying SMOTE...")
    smote = SMOTE(random_state=SEED)
    X_res, y_res = smote.fit_resample(X_scaled, y)
    
    # Split Data
    X_train, X_test, y_train, y_test = train_test_split(
        X_res, y_res, test_size=0.2, random_state=SEED
    )
    
    # 4. Dimensionality Reduction (PCA)
    print("📉 Applying PCA (95% Variance)...")
    pca_start = time.time()
    pca = PCA(n_components=0.95, random_state=SEED)
    X_train_pca = pca.fit_transform(X_train)
    X_test_pca = pca.transform(X_test)
    pca_time = time.time() - pca_start
    
    # 5. Ensemble Modeling (Soft Voting)
    print("🧠 Training Ensemble (RF + XGB)...")
    train_start = time.time()
    
    rf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=SEED)
    xgb = XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=SEED)
    
    ensemble = VotingClassifier(
        estimators=[('rf', rf), ('xgb', xgb)],
        voting='soft'
    )
    ensemble.fit(X_train_pca, y_train)
    train_time = time.time() - train_start
    
    # 6. Evaluation & Metrics Generation
    print("📊 Calculating Metrics...")
    preds = ensemble.predict(X_test_pca)
    probs = ensemble.predict_proba(X_test_pca)[:, 1]
    
    # Accuracy & Report
    acc = accuracy_score(y_test, preds)
    report = classification_report(y_test, preds, output_dict=True)
    
    # Confusion Matrix
    cm = confusion_matrix(y_test, preds).tolist()
    
    # ROC Curve Data
    fpr, tpr, _ = roc_curve(y_test, probs)
    roc_auc = auc(fpr, tpr)
    
    # Prepare Metrics JSON for Frontend
    metrics_data = {
        "accuracy": acc,
        "roc_auc": roc_auc,
        "training_time_sec": train_time,
        "pca_time_sec": pca_time,
        "confusion_matrix": cm,
        "classification_report": report,
        "roc_curve": {
            "fpr": fpr.tolist()[::10], # Downsample for smaller JSON
            "tpr": tpr.tolist()[::10]
        }
    }
    
    with open(f'{MODEL_DIR}metrics.json', 'w') as f:
        json.dump(metrics_data, f)
        
    # 7. Explainability (Interpreter Model)
    # We retrain a simple model on RAW features just for SHAP
    print("🔍 Training SHAP Interpreter...")
    interpreter = XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=SEED)
    interpreter.fit(X_train, y_train) 
    
    # Save Everything
    joblib.dump(scaler, f'{MODEL_DIR}scaler.joblib')
    joblib.dump(imputer, f'{MODEL_DIR}imputer.joblib')
    joblib.dump(pca, f'{MODEL_DIR}pca.joblib')
    joblib.dump(ensemble, f'{MODEL_DIR}ensemble_model.joblib')
    joblib.dump(interpreter, f'{MODEL_DIR}shap_interpreter.joblib')
    joblib.dump(numeric_cols, f'{MODEL_DIR}feature_names.joblib')
    
    print(f"✅ Complete! Accuracy: {acc:.4f}, Saved to {MODEL_DIR}")

if __name__ == "__main__":
    train_models()