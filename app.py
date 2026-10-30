"""
Self-Healing Connected Fleet: Predictive Maintenance & MLOps Platform
Pure Python Streamlit Application
Deployable on Streamlit Community Cloud, Hugging Face Spaces, or Local
"""

import os
import sys
import json
import datetime
import math
from typing import Dict, Any, List

import streamlit as st

# Ensure local imports work in any environment
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from cmapss_data import initialize_fleet, generate_machine_run
from ml_engine import predict_rul, calculate_nasa_score, generate_run_comparison, BENCHMARK_MODELS
from feature_engineering import calculate_rolling_features, clean_sensor_stream, get_sensor_correlations
from triage_engine import evaluate_triage_logic, generate_work_order
from mlops_engine import mlops_registry
from gemini_service import gemini_service

# Page Configuration
st.set_page_config(
    page_title="Self-Healing Fleet: Predictive Maintenance & MLOps",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling
st.markdown("""
<style>
    .metric-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .badge-critical {
        background-color: #fee2e2;
        color: #991b1b;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
    }
    .badge-high {
        background-color: #fef3c7;
        color: #92400e;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
    }
    .badge-healthy {
        background-color: #dcfce7;
        color: #166534;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# Session State Initialization
# ==========================================
if "fleet" not in st.session_state:
    st.session_state.fleet = initialize_fleet()

if "selected_engine_id" not in st.session_state:
    st.session_state.selected_engine_id = "TRK-101"

if "selected_model_id" not in st.session_state:
    st.session_state.selected_model_id = "gbdt"

if "work_orders" not in st.session_state:
    # Initialize starter work orders
    f = st.session_state.fleet
    trk = next(e for e in f if e["engineId"] == "TRK-101")
    bus = next(e for e in f if e["engineId"] == "BUS-204")
    cmp = next(e for e in f if e["engineId"] == "CMP-309")

    wo1 = generate_work_order(trk, predict_rul(trk["history"]))
    wo1["status"] = "PENDING_APPROVAL"
    wo1["isException"] = True
    wo1["exceptionReason"] = "P1 Safety Isolation: RUL < 20 cycles with severe vibration and motor current surge. Human supervisor sign-off required to ground truck."

    wo2 = generate_work_order(bus, predict_rul(bus["history"]))
    wo2["status"] = "DISPATCHED"
    wo2["isException"] = False

    wo3 = generate_work_order(cmp, predict_rul(cmp["history"]))
    wo3["status"] = "PENDING_APPROVAL"
    wo3["isException"] = True
    wo3["exceptionReason"] = "Bearing Thermal Overheat: Severe discharge pressure deficit on petrochemical gas line. Emergency isolation sign-off needed."

    st.session_state.work_orders = [wo1, wo2, wo3]

if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "Good day. I am your Fleet Chief Diagnostic AI. Ask me about real-time asset health, remaining useful life (RUL) projections, streaming sensor anomalies (vibration, temp, current, pressure, rpm), or pending work order exceptions."
        }
    ]


# Helper to get currently selected machine
def get_selected_machine() -> Dict[str, Any]:
    return next(
        (e for e in st.session_state.fleet if e["engineId"] == st.session_state.selected_engine_id),
        st.session_state.fleet[0]
    )


# ==========================================
# Sidebar Controls
# ==========================================
st.sidebar.title("⚙️ FleetPulse")
st.sidebar.caption("Connected Fleet Predictive Maintenance & MLOps Platform (Python/Streamlit)")

st.sidebar.subheader("Selected Asset")
engine_ids = [e["engineId"] for e in st.session_state.fleet]
current_idx = engine_ids.index(st.session_state.selected_engine_id) if st.session_state.selected_engine_id in engine_ids else 0
chosen_id = st.sidebar.selectbox("Active Machine", engine_ids, index=current_idx)
st.session_state.selected_engine_id = chosen_id

active_machine = get_selected_machine()
st.sidebar.info(f"**Type:** {active_machine['fleetType']}\n\n**Model:** {active_machine['modelDesignation']}\n\n**Depot:** {active_machine['assignedDepot']}")

st.sidebar.subheader("Cycle Stepper (Streaming Simulator)")
col_s1, col_s2, col_s3 = st.sidebar.columns(3)

def advance_cycle(step: int):
    target = min(active_machine["maxHistoricalCycle"], active_machine["currentCycle"] + step)
    updated = generate_machine_run(
        active_machine["engineId"],
        active_machine["maxHistoricalCycle"],
        target,
        active_machine["fleetType"],
        active_machine["modelDesignation"],
        active_machine["operatingCondition"]
    )
    # Check for auto-triage
    pred = predict_rul(updated["history"])
    if pred["predictedRUL"] < 20 and not any(w["engineId"] == updated["engineId"] and w["status"] != "COMPLETED" for w in st.session_state.work_orders):
        auto_wo = generate_work_order(updated, pred)
        st.session_state.work_orders.insert(0, auto_wo)

    for i, m in enumerate(st.session_state.fleet):
        if m["engineId"] == updated["engineId"]:
            st.session_state.fleet[i] = updated
            break

if col_s1.button("+1 Cyc"):
    advance_cycle(1)
    st.rerun()

if col_s2.button("+5 Cyc"):
    advance_cycle(5)
    st.rerun()

if col_s3.button("+20 Cyc"):
    advance_cycle(20)
    st.rerun()

if st.sidebar.button("🔄 Reset Machine to Healthy Baseline (Cycle 20)"):
    reset_machine = generate_machine_run(
        active_machine["engineId"],
        active_machine["maxHistoricalCycle"],
        20,
        active_machine["fleetType"],
        active_machine["modelDesignation"],
        active_machine["operatingCondition"]
    )
    for i, m in enumerate(st.session_state.fleet):
        if m["engineId"] == reset_machine["engineId"]:
            st.session_state.fleet[i] = reset_machine
            break
    st.rerun()

st.sidebar.subheader("ML Model Algorithm")
model_options = {
    "gbdt": "Gradient Boosted Trees (XGBoost/LightGBM)",
    "rf": "Random Forest Regressor (100 Trees)",
    "lstm": "Temporal Sequence Net (LSTM Proxy)",
    "elasticnet": "ElasticNet Linear Regularized Baseline"
}
selected_model = st.sidebar.selectbox(
    "Active Inference Engine",
    list(model_options.keys()),
    format_func=lambda k: model_options[k],
    index=list(model_options.keys()).index(st.session_state.selected_model_id)
)
st.session_state.selected_model_id = selected_model

# Latest Telemetry in Sidebar
latest_read = active_machine["history"][-1] if active_machine["history"] else {}
st.sidebar.subheader("Live Telemetry Snapshot")
st.sidebar.text(f"Vibration:    {latest_read.get('vibration', 0.0)} mm/s RMS")
st.sidebar.text(f"Temperature:  {latest_read.get('temperature', 0.0)} °C")
st.sidebar.text(f"Motor Curr:   {latest_read.get('motorCurrent', 0.0)} A")
st.sidebar.text(f"Pressure:     {latest_read.get('pressure', 0.0)} PSI")
st.sidebar.text(f"Speed (RPM):  {latest_read.get('rpm', 0)} RPM")


# ==========================================
# Main Content: Navigation Tabs
# ==========================================
tab_overview, tab_diagnostics, tab_orders, tab_mlops, tab_advisor, tab_arch = st.tabs([
    "📊 Fleet Overview",
    "🔬 Diagnostics & RUL",
    "🛡️ Automated Work Orders",
    "⚙️ MLOps Retraining",
    "💬 Fleet Advisor AI",
    "📐 System Architecture",
])


# ----------------------------------------------------
# TAB 1: FLEET OVERVIEW
# ----------------------------------------------------
with tab_overview:
    total_assets = len(st.session_state.fleet)
    critical_units = sum(1 for e in st.session_state.fleet if e["status"] == "Critical")
    maint_units = sum(1 for e in st.session_state.fleet if e["status"] == "Maintenance Required")
    avg_health = sum(e["healthScore"] for e in st.session_state.fleet) / total_assets
    pending_exceptions = sum(1 for w in st.session_state.work_orders if w.get("isException") and w["status"] == "PENDING_APPROVAL")

    m_col1, m_col2, m_col3, m_col4, m_col5 = st.columns(5)
    m_col1.metric("Monitored Assets", total_assets, "100% Streaming")
    m_col2.metric("Critical Units", critical_units, "-1 Grounded" if critical_units > 0 else "Nominal", delta_color="inverse")
    m_col3.metric("Maintenance Required", maint_units, "Pending Bay")
    m_col4.metric("Avg Fleet Health", f"{avg_health:.1f}%", "-2.4% Drift")
    m_col5.metric("Pending Exceptions", pending_exceptions, "Sign-off Required" if pending_exceptions > 0 else "Clear", delta_color="inverse")

    st.markdown("---")
    st.subheader("Connected Assets Fleet Roster")

    cols = st.columns(3)
    for idx, eng in enumerate(st.session_state.fleet):
        with cols[idx % 3]:
            with st.container(border=True):
                top_c1, top_c2 = st.columns([2, 1])
                top_c1.markdown(f"### {eng['engineId']}")
                status_color = "red" if eng['status'] == "Critical" else "orange" if eng['status'] == "Maintenance Required" else "green"
                top_c2.markdown(f":{status_color}[**{eng['status']}**]")

                st.caption(f"{eng['fleetType']} · {eng['modelDesignation']}")
                
                c_a, c_b = st.columns(2)
                c_a.metric("Predicted RUL", f"{eng['predictedRUL']} cyc")
                c_b.metric("Health Score", f"{eng['healthScore']}%")

                st.progress(eng['healthScore'] / 100.0)

                latest = eng["history"][-1] if eng["history"] else {}
                st.caption(f"**Sensors:** Vib {latest.get('vibration', 0)} mm/s | Temp {latest.get('temperature', 0)}°C | Curr {latest.get('motorCurrent', 0)}A | Pres {latest.get('pressure', 0)} PSI")

                if st.button(f"🔍 Inspect {eng['engineId']}", key=f"btn_inspect_{eng['engineId']}"):
                    st.session_state.selected_engine_id = eng['engineId']
                    st.rerun()


# ----------------------------------------------------
# TAB 2: DIAGNOSTICS & RUL ANALYTICS
# ----------------------------------------------------
with tab_diagnostics:
    active_eng = get_selected_machine()
    pred_result = predict_rul(active_eng["history"], st.session_state.selected_model_id)

    st.subheader(f"Diagnostic Breakdown: {active_eng['engineId']} ({active_eng['fleetType']})")
    
    diag_c1, diag_c2, diag_c3, diag_c4 = st.columns(4)
    diag_c1.metric("Predicted RUL", f"{pred_result['predictedRUL']} cycles", f"True: {active_eng['trueRUL']} cycles")
    diag_c2.metric("Confidence Interval", f"{pred_result['confidenceInterval'][0]} - {pred_result['confidenceInterval'][1]} cyc", "90% Interval")
    diag_c3.metric("Anomaly Score", f"{pred_result['anomalyScore'] * 100:.1f}%", "Above Threshold" if pred_result['anomalyDetected'] else "Nominal", delta_color="inverse")
    diag_c4.metric("Dominant Wear Factor", pred_result['dominantSensorContribution'])

    st.markdown("#### Multi-Sensor Streaming Trajectory")
    
    # Plot sensor curves using Streamlit line charts or Plotly
    history = active_eng["history"]
    if history:
        cycles = [h["cycle"] for h in history]
        vibrations = [h["vibration"] for h in history]
        temperatures = [h["temperature"] for h in history]
        currents = [h["motorCurrent"] for h in history]
        pressures = [h["pressure"] for h in history]
        rpms = [h["rpm"] for h in history]

        chart_col1, chart_col2 = st.columns(2)
        with chart_col1:
            st.markdown("**Vibration (mm/s RMS) & Motor Current (Amps)**")
            import pandas as pd
            df_mech = pd.DataFrame({
                "Cycle": cycles,
                "Vibration (mm/s)": vibrations,
                "Current (A)": currents,
            }).set_index("Cycle")
            st.line_chart(df_mech)

        with chart_col2:
            st.markdown("**Temperature (°C) & Discharge Pressure (PSI)**")
            df_therm = pd.DataFrame({
                "Cycle": cycles,
                "Temperature (°C)": temperatures,
                "Pressure (PSI)": pressures,
            }).set_index("Cycle")
            st.line_chart(df_therm)

    st.markdown("#### Rolling Window Feature Engineering (15 Cycles)")
    rolling_feats = calculate_rolling_features(active_eng["history"], window_size=15)
    if rolling_feats:
        feat_data = []
        for f in rolling_feats:
            feat_data.append({
                "Engineered Feature": f["featureName"],
                "Sensor": f["rawSensor"],
                "Category": f["category"],
                "Current Value": f["currentValue"],
                "Z-Score": f["zScore"],
                "Weight": f["importance"],
            })
        st.dataframe(pd.DataFrame(feat_data), use_container_width=True)

    st.markdown("#### NASA C-MAPSS Run Comparison Curve")
    comparison = generate_run_comparison(active_eng["maxHistoricalCycle"], int(active_eng["maxHistoricalCycle"] * 0.9))
    if comparison:
        df_comp = pd.DataFrame(comparison).set_index("cycle")
        st.line_chart(df_comp[["actualRUL", "gbdtPredicted", "linearPredicted"]])


# ----------------------------------------------------
# TAB 3: AUTOMATED WORK ORDERS & TRIAGE
# ----------------------------------------------------
with tab_orders:
    st.subheader("Autonomous Work Order Queue & Human-in-the-Loop Sign-off")
    st.caption("Deterministic closed-loop triage maps sensor degradation directly into prioritized repair tickets.")

    # Action to create a new work order for current asset
    if st.button("➕ Generate Autonomous Work Order for Selected Asset"):
        eng = get_selected_machine()
        pred = predict_rul(eng["history"], st.session_state.selected_model_id)
        new_wo = generate_work_order(eng, pred)
        st.session_state.work_orders.insert(0, new_wo)
        st.success(f"Work order {new_wo['id']} raised successfully!")
        st.rerun()

    st.markdown("---")

    for wo in st.session_state.work_orders:
        with st.container(border=True):
            h_c1, h_c2, h_c3, h_c4 = st.columns([2, 1, 1, 1])
            h_c1.markdown(f"### {wo['id']} · {wo['engineId']}")
            
            p_color = "red" if "P1" in wo['priority'] else "orange" if "P2" in wo['priority'] else "blue"
            h_c2.markdown(f":{p_color}[**{wo['priority']}**]")
            
            status_badge = "🔴 PENDING APPROVAL" if wo['status'] == "PENDING_APPROVAL" else "🟢 DISPATCHED" if wo['status'] == "DISPATCHED" else "🔵 APPROVED"
            h_c3.markdown(f"**{status_badge}**")
            h_c4.text(f"RUL: {wo['predictedRUL']} cyc")

            st.markdown(f"**Primary Diagnosis:** {wo['primaryFailureMode']}")
            st.markdown(f"**Recommended Action:** {wo['actionRequired']}")
            st.caption(f"**Required Parts:** {', '.join(wo.get('requiredParts', []))}")
            st.caption(f"**Assigned Specialist:** {wo['assignedTechnician']} | **Estimated Downtime:** {wo['estimatedDowntimeHours']} hrs | **Est. Cost:** ${wo['estimatedCost']:,}")

            if wo.get("isException") and wo["status"] == "PENDING_APPROVAL":
                st.warning(f"⚠️ **Supervisor Exception Notice:** {wo.get('exceptionReason')}")
                note = st.text_input(f"Supervisor Authorization Notes ({wo['id']})", value="Authorized emergency bay isolation and lock-out tag-out.", key=f"note_{wo['id']}")
                if st.button(f"✍️ Sign-Off & Authorize Isolation ({wo['id']})", key=f"sign_{wo['id']}"):
                    wo["status"] = "APPROVED"
                    wo["approvalNotes"] = note
                    st.success("Authorized by Lead Maintenance Supervisor.")
                    st.rerun()
            elif wo["status"] == "APPROVED":
                if st.button(f"🚀 Dispatch to Maintenance Bay ({wo['id']})", key=f"disp_{wo['id']}"):
                    wo["status"] = "DISPATCHED"
                    st.rerun()


# ----------------------------------------------------
# TAB 4: MLOPS RETRAINING CENTER
# ----------------------------------------------------
with tab_mlops:
    st.subheader("Model Registry & Automated Pipeline Retraining")
    st.caption("Continuously monitors telemetry distribution drift and executes dynamic retraining cycles on newly accumulated streaming batches.")

    if st.button("⚡ Trigger Retraining Pipeline on Latest Ingested Telemetry"):
        with st.spinner("Ingesting continuous sensor batches & retraining Gradient Boosted Trees model in Python..."):
            retrain_res = mlops_registry.retrain_pipeline("Manual Trigger: Batch Stream Convergence")
            st.success(f"New Champion model {retrain_res['newVersion']['version']} promoted to Production! RMSE reduced to {retrain_res['newVersion']['rmse']}.")
            st.rerun()

    models = mlops_registry.get_models()
    st.markdown("#### Active Model Registry (Champion / Challenger)")
    
    model_rows = []
    for m in models:
        model_rows.append({
            "Version": m["version"],
            "Algorithm": m["modelFamily"],
            "Status": m["status"],
            "RMSE": m["rmse"],
            "MAE": m["mae"],
            "R² Score": m["r2"],
            "NASA Asymmetric Score": m["nasaScore"],
            "Drift Status": m["driftStatus"],
            "Trained At": m["trainedAt"][:19],
        })
    st.dataframe(pd.DataFrame(model_rows), use_container_width=True)

    st.markdown("#### Multi-Channel Population Stability Index (PSI) Drift Monitor")
    drift_metrics = mlops_registry.compute_data_drift()
    st.dataframe(pd.DataFrame(drift_metrics), use_container_width=True)

    st.markdown("#### Retraining Pipeline Run Logs")
    logs = mlops_registry.get_retraining_logs()
    st.dataframe(pd.DataFrame(logs), use_container_width=True)


# ----------------------------------------------------
# TAB 5: FLEET DIAGNOSTIC ADVISOR (GEMINI)
# ----------------------------------------------------
with tab_advisor:
    st.subheader("Fleet Chief Diagnostic AI (Google Gemini)")
    st.caption("Ask questions about machine degradation, vibration surges, temperature spikes, remaining useful life, or work order priorities.")

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_query = st.chat_input("E.g., Which machines are in critical condition and what parts do they need?")
    if user_query:
        st.session_state.messages.append({"role": "user", "content": user_query})
        with st.chat_message("user"):
            st.markdown(user_query)

        # Build fleet summary snapshot
        fleet_summary = [
            {
                "id": m["engineId"],
                "type": m["fleetType"],
                "predictedRUL": m["predictedRUL"],
                "healthScore": m["healthScore"],
                "vibration": m["history"][-1]["vibration"] if m["history"] else 0,
                "temperature": m["history"][-1]["temperature"] if m["history"] else 0,
                "motorCurrent": m["history"][-1]["motorCurrent"] if m["history"] else 0,
                "pressure": m["history"][-1]["pressure"] if m["history"] else 0,
                "status": m["status"],
            }
            for m in st.session_state.fleet
        ]

        with st.chat_message("assistant"):
            with st.spinner("Analyzing fleet telemetry with Python Diagnostic AI..."):
                response = gemini_service.handle_conversation(user_query, fleet_summary, return_audio=False)
                answer = response.get("text", "Telemetry nominal across all machines.")
                st.markdown(answer)
                st.session_state.messages.append({"role": "assistant", "content": answer})


# ----------------------------------------------------
# TAB 6: SYSTEM ARCHITECTURE
# ----------------------------------------------------
with tab_arch:
    st.subheader("Closed-Loop Predictive Maintenance Architecture")
    st.markdown("""
    ```
    [1. IoT Sensor Telemetry] ➔ [2. Signal Conditioning & Rolling Features] ➔ [3. ML Inference (RUL & NASA Score)]
                                                                                               │
    [5. MLOps Retraining Pipeline]  [4. Closed-Loop Autonomous Work Order Triage] ───────────┘
    ```
    """)
    st.markdown("""
    ### 5 Operational Stages:
    1. **Continuous Telemetry Ingestion**: Ingests 5 high-frequency channels (Vibration, Temperature, Motor Current, Pressure, RPM).
    2. **Data Engineering Layer**: 3-point temporal median spike filter suppresses dropouts without phase distortion; rolling window extracts Mean, Variance, Trend Velocity, and EMA.
    3. **Machine Learning Layer**: Piece-wise degradation model (healthy plateau capped at 125 cycles) with Gradient Boosted Decision Trees (XGBoost/LightGBM proxy) and asymmetric NASA C-MAPSS scoring.
    4. **Autonomous Triage Layer**: Deterministic rule matrix automatically generates prioritized maintenance tickets (P1 to P4) with human-in-the-loop sign-off for safety grounding.
    5. **MLOps Retraining Layer**: Continuous PSI drift tracking and automated model re-fitting as streaming data accumulates.
    """)
