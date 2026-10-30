# Predictive Maintenance for a Connected Fleet

A production-grade, closed-loop predictive maintenance platform for connected fleets (heavy haul trucks, city transit buses, and industrial compressors). Continuously ingests streaming multi-sensor telemetry (vibration, temperature, motor current, discharge pressure, and RPM), calculates rolling window statistical features, forecasts Remaining Useful Life (RUL) with NASA C-MAPSS asymmetric scoring, autonomously raises prioritized maintenance work orders, and executes dynamic MLOps pipeline retraining.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│           React 19 + TypeScript + Vite SPA             │
│   Fleet Dashboard · Diagnostics · Triage · MLOps View  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP & WebSocket /api/*
┌───────────────────────────▼────────────────────────────┐
│                  Node.js / Express Host                │
│         Vite Middleware & Reverse Proxy Gateway        │
└───────────────────────────┬────────────────────────────┘
                            │ Internal Microservice (:5001)
┌───────────────────────────▼────────────────────────────┐
│                 Python 3.10 Backend                    │
│ ├── ml_engine.py           (Multivariate RUL & NASA)   │
│ ├── feature_engineering.py (Spike Filter & Rolling)    │
│ ├── triage_engine.py       (Automated Work Orders)     │
│ ├── mlops_engine.py        (Model Retrain & Drift PSI) │
│ └── gemini_service.py      (Fleet Advisor LLM & TTS)   │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Continuous Multi-Channel Telemetry Ingestion**
   - Monitors 5 core industrial telemetry streams: Vibration (mm/s RMS), Temperature (°C), Motor Current (Amps), Fluid Discharge Pressure (PSI), and Rotational Velocity (RPM).
   - Real-time streaming simulation with cycle-by-cycle machine run generation.

2. **Python Feature Engineering & Signal Conditioning**
   - 3-point local median filter suppresses transient electromagnetic transmission spikes without phase distortion.
   - Rolling window feature extraction: Rolling Mean, Rolling Standard Deviation/Variance, Trend Velocity ($\Delta x$), Exponential Moving Average (EMA), and baseline Z-Scores.

3. **Machine Learning & Remaining Useful Life (RUL) Inference**
   - Piece-wise linear degradation target formulation (healthy plateau capped at 125 cycles).
   - Multivariate anomaly detection envelope with subsystem risk decomposition (Bearings, HP Compressor, LP Turbine).
   - Asymmetric NASA C-MAPSS scoring ($s = \sum (\exp(d/\dots) - 1)$) penalizing late predictions.

4. **Closed-Loop Autonomous Work Order Triage**
   - Deterministic rule matrix mapping model outputs directly into maintenance bay tickets (P1 Emergency Grounding, P2 48h Inspection, P3 Scheduled Turnaround, P4 Routine).
   - **Human-in-the-Loop Exception Sign-Off**: Mandatory supervisor approval and justification before safety-isolating or grounding P1 critical machinery.

5. **MLOps Registry, PSI Drift & Dynamic Retraining**
   - Production vs. Challenger model tracking (XGBoost/LightGBM GBDT, Random Forest, ElasticNet, LSTM Proxy).
   - Real-time Population Stability Index (PSI) drift monitoring across all 5 sensor channels.
   - Dynamic parameter tuning and automated retraining pipeline triggered as telemetry batches accumulate.

6. **Fleet Chief Diagnostic AI & Voice Advisor**
   - Powered by Google Gemini (`models/gemini-3.8-flash`) and Speech Synthesis (`models/gemini-3.8-flash-lite-tts`).
   - Analyzes real-time multi-asset fleet state and answers complex diagnostic inquiries.

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── server.py              # Python HTTP REST microservice
│   ├── ml_engine.py           # RUL inference, wear models & NASA scoring
│   ├── feature_engineering.py # Spike filter & rolling window calculations
│   ├── triage_engine.py       # Rule-based triage & work order generation
│   ├── mlops_engine.py        # Model registry, retraining & PSI drift
│   └── gemini_service.py      # Gemini diagnostic reasoning & speech
├── src/
│   ├── components/            # React dashboard components
│   ├── data/                  # NASA C-MAPSS turbofan & fleet data
│   ├── services/              # Client API bridges & fallback utilities
│   ├── types/                 # TypeScript interfaces & data contracts
│   ├── App.tsx                # Main application state & router
│   └── main.tsx               # Entry point
├── server.ts                  # Node.js Express server spawning Python & Vite
├── package.json
└── tsconfig.json
```

---

## ⚡ Quickstart

### Prerequisites
- Node.js 20+
- Python 3.10+
- Gemini API Key (set in `.env` as `GEMINI_API_KEY`)

### Installation & Run

```bash
# 1. Clone repository
git clone https://github.com/Nitesh-093/Predictive-Maintenance-for-a-Connected-Fleet.git
cd Predictive-Maintenance-for-a-Connected-Fleet

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and insert your GEMINI_API_KEY

# 4. Start full-stack development server
npm run dev
```

The application will be live at `http://localhost:3000`. The Node.js server automatically boots the Python microservice on `http://127.0.0.1:5001`.
