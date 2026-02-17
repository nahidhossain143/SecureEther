import pandas as pd
import numpy as np
import logging

# ── LOGGING SETUP ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("SecureEther")


def get_logger():
    """Returns the configured SecureEther logger."""
    return logger


def align_features(raw_row_df: pd.DataFrame, feature_names: list) -> pd.DataFrame:
    """
    Safely aligns a raw input row with the model's expected feature set.

    - Strips whitespace from column names (handles messy CSVs).
    - Fills missing features with 0.0 (neutral imputation before the median
      imputer runs — avoids NaN-propagation bugs).
    - Forces all values to float to prevent integer-dtype issues downstream.

    Parameters
    ----------
    raw_row_df   : Single-row DataFrame from CSV or user input.
    feature_names: List of feature names the model was trained on.

    Returns
    -------
    pd.DataFrame with exactly the columns in feature_names, in order.
    """
    # Start with all zeros (float) — safe neutral baseline
    input_data = pd.DataFrame(0.0, index=[0], columns=feature_names)

    # Normalise column names: strip whitespace & lowercase for fuzzy matching
    raw_cols_stripped    = {c.strip().lower(): c for c in raw_row_df.columns}
    target_cols_stripped = {c.strip().lower(): c for c in feature_names}

    matched   = 0
    unmatched = []

    for norm_target, original_target in target_cols_stripped.items():
        if norm_target in raw_cols_stripped:
            original_raw = raw_cols_stripped[norm_target]
            val = raw_row_df[original_raw].values[0]
            # FIX: Handle NaN inputs gracefully — leave as 0.0 (imputer will fix)
            if pd.isna(val):
                input_data[original_target] = 0.0
            else:
                input_data[original_target] = float(val)
            matched += 1
        else:
            unmatched.append(original_target)

    logger.info(
        f"Feature Alignment: {matched}/{len(feature_names)} matched. "
        f"Missing: {len(unmatched)}"
    )

    if unmatched:
        # Only log the first 5 unmatched to avoid log spam
        logger.debug(f"  Unmatched features (first 5): {unmatched[:5]}")

    if matched < len(feature_names) * 0.5:
        logger.warning(
            "⚠️  Less than 50% of features matched! "
            "Check that the CSV headers match the training data."
        )

    return input_data


def format_shap_explanation(
    feature_names: list,
    shap_values,
    input_data: pd.DataFrame,
    top_n: int = 5
) -> list:
    """
    Robustly formats SHAP values into a ranked list of feature contributions.

    Handles both output formats from TreeExplainer:
      - List  [class0_array, class1_array]  (common in RandomForest)
      - ndarray of shape (1, n_features)    (common in XGBoost binary)

    Parameters
    ----------
    feature_names : List of feature name strings.
    shap_values   : Raw output from explainer.shap_values(X).
    input_data    : The aligned input DataFrame (used to include feature values).
    top_n         : Number of top features to return (default 5).

    Returns
    -------
    List of dicts: [{feature, impact, value, direction}, ...]
    """
    # ── Resolve SHAP array format ─────────────────────────────────────────────
    if isinstance(shap_values, list):
        # Binary classifier returns [class0, class1] — we want fraud (class 1)
        vals = shap_values[1]
    else:
        vals = shap_values

    # Flatten from (1, N) → (N,) if needed
    if isinstance(vals, np.ndarray) and vals.ndim > 1:
        vals = vals[0]

    # Guard: length mismatch
    if len(vals) != len(feature_names):
        logger.error(
            f"SHAP length mismatch — values: {len(vals)}, "
            f"feature_names: {len(feature_names)}"
        )
        return []

    # ── Sort by absolute impact ───────────────────────────────────────────────
    ranked = sorted(
        zip(feature_names, vals),
        key=lambda x: abs(x[1]),
        reverse=True
    )

    # ── Build output ─────────────────────────────────────────────────────────
    result = []
    for feature, impact in ranked[:top_n]:
        raw_val = input_data.iloc[0].get(feature, 0.0)
        result.append({
            "feature":   str(feature),
            "impact":    float(impact),
            "value":     float(raw_val),
            # NEW: human-readable direction label for the UI
            "direction": "increases fraud risk" if impact > 0 else "decreases fraud risk"
        })

    return result