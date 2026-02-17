import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import BlockchainGraph3D from "./BlockchainGraph3D";
import ShapChart from "./ShapChart";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ── FEATURE DICTIONARY ────────────────────────────────────────────────────────
const FEATURE_DICTIONARY = {
  "time diff between first and last (mins)": "the account's active lifespan",
  "avg min between sent tnx":               "the speed of outgoing transactions",
  "avg min between received tnx":           "the speed of incoming transactions",
  "total ether sent":                       "the total amount of Ether sent",
  "total ether received":                   "the total amount of Ether received",
  "avg val received":                       "the average size of received funds",
  "avg val sent":                           "the average size of sent funds",
  "sent tnx":                               "the number of sent transactions",
  "received tnx":                           "the number of received transactions",
  "unique received from addresses":         "the diversity of funding sources",
  "unique sent to addresses":               "the diversity of recipients",
  "total transactions (including tnx to create contract": "the total transaction count",
  "erc20 total ether received":             "ERC-20 token inflow volume",
  "erc20 total ether sent":                 "ERC-20 token outflow volume",
  "erc20 uniq rec addr":                    "the number of unique ERC-20 recipients",
};

const getHumanFeature = (feat) => {
  const lower = feat.trim().toLowerCase();
  if (FEATURE_DICTIONARY[lower]) return FEATURE_DICTIONARY[lower];
  const key = Object.keys(FEATURE_DICTIONARY).find(k => lower.includes(k) || k.includes(lower));
  return key ? FEATURE_DICTIONARY[key] : `"${feat}"`;
};

const getAIReasoning = (res) => {
  if (!res?.explanation?.length) return "No explanation available.";
  const top  = res.explanation[0];
  const feat = getHumanFeature(top.feature);
  const val  = top.value != null ? top.value.toFixed(4) : "N/A";
  const dir  = top.direction || (top.impact > 0 ? "increases fraud risk" : "decreases fraud risk");
  return res.is_fraud
    ? `Flagged because ${feat} is anomalous (value: ${val}). This feature ${dir} and is a strong indicator in fraudulent accounts.`
    : `Primary factor was ${feat} (value: ${val}), which ${dir} and falls within normal ranges for legitimate users.`;
};

// ── REUSABLE COMPONENTS ───────────────────────────────────────────────────────

