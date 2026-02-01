import React, { useState, useEffect } from "react";
import axios from "axios";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import EthGlobe from "./EthGlobe";
import ShapChart from "./ShapChart";

// Register ChartJS
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, Filler
);

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("scanner");
  const [stats, setStats] = useState(null);
  
  // Scanner State
  const [loading, setLoading] = useState(false);
  const [txnId, setTxnId] = useState("");
  const [result, setResult] = useState(null);

  // Load Research Stats
  useEffect(() => {
    // Check if we are in production (Render) or local
    const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
    axios.get(`${API_URL}/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error("Stats API Error:", err));
  }, []);

  const handlePredict = async () => {
    if (!txnId) return;
    setLoading(true);
    setResult(null); 
    const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
    
    try {
      const res = await axios.get(`${API_URL}/predict/${txnId}`);
      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert("Error: ID not found or backend offline.");
    }
    setLoading(false);
  };

  const getAIReasoning = (res) => {
    if (!res || !res.explanation) return "";
    const topFeature = res.explanation[0]; 
    const featureName = topFeature.feature;
    const isRiskFactor = topFeature.impact > 0;

    if (res.is_fraud) {
        return `⚠️ Suspicious Activity: The AI flagged this because '${featureName}' is unusually high/abnormal, which strongly indicates fraudulent behavior.`;
    } else {
        if (isRiskFactor) {
            return `✅ Safe Transaction: While '${featureName}' showed slight anomalies, overall patterns match legitimate user behavior.`;
        } else {
            return `✅ Verified Safe: The value of '${featureName}' is within normal ranges, confirming this is a standard transaction.`;
        }
    }
  };

  const renderMetrics = () => {
    if (!stats) return <div className="loading-text">Loading Training Data... (Is backend running?)</div>;

    const cm = stats.confusion_matrix;
    const accuracy = (stats.accuracy * 100).toFixed(2);
    const trainTime = stats.training_time_sec ? stats.training_time_sec.toFixed(2) : "0.00";
    
    const rocData = {
        labels: stats.roc_curve.fpr.map(v => v.toFixed(2)),
        datasets: [{
            label: 'ROC Curve (AUC)',
            data: stats.roc_curve.tpr,
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0, 255, 136, 0.2)',
            fill: true,
            tension: 0.4
        }]
    };

    return (
        <div className="research-container">
            <h2 className="section-title">MODEL PERFORMANCE METRICS</h2>
            
            {/* KPI GRID */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-label">MODEL ACCURACY</div>
                    <div className="kpi-value green">{accuracy}%</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">ROC-AUC SCORE</div>
                    <div className="kpi-value green">{(stats.roc_auc).toFixed(4)}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">TRAINING RUNTIME</div>
                    <div className="kpi-value red">{trainTime}s</div>
                </div>
            </div>

            <div className="chart-grid">
                {/* CONFUSION MATRIX */}
                <div className="content-card">
                    <h3>Confusion Matrix</h3>
                    <div className="cm-grid">
                        <div className="cm-cell transparent"></div>
                        <div className="cm-cell label">Pred: LEGIT</div>
                        <div className="cm-cell label">Pred: FRAUD</div>
                        
                        <div className="cm-cell label">Actual: LEGIT</div>
                        <div className="cm-cell tn">
                            <div className="cm-num green">{cm[0][0]}</div>
                            <div className="cm-text">TRUE NEG</div>
                        </div>
                        <div className="cm-cell fp">
                            <div className="cm-num red">{cm[0][1]}</div>
                            <div className="cm-text">FALSE POS</div>
                        </div>
                        
                        <div className="cm-cell label">Actual: FRAUD</div>
                        <div className="cm-cell fn">
                            <div className="cm-num red">{cm[1][0]}</div>
                            <div className="cm-text">FALSE NEG</div>
                        </div>
                        <div className="cm-cell tp">
                            <div className="cm-num green">{cm[1][1]}</div>
                            <div className="cm-text">TRUE POS</div>
                        </div>
                    </div>
                </div>

                {/* ROC CURVE */}
                <div className="content-card">
                    <h3>ROC Analysis</h3>
                    <div className="chart-wrapper">
                        <Line data={rocData} options={{ maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: "#333" } } } }} />
                    </div>
                </div>
            </div>

            {/* PROJECT METADATA */}
            <div className="project-details">
                <h3>Project Details</h3>
                <div className="details-grid">
                    <div className="detail-col">
                        <h4>Submitted By</h4>
                        <ul>
                            <li><strong>Nafiz Tonmoy</strong> (20220104136)</li>
                            <li><strong>Jamil Jim</strong> (20220104139)</li>
                            <li><strong>Md Nahid Hossain</strong> (20220104146)</li>
                        </ul>
                        <div className="sub-text">Lab Group: C2</div>
                    </div>
                    <div className="detail-col">
                        <h4>Submitted To</h4>
                        <ul>
                            <li><strong>Mr. Mustofa Ahmed</strong><br/><span>Lecturer, Dept of CSE</span></li>
                            <li><strong>Mr. Al Hasib Mahamud</strong><br/><span>Lecturer, Dept of CSE</span></li>
                        </ul>
                    </div>
                    <div className="detail-col right-align">
                         <div className="sub-text">
                            Department of Computer Science and Engineering<br/>
                            Ahsanullah University of Science and Technology
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <>
    <style>{`
      /* GLOBAL RESET & FONTS */
      :root {
        --bg: #050505;
        --panel: rgba(10,10,10,0.95);
        --border: #333;
        --green: #00ff88;
        --red: #ff0055;
        --text: #e0e0e0;
      }
      body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Rajdhani', sans-serif; overflow: hidden; }
      
      /* LAYOUT CONTAINERS */
      .app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
      .navbar { padding: 15px 30px; background: #0a0a0a; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; z-index: 20; }
      .main-content { flex: 1; display: flex; overflow: hidden; position: relative; }
      .loading-text { padding: 20px; color: #888; text-align: center; margin-top: 50px; font-family: 'Orbitron'; }

      /* NAV ELEMENTS */
      h1 { margin: 0; font-size: 1.4rem; font-family: 'Orbitron'; letter-spacing: 2px; }
      .nav-btn { background: transparent; color: #888; border: 1px solid var(--border); padding: 8px 20px; cursor: pointer; margin-left: 10px; font-family: 'Orbitron'; transition: 0.3s; }
      .nav-btn.active { background: var(--green); color: #000; border-color: var(--green); font-weight: bold; }
      
      /* SCANNER LAYOUT */
      .sidebar { width: 350px; padding: 30px; background: var(--panel); border-right: 1px solid var(--border); z-index: 10; display: flex; flex-direction: column; overflow-y: auto; }
      .visualizer { flex: 1; position: relative; background: radial-gradient(circle at center, #111, #000); }
      .hud-label { position: absolute; top: 20px; right: 20px; z-index: 5; color: #666; font-size: 0.8rem; }
      
      /* SCANNER COMPONENTS */
      .input-box { width: 100%; padding: 15px; background: var(--bg); border: 1px solid var(--border); color: #fff; font-size: 1.1rem; margin-bottom: 15px; border-radius: 5px; outline: none; text-align: center; box-sizing: border-box; }
      .scan-btn { width: 100%; padding: 15px; background: linear-gradient(90deg, var(--green), #00cc6a); border: none; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 1rem; letter-spacing: 2px; color: #000; transition: 0.3s; }
      .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .result-box { margin-top: 40px; animation: fadeIn 0.5s; }
      .ai-box { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 5px; margin-bottom: 20px; font-size: 0.9rem; line-height: 1.4; }
      
      /* RESEARCH TAB LAYOUT */
      .research-container { padding: 30px; width: 100%; height: 100%; overflow-y: auto; box-sizing: border-box; }
      .section-title { border-bottom: 1px solid var(--border); padding-bottom: 10px; color: #fff; font-family: 'Orbitron'; }
      
      /* GRIDS */
      .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
      .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
      
      /* CARDS & METRICS */
      .kpi-card { background: #111; padding: 20px; border-radius: 8px; border: 1px solid var(--border); text-align: center; }
      .kpi-label { font-size: 0.8rem; color: #888; margin-bottom: 5px; letter-spacing: 1px; }
      .kpi-value { font-size: 2.5rem; font-family: 'Orbitron'; font-weight: bold; }
      .kpi-value.green { color: var(--green); }
      .kpi-value.red { color: var(--red); }
      
      .content-card { background: #111; padding: 20px; border-radius: 10px; border: 1px solid var(--border); }
      .chart-wrapper { height: 200px; }
      
      /* CONFUSION MATRIX */
      .cm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center; font-family: 'Rajdhani'; }
      .cm-cell { padding: 10px; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
      .cm-cell.label { background: #222; color: #888; font-size: 0.8rem; }
      .cm-cell.tn, .cm-cell.tp { background: rgba(0, 255, 136, 0.2); border: 1px solid var(--green); }
      .cm-cell.fp, .cm-cell.fn { background: rgba(255, 0, 85, 0.2); border: 1px solid var(--red); }
      .cm-num { font-size: 1.5rem; font-weight: bold; }
      .cm-text { font-size: 0.7rem; opacity: 0.8; }
      .cm-num.green { color: var(--green); }
      .cm-num.red { color: var(--red); }
      
      /* PROJECT DETAILS */
      .project-details { margin-top: 40px; border-top: 1px solid var(--border); padding-top: 20px; }
      .details-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; }
      .detail-col { flex: 1; min-width: 250px; }
      .detail-col h4 { color: var(--green); margin-bottom: 10px; }
      .detail-col ul { list-style: none; padding: 0; color: #ccc; line-height: 1.6; }
      .detail-col span, .sub-text { font-size: 0.8rem; color: #888; }
      .right-align { text-align: right; }
      .right-align h4 { color: #fff; }

      /* --- RESPONSIVE MEDIA QUERIES --- */
      @media (max-width: 768px) {
        body { overflow: auto; }
        .app-container { height: auto; min-height: 100vh; overflow-x: hidden; }
        .navbar { flex-direction: column; gap: 10px; padding: 10px; }
        .main-content { flex-direction: column; height: auto; overflow: visible; }
        .sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--border); box-sizing: border-box; }
        .visualizer { height: 400px; width: 100%; }
        .kpi-grid { grid-template-columns: 1fr; }
        .chart-grid { grid-template-columns: 1fr; }
        .details-grid { flex-direction: column; }
        .detail-col { text-align: left; }
        .right-align { text-align: left; }
      }

      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
    
    <div className="app-container">
      {/* NAVBAR */}
      <div className="navbar">
        <h1>SECURE<span style={{color: "#00ff88"}}>ETHER</span></h1>
        <div>
            <button onClick={() => setActiveTab("scanner")} className={`nav-btn ${activeTab === "scanner" ? "active" : ""}`}>SCANNER</button>
            <button onClick={() => setActiveTab("research")} className={`nav-btn ${activeTab === "research" ? "active" : ""}`}>RESEARCH</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
          {activeTab === "research" ? (
              renderMetrics()
          ) : (
              <>
                {/* INPUTS SIDEBAR */}
                <div className="sidebar">
                    <h2 style={{ color: "#00ff88", fontSize: "1rem", marginBottom: "20px", fontFamily: "Orbitron" }}>TRANSACTION CHECKER</h2>
                    
                    <input 
                        type="number" 
                        placeholder="Enter Txn ID (e.g. 500)" 
                        value={txnId}
                        onChange={(e) => setTxnId(e.target.value)}
                        className="input-box"
                    />
                    
                    <button onClick={handlePredict} disabled={loading || !txnId} className="scan-btn">
                        {loading ? "PROCESSING..." : "SCAN CHAIN"}
                    </button>
                    
                    {result && (
                        <div className="result-box">
                            <div style={{ borderBottom: "1px solid #333", paddingBottom: "15px", marginBottom: "15px" }}>
                                <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "5px" }}>DETECTION RESULT</div>
                                <div style={{ 
                                    fontSize: "1.8rem", 
                                    fontWeight: "bold", 
                                    fontFamily: "Orbitron",
                                    color: result.is_fraud ? "#ff0055" : "#00ff88",
                                    textShadow: result.is_fraud ? "0 0 15px rgba(255, 0, 85, 0.5)" : "0 0 15px rgba(0, 255, 136, 0.5)"
                                }}>
                                    {result.is_fraud ? "FRAUD DETECTED" : "LEGITIMATE"}
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                <span style={{ color: "#eee" }}>RISK SCORE:</span>
                                <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: result.fraud_probability > 0.5 ? "#ff0055" : "#00ff88" }}>
                                    {(result.fraud_probability * 100).toFixed(2)}%
                                </span>
                            </div>

                            <div className="ai-box" style={{ borderLeft: result.is_fraud ? "3px solid #ff0055" : "3px solid #00ff88" }}>
                                <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: "5px", textTransform: "uppercase" }}>AI Reasoning (XAI)</div>
                                <div style={{ color: "#eee" }}>{getAIReasoning(result)}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "10px" }}>VISUAL EXPLANATION (SHAP)</div>
                                <ShapChart explanation={result.explanation} />
                            </div>
                        </div>
                    )}
                </div>

                {/* 3D VISUALIZER */}
                <div className="visualizer">
                    <div className="hud-label">INTERACTIVE 3D VISUALIZATION</div>
                    <Canvas camera={{ position: [0, 0, 4.5] }}>
                        <ambientLight intensity={0.5} />
                        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                        <OrbitControls autoRotate={!loading} enableZoom={true} />
                        <EthGlobe isFraud={result?.is_fraud} probability={result?.fraud_probability || 0} />
                    </Canvas>
                </div>
              </>
          )}
      </div>
    </div>
    </>
  );
};

export default Dashboard;