import { EngineeredFeature, SensorReading } from '../types/fleet';

export interface DataCleaningConfig {
  enableOutlierFilter: boolean;
  spikeThresholdZ: number;
  imputeMissing: 'forward_fill' | 'linear_interpolation' | 'median';
  windowSize: number;
}

export const DEFAULT_CLEANING_CONFIG: DataCleaningConfig = {
  enableOutlierFilter: true,
  spikeThresholdZ: 2.8,
  imputeMissing: 'forward_fill',
  windowSize: 15,
};

/**
 * Clean raw sensor readings by removing unphysical spikes and applying smoothing filter
 */
export function cleanSensorStream(
  rawReadings: SensorReading[],
  config: DataCleaningConfig = DEFAULT_CLEANING_CONFIG
): SensorReading[] {
  if (rawReadings.length === 0) return [];

  const cleaned: SensorReading[] = [];
  const sensorKeys: (keyof SensorReading)[] = [
    'vibration', 'temperature', 'motorCurrent', 'pressure', 'rpm',
    's3_T30', 's4_T50', 's11_Ps30', 's15_BPR'
  ];

  for (let i = 0; i < rawReadings.length; i++) {
    const current = { ...rawReadings[i] };

    if (config.enableOutlierFilter && i >= 3) {
      // 3-point median filter to suppress impulsive spikes
      for (const key of sensorKeys) {
        const valPrev = Number(rawReadings[i - 1][key]);
        const valCurr = Number(rawReadings[i][key]);
        const valNext = i + 1 < rawReadings.length ? Number(rawReadings[i + 1][key]) : valCurr;

        // Sort 3 samples for median
        const sorted = [valPrev, valCurr, valNext].sort((a, b) => a - b);
        const median = sorted[1];
        
        // If current value deviates wildly from local median
        const diff = Math.abs(valCurr - median);
        const typicalScale = Math.abs(median) * 0.05 + 0.1;

        if (diff > typicalScale * config.spikeThresholdZ) {
          (current[key] as number) = Number(median.toFixed(2));
        }
      }
    }

    cleaned.push(current);
  }

  return cleaned;
}

/**
 * Calculate rolling statistics for core streaming sensors (vibration, temp, current, pressure, rpm)
 */
export function calculateRollingFeatures(
  readings: SensorReading[],
  windowSize = 15
): EngineeredFeature[] {
  if (readings.length === 0) return [];

  const recent = readings.slice(-windowSize);
  const len = recent.length;

  const keySensors: { key: keyof SensorReading; label: string; unit: string; importance: number }[] = [
    { key: 'vibration', label: 'Mechanical Vibration', unit: 'mm/s', importance: 0.32 },
    { key: 'temperature', label: 'Bearing & Housing Temp', unit: '°C', importance: 0.26 },
    { key: 'motorCurrent', label: 'Motor Current Draw', unit: 'Amps', importance: 0.18 },
    { key: 'pressure', label: 'Discharge Fluid Pressure', unit: 'PSI', importance: 0.14 },
    { key: 'rpm', label: 'Rotational Velocity', unit: 'RPM', importance: 0.10 },
  ];

  const features: EngineeredFeature[] = [];

  for (const item of keySensors) {
    const values = recent.map((r) => Number(r[item.key]) || 0);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / len;
    
    // Variance & Std
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (len || 1);
    const std = Math.sqrt(variance);

    // Trend Velocity (last - first in window)
    const trend = values[len - 1] - values[0];

    // Exponential Moving Average (EMA) with alpha = 2 / (N + 1)
    const alpha = 2 / (windowSize + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }

    // Z-Score relative to baseline
    const baseline = readings[0] ? Number(readings[0][item.key]) : mean;
    const zScore = std > 0.0001 ? (values[len - 1] - baseline) / (std * 2.5) : 0;

    features.push(
      {
        featureName: `${item.label} (Rolling Mean ${windowSize} cyc)`,
        rawSensor: `${String(item.key)} [${item.unit}]`,
        category: 'Rolling Mean',
        currentValue: Number(mean.toFixed(2)),
        zScore: Number(zScore.toFixed(2)),
        importance: item.importance,
      },
      {
        featureName: `${item.label} (Rolling Variance/Std)`,
        rawSensor: `${String(item.key)} [${item.unit}]`,
        category: 'Rolling Std',
        currentValue: Number(std.toFixed(3)),
        zScore: Number((std / 0.5).toFixed(2)),
        importance: Number((item.importance * 0.75).toFixed(2)),
      },
      {
        featureName: `${item.label} (Trend Velocity Rate)`,
        rawSensor: `${String(item.key)} [${item.unit}]`,
        category: 'Trend Velocity',
        currentValue: Number(trend.toFixed(3)),
        zScore: Number((trend / (mean * 0.02 || 1)).toFixed(2)),
        importance: Number((item.importance * 0.85).toFixed(2)),
      },
      {
        featureName: `${item.label} (EMA-Filtered Envelope)`,
        rawSensor: `${String(item.key)} [${item.unit}]`,
        category: 'EMA',
        currentValue: Number(ema.toFixed(2)),
        zScore: Number(((ema - baseline) / (mean * 0.03 || 1)).toFixed(2)),
        importance: Number((item.importance * 0.5).toFixed(2)),
      }
    );
  }

  return features;
}

/**
 * Monotonic Sensor Correlation against machine degradation
 */
export interface SensorCorrelation {
  sensor: string;
  name: string;
  correlation: number;
  direction: 'Degrades Upward' | 'Degrades Downward';
  description: string;
}

export function getSensorCorrelations(): SensorCorrelation[] {
  return [
    {
      sensor: 'vibration',
      name: 'Vibration (mm/s RMS)',
      correlation: 0.93,
      direction: 'Degrades Upward',
      description: 'Exponential mechanical imbalance, bearing raceway pitting, and shaft eccentricity as wear progresses.',
    },
    {
      sensor: 'temperature',
      name: 'Temperature (°C)',
      correlation: 0.88,
      direction: 'Degrades Upward',
      description: 'Elevated frictional heating and aerodynamic drag in worn bearings, compressor stages, and bushings.',
    },
    {
      sensor: 'motorCurrent',
      name: 'Motor Current (Amps)',
      correlation: 0.85,
      direction: 'Degrades Upward',
      description: 'Motor pulls higher electrical current to overcome increased mechanical resistance and maintain torque.',
    },
    {
      sensor: 'pressure',
      name: 'Fluid / Discharge Pressure (PSI)',
      correlation: -0.83,
      direction: 'Degrades Downward',
      description: 'Seal degradation and impeller/piston clearance expansion cause progressive discharge pressure loss.',
    },
    {
      sensor: 'rpm',
      name: 'Rotational Speed (RPM)',
      correlation: -0.76,
      direction: 'Degrades Downward',
      description: 'Speed instability and slippage under full mechanical load as bearings and shafts degrade.',
    },
  ];
}