const KpiCard = ({ label, value, sub, accent = "green" }) => {
  const accentClasses = {
    green: "text-green glow-green",
    red:   "text-red glow-red",
    blue:  "text-blue glow-blue",
  };
  return (
    <div className="bg-panel border border-border rounded p-4 flex flex-col gap-1">
      <span className="font-orbitron text-muted text-xs tracking-widest uppercase">{label}</span>
      <span className={`font-orbitron font-bold text-2xl leading-none ${accentClasses[accent]}`}>{value}</span>
      {sub && <span className="text-muted text-xs mt-1">{sub}</span>}
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <div className="font-orbitron text-xs tracking-widest text-muted uppercase mb-1">{children}</div>
);

// ── SCANNER TAB ───────────────────────────────────────────────────────────────

const ScannerTab = () => {
  const [loading,  setLoading]  = useState(false);
  const [txnId,    setTxnId]    = useState("");
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  const handlePredict = useCallback(async () => {
    if (!txnId) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await axios.get(`${API_URL}/predict/${txnId}`);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Backend offline or transaction not found.");
    } finally {
      setLoading(false);
    }
  }, [txnId]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') handlePredict(); };

  const isFraud  = result?.is_fraud;
  const prob     = result?.fraud_probability ?? 0;
  const probPct  = (prob * 100).toFixed(2);
  const threshold = result?.threshold_used;

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── SIDEBAR ── */}
      <div className="w-80 min-w-[320px] flex flex-col bg-panel border-r border-border overflow-y-auto flex-shrink-0">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="font-orbitron text-green text-xs tracking-widest uppercase glow-green mb-1">
            Transaction Checker
          </div>
          <p className="text-muted text-xs leading-relaxed">
            Enter a transaction ID (0 – 9840) to scan the Ethereum dataset for fraud signals.
          </p>
        </div>

        {/* Input */}
        <div className="px-6 py-5 flex flex-col gap-3 border-b border-border">
          <input
            type="number"
            min="0"
            placeholder="Transaction ID  e.g. 500"
            value={txnId}
            onChange={(e) => setTxnId(e.target.value)}
            onKeyDown={handleKeyDown}
            className="
              w-full bg-bg border border-border rounded px-4 py-3
              text-white font-orbitron text-sm text-center tracking-widest
              placeholder-muted outline-none
              focus:border-green focus:shadow-glow-green
              transition-all duration-200
            "
          />
          <button
            onClick={handlePredict}
            disabled={loading || !txnId}
            className="
              w-full py-3 rounded font-orbitron font-bold text-xs tracking-widest uppercase
              bg-gradient-to-r from-green to-emerald-500 text-black
              hover:shadow-glow-green hover:-translate-y-px
              disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none
              transition-all duration-200
            "
          >
            {loading ? "PROCESSING…" : "SCAN CHAIN"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red/5 border border-red/30 rounded text-red text-xs leading-relaxed animate-fade-up">
            ⚠ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="px-6 py-5 flex flex-col gap-5 animate-fade-up">

            {/* Verdict */}
            <div className="pb-4 border-b border-border">
              <SectionLabel>Detection Result</SectionLabel>
              <div className={`font-orbitron font-black text-2xl mt-1 ${isFraud ? "text-red glow-red animate-pulse" : "text-green glow-green"}`}>
                {isFraud ? "FRAUD DETECTED" : "LEGITIMATE"}
              </div>
              {result.actual_label != null && (() => {
                const correct = (result.actual_label === 1) === isFraud;
                return (
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-orbitron border ${
                    correct
                      ? "text-green border-green/30 bg-green/5"
                      : "text-red border-red/30 bg-red/5"
                  }`}>
                    {correct ? "✓ CORRECT" : "✗ MISMATCH"} · Actual: {result.actual_label === 1 ? "FRAUD" : "LEGIT"}
                  </span>
                );
              })()}
            </div>

            {/* Risk score */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <SectionLabel>Risk Score</SectionLabel>
                <span className={`font-orbitron font-bold text-xl ${prob > (threshold ?? 0.5) ? "text-red" : "text-green"}`}>
                  {probPct}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-border rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-700 ${isFraud ? "bg-red" : "bg-green"}`}
                  style={{ width: `${probPct}%` }}
                />
              </div>
              {threshold != null && (
                <div className="text-right text-muted text-xs mt-1 font-mono-sec">
                  threshold: {(threshold * 100).toFixed(1)}% (Youden's J)
                </div>
              )}
            </div>

            {/* AI Reasoning */}
            <div>
              <SectionLabel>AI Reasoning (XAI)</SectionLabel>
              <div className={`mt-1 p-3 rounded text-xs leading-relaxed border-l-2 bg-white/[0.02] ${
                isFraud ? "border-red text-red/90" : "border-green text-green/90"
              }`}>
                {isFraud ? "⚠ " : "✓ "}{getAIReasoning(result)}
              </div>
            </div>

            {/* SHAP chart */}
            <div>
              <SectionLabel>Visual Explanation (SHAP)</SectionLabel>
              <div className="mt-2">
                <ShapChart explanation={result.explanation} />
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── 3D VISUALIZER ── */}
      <div className="flex-1 min-w-0 relative bg-gradient-to-br from-[#050f05] to-black scanlines overflow-hidden">

        {/* Fraud border pulse */}
        {isFraud && (
          <div className="absolute inset-0 border-2 border-red/30 pointer-events-none z-20 animate-pulse" />
        )}

        {/* TOP-LEFT: System title + live status */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1">
          <div className="font-orbitron text-xs tracking-[0.2em] text-green/70">
            SECUREETHER · NETWORK VIEW
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${
              prob === 0 ? "bg-blue/60" : isFraud ? "bg-red animate-pulse" : "bg-green animate-pulse"
            }`} />
            <span className={`font-orbitron text-xs tracking-widest ${
              prob === 0 ? "text-blue/60" : isFraud ? "text-red" : "text-green"
            }`}>
              {prob === 0 ? "AWAITING SCAN" : isFraud ? "THREAT DETECTED" : "NETWORK CLEAR"}
            </span>
          </div>
        </div>

        {/* TOP-RIGHT: Corner label */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none text-right">
          <div className="font-orbitron text-dim text-xs tracking-widest">BLOCKCHAIN NETWORK</div>
          <div className="font-mono-sec text-muted text-xs mt-0.5">ETH MAINNET · LIVE</div>
        </div>

        {/* BOTTOM-LEFT: Network stats */}
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none flex flex-col gap-1">
          <div className="flex items-center gap-3">
            {[["NODES","22"],["EDGES","32"],["PACKETS","32"]].map(([label, val], i) => (
              <React.Fragment key={label}>
                {i > 0 && <div className="w-px h-6 bg-border" />}
                <div className="flex flex-col">
                  <span className="font-orbitron text-muted text-xs tracking-widest">{label}</span>
                  <span className="font-orbitron text-white text-sm">{val}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="font-mono-sec text-muted text-xs opacity-40 mt-0.5">
            move mouse to orbit
          </div>
        </div>

        {/* BOTTOM-RIGHT: Threat level meter */}
        <div className="absolute bottom-4 right-4 z-10 pointer-events-none flex flex-col items-end gap-1.5">
          <div className="font-orbitron text-muted text-xs tracking-widest">THREAT LEVEL</div>
          <div className="flex items-end gap-0.5 h-7">
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((thresh, i) => (
              <div
                key={i}
                className={`w-2 rounded-sm transition-all duration-500 ${
                  prob >= thresh
                    ? i < 2 ? "bg-green" : i < 4 ? "bg-yellow-400" : "bg-red"
                    : "bg-border"
                }`}
                style={{ height: `${40 + i * 15}%` }}
              />
            ))}
          </div>
          <div className={`font-orbitron font-bold text-xl leading-none ${
            prob === 0 ? "text-muted" : isFraud ? "text-red glow-red" : "text-green glow-green"
          }`}>
            {prob === 0 ? "—" : `${(prob * 100).toFixed(1)}%`}
          </div>
        </div>

        {/* CENTER: idle prompt */}
        {prob === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2 opacity-20">
              <div className="font-orbitron text-xs tracking-[0.3em] text-white">ENTER A TRANSACTION ID</div>
              <div className="font-orbitron text-xs tracking-[0.3em] text-white">TO SCAN THE NETWORK</div>
              <div className="flex flex-col items-center gap-0.5 mt-2 animate-bounce">
                <div className="w-4 h-px bg-white/60" />
                <div className="w-2.5 h-px bg-white/40" />
                <div className="w-1 h-px bg-white/20" />
              </div>
            </div>
          </div>
        )}

        {/* The actual 3D canvas */}
        <BlockchainGraph3D isFraud={result?.is_fraud} probability={prob} />
      </div>

    </div>
  );
};

// ── RESEARCH TAB ──────────────────────────────────────────────────────────────

const ResearchTab = ({ stats, globalShap }) => {
  if (!stats) return (
    <div className="flex-1 flex items-center justify-center text-muted font-orbitron text-sm tracking-widest">
      LOADING METRICS… <span className="text-dim ml-2 text-xs">(is the backend running?)</span>
    </div>
  );

  const cm        = stats.confusion_matrix;
  const accuracy  = (stats.accuracy  * 100).toFixed(2);
  const precision = stats.precision  ? (stats.precision * 100).toFixed(2) : null;
  const recall    = stats.recall     ? (stats.recall    * 100).toFixed(2) : null;
  const f1        = stats.f1_score   ? (stats.f1_score  * 100).toFixed(2) : null;
  const rocVal    = stats.roc_auc    ? stats.roc_auc.toFixed(4)    : "N/A";
  const trainTime = stats.training_time_sec ? stats.training_time_sec.toFixed(2) : "N/A";
  const nOrig     = stats.n_features_original;
  const nPca      = stats.n_components_pca;

  const rocData = {
    labels: stats.roc_curve?.fpr.map(v => v.toFixed(2)) || [],
    datasets: [{
      label: `AUC = ${rocVal}`,
      data:  stats.roc_curve?.tpr || [],
      borderColor: '#00ff88',
      backgroundColor: 'rgba(0,255,136,0.06)',
      fill: true, tension: 0.4, pointRadius: 0,
    }]
  };
  const rocOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#555', font: { size: 10 } } },
    },
    scales: {
      x: { ticks: { color: '#444', font: { size: 9 } }, grid: { color: '#111' }, title: { display: true, text: 'FPR', color: '#444' } },
      y: { ticks: { color: '#444', font: { size: 9 } }, grid: { color: '#111' }, title: { display: true, text: 'TPR', color: '#444' } },
    }
  };

  const globalShapData = globalShap ? {
    labels: globalShap.slice(0, 10).map(d => d.feature.length > 28 ? d.feature.slice(0, 28) + '…' : d.feature),
    datasets: [{
      label: 'Mean |SHAP|',
      data:  globalShap.slice(0, 10).map(d => d.mean_abs_shap),
      backgroundColor: 'rgba(0,200,255,0.65)',
      borderColor: '#00c8ff', borderWidth: 1, borderRadius: 2,
    }]
  } : null;

  const globalShapOptions = {
    indexAxis: 'y', maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'TOP 10 GLOBAL FRAUD INDICATORS (Mean |SHAP|)', color: '#444', font: { family: 'Orbitron', size: 9 } }
    },
    scales: {
      x: { ticks: { color: '#444', font: { size: 9 } }, grid: { color: '#111' } },
      y: { ticks: { color: '#aaa', font: { size: 9 } }, grid: { display: false } }
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-grid">
      <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">

        {/* Title */}
        <div className="border-b border-border pb-3">
          <h2 className="font-orbitron text-white text-sm tracking-widest uppercase">
            Model Performance Metrics
          </h2>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard label="Accuracy"       value={`${accuracy}%`}           accent="green" />
          <KpiCard label="ROC-AUC"        value={rocVal}                    accent="green" />
          {precision && <KpiCard label="Precision"    value={`${precision}%`}  accent="green" />}
          {recall    && <KpiCard label="Recall"       value={`${recall}%`}     accent="green" />}
          {f1        && <KpiCard label="F1-Score"     value={`${f1}%`}         accent="green" />}
          <KpiCard label="Train Time"     value={`${trainTime}s`}           accent="red"   />
          {nOrig && nPca && (
            <KpiCard label="PCA Features" value={`${nOrig}→${nPca}`} sub="features → components" accent="blue" />
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Confusion Matrix */}
          <div className="bg-panel border border-border rounded p-5">
            <h3 className="font-orbitron text-muted text-xs tracking-widest uppercase mb-4">
              Confusion Matrix
            </h3>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'auto 1fr 1fr' }}>
              {/* Headers */}
              <div />
              <div className="text-center text-xs text-muted font-mono-sec py-1.5 bg-white/[0.03] rounded">Pred: LEGIT</div>
              <div className="text-center text-xs text-muted font-mono-sec py-1.5 bg-white/[0.03] rounded">Pred: FRAUD</div>
              {/* Row 1 */}
              <div className="flex items-center justify-end pr-2 text-xs text-muted font-mono-sec whitespace-nowrap">Actual: LEGIT</div>
              <div className="flex flex-col items-center justify-center py-3 rounded bg-green/5 border border-green/20">
                <span className="font-orbitron font-bold text-lg text-green">{cm[0][0]}</span>
                <span className="text-xs text-muted mt-0.5">TRUE NEG</span>
              </div>
              <div className="flex flex-col items-center justify-center py-3 rounded bg-red/5 border border-red/20">
                <span className="font-orbitron font-bold text-lg text-red">{cm[0][1]}</span>
                <span className="text-xs text-muted mt-0.5">FALSE POS</span>
              </div>
              {/* Row 2 */}
              <div className="flex items-center justify-end pr-2 text-xs text-muted font-mono-sec whitespace-nowrap">Actual: FRAUD</div>
              <div className="flex flex-col items-center justify-center py-3 rounded bg-red/5 border border-red/20">
                <span className="font-orbitron font-bold text-lg text-red">{cm[1][0]}</span>
                <span className="text-xs text-muted mt-0.5">FALSE NEG</span>
              </div>
              <div className="flex flex-col items-center justify-center py-3 rounded bg-green/5 border border-green/20">
                <span className="font-orbitron font-bold text-lg text-green">{cm[1][1]}</span>
                <span className="text-xs text-muted mt-0.5">TRUE POS</span>
              </div>
            </div>
          </div>

          {/* ROC Curve */}
          <div className="bg-panel border border-border rounded p-5">
            <h3 className="font-orbitron text-muted text-xs tracking-widest uppercase mb-4">ROC Curve</h3>
            <div className="relative h-52 w-full">
              <Line data={rocData} options={rocOptions} />
            </div>
          </div>

        </div>

        {/* Global SHAP */}
        {globalShapData && (
          <div className="bg-panel border border-border rounded p-5">
            <h3 className="font-orbitron text-muted text-xs tracking-widest uppercase mb-4">
              Global Feature Importance (SHAP)
            </h3>
            <div className="relative h-72 w-full">
              <Bar data={globalShapData} options={globalShapOptions} />
            </div>
          </div>
        )}

        {/* Project Details */}
        <div className="bg-panel border border-border rounded p-5">
          <h3 className="font-orbitron text-muted text-xs tracking-widest uppercase mb-5">Project Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="font-orbitron text-green text-xs mb-3 tracking-wide">Submitted By</div>
              <ul className="text-sm text-gray-300 space-y-2 font-mono-sec">
                <li><span className="text-white font-bold">Nafiz Tonmoy</span> <span className="text-muted text-xs">20220104136</span></li>
                <li><span className="text-white font-bold">Jamil Jim</span> <span className="text-muted text-xs">20220104139</span></li>
                <li><span className="text-white font-bold">Md Nahid Hossain</span> <span className="text-muted text-xs">20220104146</span></li>
              </ul>
              <div className="text-muted text-xs mt-3 font-mono-sec">Lab Group: C2</div>
            </div>
            <div>
              <div className="font-orbitron text-green text-xs mb-3 tracking-wide">Submitted To</div>
              <ul className="text-sm space-y-3 font-mono-sec">
                <li>
                  <div className="text-white font-bold">Mr. Mustofa Ahmed</div>
                  <div className="text-muted text-xs">Lecturer, Dept of CSE</div>
                </li>
                <li>
                  <div className="text-white font-bold">Mr. Al Hasib Mahamud</div>
                  <div className="text-muted text-xs">Lecturer, Dept of CSE</div>
                </li>
              </ul>
            </div>
            <div className="sm:text-right">
              <div className="font-orbitron text-green text-xs mb-3 tracking-wide">Institution</div>
              <div className="text-muted text-xs leading-relaxed font-mono-sec">
                Department of Computer Science<br />and Engineering<br />
                <span className="text-gray-400">Ahsanullah University of<br />Science and Technology</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────

const Dashboard = () => {
  const [activeTab,  setActiveTab]  = useState("scanner");
  const [stats,      setStats]      = useState(null);
  const [globalShap, setGlobalShap] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/stats`)
      .then(r => setStats(r.data))
      .catch(() => {});
    axios.get(`${API_URL}/global-importance`)
      .then(r => setGlobalShap(r.data.global_importance))
      .catch(() => {});
  }, []);

  const tabs = [
    { id: "scanner",  label: "SCANNER"  },
    { id: "research", label: "RESEARCH" },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-white font-mono-sec">

      {/* ── NAVBAR ── */}
      <nav className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-panel border-b border-border z-20">
        <div className="font-orbitron font-black text-lg tracking-widest">
          SECURE<span className="text-green glow-green">ETHER</span>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                font-orbitron text-xs tracking-widest px-5 py-2 rounded transition-all duration-200
                ${activeTab === tab.id
                  ? "bg-green text-black font-bold shadow-glow-green"
                  : "text-muted border border-border hover:text-green hover:border-green/50"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live status dot */}
        <div className="flex items-center gap-2 text-xs text-muted font-mono-sec">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse inline-block" />
          LIVE
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {activeTab === "scanner"
          ? <ScannerTab />
          : <ResearchTab stats={stats} globalShap={globalShap} />
        }
      </div>

    </div>
  );
};

export default Dashboard;