"""
Streaming Sensor Feature Engineering & Outlier Filtration Engine in Python
"""

import math
from typing import List, Dict, Any, Optional


def clean_sensor_stream(
    raw_readings: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Cleans raw sensor readings by suppressing impulsive spikes using a 3-point
    local median filter and bounded variance rejection.
    """
    if not raw_readings:
        return []

    cfg = config or {}
    enable_outlier_filter = cfg.get("enableOutlierFilter", True)
    spike_threshold_z = float(cfg.get("spikeThresholdZ", 2.8))

    cleaned = []
    sensor_keys = [
        "vibration", "temperature", "motorCurrent", "pressure", "rpm",
        "s3_T30", "s4_T50", "s11_Ps30", "s15_BPR"
    ]

    for i in range(len(raw_readings)):
        current = dict(raw_readings[i])

        if enable_outlier_filter and i >= 3:
            for key in sensor_keys:
                if key not in raw_readings[i]:
                    continue
                try:
                    val_prev = float(raw_readings[i - 1].get(key, 0.0))
                    val_curr = float(raw_readings[i].get(key, 0.0))
                    val_next = float(raw_readings[i + 1].get(key, val_curr)) if (i + 1 < len(raw_readings)) else val_curr

                    # 3-point median
                    sorted_samples = sorted([val_prev, val_curr, val_next])
                    median = sorted_samples[1]

                    diff = abs(val_curr - median)
                    typical_scale = abs(median) * 0.05 + 0.1

                    if diff > typical_scale * spike_threshold_z:
                        current[key] = round(median, 2)
                except (ValueError, TypeError):
                    pass

        cleaned.append(current)

    return cleaned


def calculate_rolling_features(
    readings: List[Dict[str, Any]],
    window_size: int = 15,
) -> List[Dict[str, Any]]:
    """
    Calculates rolling statistics (Mean, Variance/Std, Trend Velocity, Exponential Moving Average,
    and Z-Score relative to baseline) for core streaming sensors.
    """
    if not readings:
        return []

    recent = readings[-window_size:]
    length = len(recent)

    key_sensors = [
        {"key": "vibration", "label": "Mechanical Vibration", "unit": "mm/s", "importance": 0.32},
        {"key": "temperature", "label": "Bearing & Housing Temp", "unit": "°C", "importance": 0.26},
        {"key": "motorCurrent", "label": "Motor Current Draw", "unit": "Amps", "importance": 0.18},
        {"key": "pressure", "label": "Discharge Fluid Pressure", "unit": "PSI", "importance": 0.14},
        {"key": "rpm", "label": "Rotational Velocity", "unit": "RPM", "importance": 0.10},
    ]

    features = []

    for item in key_sensors:
        k = item["key"]
        values = [float(r.get(k, 0.0)) for r in recent]
        mean_val = sum(values) / float(length) if length > 0 else 0.0

        # Variance & Std
        variance = sum((v - mean_val) ** 2 for v in values) / float(length or 1)
        std_val = math.sqrt(variance)

        # Trend velocity (delta across window)
        trend = values[-1] - values[0] if length > 0 else 0.0

        # Exponential Moving Average (EMA) with alpha = 2 / (N + 1)
        alpha = 2.0 / (window_size + 1.0)
        ema = values[0] if length > 0 else 0.0
        for i in range(1, len(values)):
            ema = alpha * values[i] + (1.0 - alpha) * ema

        # Z-Score relative to baseline
        baseline = float(readings[0].get(k, mean_val)) if readings else mean_val
        z_score = (values[-1] - baseline) / (std_val * 2.5) if std_val > 0.0001 else 0.0

        features.append({
            "featureName": f"{item['label']} (Rolling Mean {window_size} cyc)",
            "rawSensor": f"{k} [{item['unit']}]",
            "category": "Rolling Mean",
            "currentValue": round(mean_val, 2),
            "zScore": round(z_score, 2),
            "importance": item["importance"],
        })
        features.append({
            "featureName": f"{item['label']} (Rolling Variance/Std)",
            "rawSensor": f"{k} [{item['unit']}]",
            "category": "Rolling Std",
            "currentValue": round(std_val, 3),
            "zScore": round(std_val / 0.5, 2),
            "importance": round(item["importance"] * 0.75, 2),
        })
        features.append({
            "featureName": f"{item['label']} (Trend Velocity Rate)",
            "rawSensor": f"{k} [{item['unit']}]",
            "category": "Trend Velocity",
            "currentValue": round(trend, 3),
            "zScore": round(trend / (mean_val * 0.02 or 1.0), 2),
            "importance": round(item["importance"] * 0.85, 2),
        })
        features.append({
            "featureName": f"{item['label']} (EMA-Filtered Envelope)",
            "rawSensor": f"{k} [{item['unit']}]",
            "category": "EMA",
            "currentValue": round(ema, 2),
            "zScore": round((ema - baseline) / (mean_val * 0.03 or 1.0), 2),
            "importance": round(item["importance"] * 0.5, 2),
        })

    return features


def get_sensor_correlations() -> List[Dict[str, Any]]:
    """
    Sensor physical correlation against machine degradation curves.
    """
    return [
        {
            "sensor": "vibration",
            "name": "Vibration (mm/s RMS)",
            "correlation": 0.93,
            "direction": "Degrades Upward",
            "description": "Exponential mechanical imbalance, bearing raceway pitting, and shaft eccentricity as wear progresses.",
        },
        {
            "sensor": "temperature",
            "name": "Temperature (°C)",
            "correlation": 0.88,
            "direction": "Degrades Upward",
            "description": "Elevated frictional heating and aerodynamic drag in worn bearings, compressor stages, and bushings.",
        },
        {
            "sensor": "motorCurrent",
            "name": "Motor Current (Amps)",
            "correlation": 0.85,
            "direction": "Degrades Upward",
            "description": "Motor pulls higher electrical current to overcome increased mechanical resistance and maintain torque.",
        },
        {
            "sensor": "pressure",
            "name": "Fluid / Discharge Pressure (PSI)",
            "correlation": -0.83,
            "direction": "Degrades Downward",
            "description": "Seal degradation and impeller/piston clearance expansion cause progressive discharge pressure loss.",
        },
        {
            "sensor": "rpm",
            "name": "Rotational Speed (RPM)",
            "correlation": -0.76,
            "direction": "Degrades Downward",
            "description": "Speed instability and slippage under full mechanical load as bearings and shafts degrade.",
        },
    ]
