# SecureEther: A Hybrid PCA-Ensemble Framework for Ethereum Fraud Detection

**SecureEther** is a full-stack Machine Learning application designed to detect fraudulent Ethereum transactions in real-time. It combines a **FastAPI** backend (running an XGBoost+RandomForest ensemble) with an immersive **React + Three.js** frontend.

This project was submitted as a proposal for **CSE 4114: Pattern Recognition and Machine Learning Lab**.

## 🚀 Features
* **Hybrid ML Model:** Uses **PCA** (Principal Component Analysis) to retain 95% variance and reduce dimensionality, significantly improving training speed.
* **Robust Detection:** Implements a **Soft Voting Ensemble** of **Random Forest** and **XGBoost**, achieving high accuracy (>99%) on imbalanced transaction data.
* **Explainable AI (XAI):** Integrates **SHAP** (SHapley Additive exPlanations) to provide human-readable reasons for every fraud detection (Global & Local interpretability).
* **3D Visualization:** Real-time interactive 3D globe visualization of transaction nodes using **Three.js** and **React Three Fiber**.
* **Research Dashboard:** Dedicated tab for viewing ROC-AUC curves, Confusion Matrices, and Training Runtime metrics.

## 🛠️ Tech Stack
* **Frontend:** React.js, Three.js (@react-three/fiber), Chart.js
* **Backend:** Python, FastAPI, Uvicorn
* **Machine Learning:** Scikit-Learn, XGBoost, SHAP, Imbalanced-Learn (SMOTE)
* **Deployment:** Vercel (Frontend), Render (Backend)

---

## 📦 Installation & Setup Guide

### Prerequisites
* Node.js & npm installed
* Python 3.8+ installed

### 1. Backend Setup (The Brain)
The backend handles the ML training, API, and fraud prediction logic.

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Create a virtual environment (Optional but recommended)
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# ⚠️ IMPORTANT: Train the Model First
# The trained models are excluded from GitHub due to size. You must generate them locally.
cd src
python train.py
# This script will save model artifacts (.joblib files) and metrics.json to backend/models/

# 4. Start the API Server
uvicorn api:app --reload
