#!/usr/bin/env python3
"""
Python Backend Server for Self-Healing Fleet: Predictive Maintenance & MLOps Platform
Built with Python 3.10 standard library HTTP server.
Provides high-performance endpoints for:
- RUL ML inference & NASA C-MAPSS scoring
- Streaming sensor feature engineering & spike filtering
- Deterministic automated triage & human-in-the-loop work orders
- MLOps dynamic model retraining & PSI drift monitoring
- Gemini fleet diagnostic conversational AI & TTS
"""

import sys
import os
import json
import time
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Ensure local backend modules can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import backend modules
from ml_engine import predict_rul, calculate_nasa_score, generate_run_comparison, BENCHMARK_MODELS
from feature_engineering import clean_sensor_stream, calculate_rolling_features, get_sensor_correlations
from triage_engine import evaluate_triage_logic, generate_work_order
from mlops_engine import mlops_registry
from gemini_service import gemini_service

SERVER_START_TIME = time.time()
REQUEST_COUNTER = 0


class FleetApiHandler(BaseHTTPRequestHandler):
    server_version = "FleetPulsePython/1.0"

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def _send_json(self, status_code: int, data: dict):
        global REQUEST_COUNTER
        REQUEST_COUNTER += 1
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                raw_data = self.rfile.read(content_length)
                return json.loads(raw_data.decode("utf-8"))
        except Exception:
            pass
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Health & runtime status
        if path == "/api/status" or path == "/api/backend/status" or path == "/status":
            uptime_seconds = int(time.time() - SERVER_START_TIME)
            return self._send_json(200, {
                "status": "ONLINE",
                "backend": "Python 3.10 Predictive Maintenance Engine",
                "pythonVersion": sys.version.split()[0],
                "platform": sys.platform,
                "uptimeSeconds": uptime_seconds,
                "totalRequestsHandled": REQUEST_COUNTER,
                "activeEngines": [
                    "ml_engine.py (Multivariate RUL & NASA C-MAPSS)",
                    "feature_engineering.py (Rolling Feature Extraction & Spike Filter)",
                    "triage_engine.py (Automated Closed-Loop Work Order Triage)",
                    "mlops_engine.py (Model Registry, Drift PSI & Dynamic Retraining)",
                    "gemini_service.py (Fleet Diagnostic LLM & Speech Synthesis)",
                ],
            })

        # ML benchmarks catalog
        if path == "/api/ml/benchmarks":
            return self._send_json(200, {"benchmarks": BENCHMARK_MODELS})

        # Data engineering correlations
        if path == "/api/data/correlations":
            return self._send_json(200, {"correlations": get_sensor_correlations()})

        # MLOps models and drift
        if path == "/api/mlops/models":
            return self._send_json(200, {
                "models": mlops_registry.get_models(),
                "logs": mlops_registry.get_retraining_logs(),
                "driftMetrics": mlops_registry.compute_data_drift(),
            })

        return self._send_json(404, {"error": f"Endpoint {self.path} not found on Python backend"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        body = self._read_json_body()

        # 1. ML RUL Prediction
        if path == "/api/ml/predict-rul":
            readings = body.get("readings", [])
            model_id = body.get("modelId", "gbdt")
            result = predict_rul(readings, model_id)
            return self._send_json(200, result)

        # 2. ML Lifecycle Comparison Curve
        if path == "/api/ml/run-comparison":
            machine_total_cycles = int(body.get("machineTotalCycles", 160))
            actual_failure_cycle = int(body.get("actualFailureCycle", 140))
            comparison = generate_run_comparison(machine_total_cycles, actual_failure_cycle)
            return self._send_json(200, {"comparison": comparison})

        # 3. NASA Score Calculation
        if path == "/api/ml/nasa-score":
            errors = body.get("errors", [])
            score = calculate_nasa_score(errors)
            return self._send_json(200, {"nasaScore": score})

        # 4. Sensor Cleaning & Outlier Filtration
        if path == "/api/data/clean-stream":
            raw_readings = body.get("readings", [])
            config = body.get("config", {})
            cleaned = clean_sensor_stream(raw_readings, config)
            return self._send_json(200, {"cleaned": cleaned})

        # 5. Rolling Feature Engineering
        if path == "/api/data/rolling-features":
            readings = body.get("readings", [])
            window_size = int(body.get("windowSize", 15))
            features = calculate_rolling_features(readings, window_size)
            return self._send_json(200, {"features": features})

        # 6. Triage Logic Evaluation
        if path == "/api/triage/evaluate":
            engine = body.get("engine", {})
            prediction = body.get("prediction", {})
            config = body.get("config", None)
            decision = evaluate_triage_logic(engine, prediction, config)
            return self._send_json(200, {"decision": decision})

        # 7. Generate Work Order
        if path == "/api/triage/generate-work-order":
            engine = body.get("engine", {})
            prediction = body.get("prediction", {})
            config = body.get("config", None)
            work_order = generate_work_order(engine, prediction, config)
            return self._send_json(200, {"workOrder": work_order})

        # 8. MLOps Retrain Pipeline
        if path == "/api/mlops/retrain":
            trigger_reason = body.get("triggerReason", "Automated Streaming Telemetry Batch Ingestion")
            result = mlops_registry.retrain_pipeline(trigger_reason)
            return self._send_json(200, result)

        # 9. Fleet Chief Diagnostic Conversation
        if path == "/api/fleet/conversation":
            message = body.get("message") or body.get("prompt") or ""
            fleet_summary = body.get("fleetSummary") or body.get("fleetContext")
            return_audio = body.get("returnAudio", True)
            if not message:
                return self._send_json(400, {"error": "Message or prompt is required"})
            result = gemini_service.handle_conversation(message, fleet_summary, return_audio)
            return self._send_json(200, result)

        # 10. Fleet Chief TTS
        if path == "/api/fleet/tts":
            text = body.get("text", "")
            voice = body.get("voice", "Zephyr")
            if not text:
                return self._send_json(400, {"error": "Text is required"})
            audio_base64 = gemini_service.generate_tts(text, voice)
            return self._send_json(200, {"audio": audio_base64})

        return self._send_json(404, {"error": f"Endpoint {self.path} not found on Python backend"})

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[PythonBackend] {self.address_string()} - {format % args}\n")


def run_server(port: int = 5001):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, FleetApiHandler)
    print(f"🚀 Python Predictive Maintenance Backend running on http://127.0.0.1:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Python backend server...", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FleetPulse Python Backend Server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PYTHON_PORT", 5001)), help="Port to run on")
    args = parser.parse_args()
    run_server(args.port)
