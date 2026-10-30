"""
NASA C-MAPSS Turbofan & Connected Fleet Telemetry Generator in Python
Generates continuous physics-based run-to-failure degradation sensor streams
across vibration, temperature, motor current, pressure, and RPM.
"""

import math
import random
from typing import List, Dict, Any


def generate_machine_run(
    machine_id: str,
    total_lifetime_cycles: int,
    current_cycle: int,
    fleet_type: str,
    model_designation: str,
    op_condition: str = "Continuous Full-Load Standard",
) -> Dict[str, Any]:
    history = []
    safe_cycle = min(current_cycle, total_lifetime_cycles)
    onset_cycle = int(total_lifetime_cycles * 0.42)

    # Use deterministic seed based on machine_id and cycle for reproducible degradation
    for c in range(1, safe_cycle + 1):
        is_degrading = c > onset_cycle
        deg_progress = (c - onset_cycle) / float(total_lifetime_cycles - onset_cycle) if is_degrading else 0.0
        wear_factor = math.pow(deg_progress, 1.85)

        noise = (math.sin(c * 1.7) * 0.15) + (math.cos(c * 0.8) * 0.1)
        transient_jitter = 1.2 if (c % 17 == 0 and deg_progress > 0.6) else 0.0

        # 1. Vibration (mm/s RMS): 1.4 baseline -> rises sharply to 7.8 mm/s before breakdown
        vibration = round(1.42 + wear_factor * 6.1 + noise * 0.25 + transient_jitter, 2)

        # 2. Temperature (°C): 76.5 °C baseline -> climbs to 134.8 °C
        temperature = round(76.5 + wear_factor * 54.0 + noise * 1.2, 1)

        # 3. Motor Current (Amps): 42.0 A baseline -> motor pulls 74.2 A
        motor_current = round(42.0 + wear_factor * 29.5 + noise * 0.8, 1)

        # 4. Pressure (PSI): 148.0 PSI baseline -> drops to 112.5 PSI
        pressure = round(148.0 - wear_factor * 32.5 + noise * 0.7, 1)

        # 5. RPM: 2400 RPM nominal -> rotational speed slips to 2260 RPM
        rpm = int(round(2400 - wear_factor * 125 + noise * 8.0 - transient_jitter * 8))

        history.append({
            "cycle": c,
            "vibration": vibration,
            "temperature": temperature,
            "motorCurrent": motor_current,
            "pressure": pressure,
            "rpm": rpm,
            "s3_T30": round(1585.5 + wear_factor * 26.5 + noise * 1.2, 2),
            "s4_T50": round(1402.1 + wear_factor * 34.0 + noise * 1.5, 2),
            "s11_Ps30": round(47.45 - wear_factor * 0.82 + noise * 0.05, 3),
            "s15_BPR": round(8.412 + wear_factor * 0.145 + noise * 0.015, 4),
        })

    true_rul = max(0, total_lifetime_cycles - safe_cycle)
    pred_variance = math.sin(safe_cycle * 0.3) * 3
    predicted_rul = max(0, int(round(true_rul + pred_variance)))

    health_score = max(0, min(100, int(round((1 - safe_cycle / float(total_lifetime_cycles)) * 100))))

    raw_deg = (safe_cycle - onset_cycle) / float(total_lifetime_cycles - onset_cycle) if safe_cycle > onset_cycle else 0.04
    anomaly_score = round(min(0.99, max(0.02, math.pow(raw_deg, 1.45) + 0.02)), 3)

    status = "Healthy"
    if predicted_rul < 20 or anomaly_score > 0.82:
        status = "Critical"
    elif predicted_rul < 48 or anomaly_score > 0.65:
        status = "Maintenance Required"
    elif predicted_rul < 85 or anomaly_score > 0.38:
        status = "Degrading"

    depot = "Skyway Fleet Hangar B"
    if machine_id.startswith("TRK"):
        depot = "Midwest Logistics Hub (Bay 4)"
    elif machine_id.startswith("BUS"):
        depot = "Metro Transit Depot Central"
    elif machine_id.startswith("CMP"):
        depot = "Petrochemical Refinery Sector 7"

    return {
        "engineId": machine_id,
        "fleetType": fleet_type,
        "modelDesignation": model_designation,
        "currentCycle": safe_cycle,
        "maxHistoricalCycle": total_lifetime_cycles,
        "trueRUL": true_rul,
        "predictedRUL": predicted_rul,
        "healthScore": health_score,
        "anomalyScore": anomaly_score,
        "status": status,
        "history": history,
        "operatingCondition": op_condition,
        "subsystemDegradation": {
            "compressorHPC": min(100, int(round(math.pow(raw_deg, 1.2) * 100))),
            "turbineLPT": min(100, int(round(math.pow(raw_deg, 1.5) * 92))),
            "bearingsVibration": min(100, int(round(math.pow(raw_deg, 2.0) * 98))),
            "combustionThermal": min(100, int(round(math.pow(raw_deg, 1.3) * 88))),
        },
        "assignedDepot": depot,
        "operatingHours": safe_cycle * 14 + 120,
    }


def initialize_fleet() -> List[Dict[str, Any]]:
    return [
        generate_machine_run("TRK-101", 220, 198, "Heavy Haul Truck", "Freightliner Cascadia DD16", "Highway Haul (Vibration & Current Spike)"),
        generate_machine_run("BUS-204", 195, 162, "City Transit Bus", "Proterra ZX5 Urban Transit", "City Stop-and-Go (Thermal Elevation)"),
        generate_machine_run("CMP-302", 240, 140, "Industrial Compressor", "Atlas Copco GA-160 VSD", "Petrochemical Gas Line (Pressure Loss)"),
        generate_machine_run("TRB-408", 210, 68, "Turbofan Machine", "CFM International LEAP-1B", "High-Altitude Cruise (Healthy Envelope)"),
        generate_machine_run("TRK-105", 255, 34, "Heavy Haul Truck", "Volvo VNL 860 Heavy Haul", "Nominal New Unit Run"),
        generate_machine_run("CMP-309", 180, 168, "Industrial Compressor", "Ingersoll Rand Centac C800", "High Duty Heavy Cycle (Bearing Distress)"),
    ]
