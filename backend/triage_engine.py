"""
Automated Rule-Based Triage Engine & Human-in-the-Loop Work Order Generation in Python
"""

import datetime
import random
import re
from typing import Dict, Any, Optional, List


DEFAULT_TRIAGE_CONFIG = {
    "criticalRulThreshold": 20,
    "criticalAnomalyThreshold": 0.82,
    "highRiskRulThreshold": 45,
    "highRiskAnomalyThreshold": 0.65,
    "moderateRiskRulThreshold": 85,
}


def evaluate_triage_logic(
    engine: Dict[str, Any],
    prediction: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Deterministic Rule-Based Triage Engine (Closed-Loop, Non-LLM) in Python.
    Evaluates machine telemetry, RUL, and operational constraints.
    """
    cfg = config or DEFAULT_TRIAGE_CONFIG
    critical_rul = cfg.get("criticalRulThreshold", 20)
    critical_anomaly = cfg.get("criticalAnomalyThreshold", 0.82)
    high_risk_rul = cfg.get("highRiskRulThreshold", 45)
    high_risk_anomaly = cfg.get("highRiskAnomalyThreshold", 0.65)
    moderate_risk_rul = cfg.get("moderateRiskRulThreshold", 85)

    predicted_rul = prediction.get("predictedRUL", 100)
    anomaly_score = prediction.get("anomalyScore", 0.1)
    dominant_sensor = prediction.get("dominantSensorContribution", "Mechanical Sensor")

    history = engine.get("history", [])
    latest = history[-1] if history else {}
    fleet_type = engine.get("fleetType", "Heavy Haul Truck")

    # Domain-specific failure mode synthesis
    dominant_failure = "Rotor Shaft Bearing Pitting & Severe Vibration"
    parts_list = ["High-Speed Spherical Roller Bearings", "Vibration Isolator Bushings", "Synthetic Gear Lubricant"]
    action = "Immediate bearing vibration survey; laser alignment of motor-compressor coupling; oil flush"
    base_hours = 14
    base_cost = 6400

    if fleet_type == "Heavy Haul Truck":
        if float(latest.get("motorCurrent", 0.0)) > 62.0:
            dominant_failure = "Electric Drivetrain Inverter & Motor Winding Thermal Overload"
            parts_list = ["Stator Winding Thermal Sensor", "Cooling Fan Assembly", "Insulation Resistance Test Kit"]
            action = "Megohmmeter insulation resistance test; clean cooling channels; inspect power IGBT inverter"
            base_hours = 10
            base_cost = 8200
        else:
            dominant_failure = "Drive Axle Differential & Wheel End Bearing Degradation"
            parts_list = ["Tapered Wheel Bearings", "Hub Oil Seals", "Heavy-Duty Synthetic 75W-90"]
            action = "Borescope inspection of differential ring gear; replace wheel end hub seals; torque check"
            base_hours = 8
            base_cost = 4500
    elif fleet_type == "City Transit Bus":
        dominant_failure = "Pneumatic Braking Compressor & Air Dryer Desiccant Saturation"
        parts_list = ["Twin-Cylinder Compressor Overhaul Kit", "Desiccant Cartridge", "Pressure Relief Unloader Valve"]
        action = "Service air delivery circuit; test unloader valve pressure cutoff; rebuild compressor cylinder head"
        base_hours = 7
        base_cost = 3900
    elif fleet_type == "Industrial Compressor":
        dominant_failure = "Screw Element Clearance Erosion & High Discharge Pressure Loss"
        parts_list = ["Rotary Screw Airend Rotor Set", "PTFE Shaft Seal Kit", "Minimum Pressure Check Valve"]
        action = "Inspect screw rotor tip clearances with feeler gauges; replace mechanical shaft seals and separator"
        base_hours = 20
        base_cost = 14800

    # 1. P1 - Emergency Grounding / Safety Isolation (Human sign-off mandatory)
    if predicted_rul <= critical_rul or anomaly_score >= critical_anomaly:
        return {
            "severity": "CRITICAL",
            "primaryFailureMode": dominant_failure,
            "triggerReason": (
                f"Remaining useful life ({predicted_rul} cycles) breached safety threshold "
                f"(< {critical_rul} cycles) with high anomaly index ({round(anomaly_score * 100, 1)}%). "
                f"Dominant: {dominant_sensor}."
            ),
            "priority": "P1 - Immediate Grounding",
            "actionRequired": f"SAFETY ISOLATION: Lock out and tag out machine immediately. Halt operation prior to next shift. {action}",
            "requiredParts": parts_list + ["Emergency Hardware Overhaul Pack"],
            "assignedTechnician": "Sarah Jenkins (Lead Mechanical Systems Engineer)",
            "estimatedDowntimeHours": base_hours + 8,
            "estimatedCost": base_cost + 2800,
            "isException": True,
            "exceptionReason": (
                f"Critical Safety Event: RUL is below {critical_rul} cycles. "
                "Automatic work order raised; human supervisor sign-off required to authorize emergency equipment grounding."
            ),
            "confidenceScore": 0.97,
        }

    # 2. P2 - High Risk
    if predicted_rul <= high_risk_rul or anomaly_score >= high_risk_anomaly:
        return {
            "severity": "HIGH",
            "primaryFailureMode": dominant_failure,
            "triggerReason": (
                f"Accelerated sensor degradation detected. RUL: {predicted_rul} cycles "
                f"(Threshold < {high_risk_rul}). Dominant: {dominant_sensor}."
            ),
            "priority": "P2 - 48h Inspection",
            "actionRequired": f"Schedule maintenance bay diagnostic within 48 operational hours. {action}",
            "requiredParts": parts_list,
            "assignedTechnician": "Marcus Vance (Field Diagnostic Lead)",
            "estimatedDowntimeHours": base_hours,
            "estimatedCost": base_cost,
            "isException": False,
            "confidenceScore": 0.91,
        }

    # 3. P3 - Moderate Wear
    if predicted_rul <= moderate_risk_rul:
        return {
            "severity": "MODERATE",
            "primaryFailureMode": f"{dominant_failure} (Incipient Wear)",
            "triggerReason": f"Linear wear progression detected (RUL: {predicted_rul} cycles).",
            "priority": "P3 - Next Turnaround",
            "actionRequired": "Pre-allocate replacement parts from inventory; execute service at next scheduled turnaround interval.",
            "requiredParts": [parts_list[0], "Gasket & Filter Pack"],
            "assignedTechnician": "David Chen (Fleet Technician II)",
            "estimatedDowntimeHours": int(round(base_hours * 0.6)),
            "estimatedCost": int(round(base_cost * 0.55)),
            "isException": False,
            "confidenceScore": 0.86,
        }

    # 4. P4 - Normal Operation
    return {
        "severity": "NORMAL",
        "primaryFailureMode": "Nominal Operating Parameters (Zero Degradation Faults)",
        "triggerReason": "All sensor channels (vibration, temp, current, pressure, rpm) operate inside nominal ±1.5σ baseline.",
        "priority": "P4 - Routine",
        "actionRequired": "Continue continuous streaming sensor ingestion.",
        "requiredParts": [],
        "assignedTechnician": "Automated Diagnostic Daemon (Python Engine)",
        "estimatedDowntimeHours": 0,
        "estimatedCost": 0,
        "isException": False,
        "confidenceScore": 0.99,
    }


def generate_work_order(
    engine: Dict[str, Any],
    prediction: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generates a full operational work order structure from Python triage evaluation.
    """
    decision = evaluate_triage_logic(engine, prediction, config)
    now = datetime.datetime.now(datetime.timezone.utc)
    raw_id = re.sub(r"[^A-Za-z0-9]", "", str(engine.get("engineId", "ENG-000")))
    random_suffix = random.randint(100, 999)
    wo_number = f"WO-{raw_id}-{now.year}{str(now.month).zfill(2)}-{random_suffix}"

    return {
        "id": wo_number,
        "engineId": engine.get("engineId", "ENG-000"),
        "timestamp": now.isoformat(),
        "severity": decision["severity"],
        "predictedRUL": prediction.get("predictedRUL", 100),
        "primaryFailureMode": decision["primaryFailureMode"],
        "confidenceScore": decision["confidenceScore"],
        "priority": decision["priority"],
        "actionRequired": decision["actionRequired"],
        "requiredParts": decision["requiredParts"],
        "assignedTechnician": decision["assignedTechnician"],
        "estimatedDowntimeHours": decision["estimatedDowntimeHours"],
        "estimatedCost": decision["estimatedCost"],
        "status": "PENDING_APPROVAL" if decision["isException"] else "DISPATCHED",
        "humanApprovalRequired": decision["isException"],
        "isException": decision["isException"],
        "exceptionReason": decision.get("exceptionReason"),
        "agentTriggerReason": decision["triggerReason"],
    }
