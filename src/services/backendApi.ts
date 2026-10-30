/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EngineData, ModelVersion, RetrainingLog, SensorReading, WorkOrder, EngineeredFeature } from '../types/fleet';
import { ModelPredictionResult } from './mlModels';

export interface BackendStatus {
  status: string;
  backend: string;
  pythonVersion: string;
  platform: string;
  uptimeSeconds: number;
  totalRequestsHandled: number;
  activeEngines: string[];
}

/**
 * Fetch live status from Python backend
 */
export async function fetchBackendStatus(): Promise<BackendStatus | null> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to reach Python backend status:', err);
    return null;
  }
}

/**
 * Call Python ML Engine for Remaining Useful Life (RUL) inference
 */
export async function callPythonPredictRUL(
  readings: SensorReading[],
  modelId: string = 'gbdt'
): Promise<ModelPredictionResult | null> {
  try {
    const res = await fetch('/api/ml/predict-rul', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings, modelId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Python predict-rul fallback:', err);
    return null;
  }
}

/**
 * Call Python Feature Engineering Engine for rolling window statistics
 */
export async function callPythonRollingFeatures(
  readings: SensorReading[],
  windowSize: number = 15
): Promise<EngineeredFeature[] | null> {
  try {
    const res = await fetch('/api/data/rolling-features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings, windowSize }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.features || null;
  } catch (err) {
    console.warn('Python rolling-features fallback:', err);
    return null;
  }
}

/**
 * Call Python Data Engineering Engine for 3-point median spike filtering
 */
export async function callPythonCleanStream(
  readings: SensorReading[],
  config?: any
): Promise<SensorReading[] | null> {
  try {
    const res = await fetch('/api/data/clean-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings, config }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.cleaned || null;
  } catch (err) {
    console.warn('Python clean-stream fallback:', err);
    return null;
  }
}

/**
 * Call Python Triage Engine to evaluate and generate operational Work Orders
 */
export async function callPythonGenerateWorkOrder(
  engine: EngineData,
  prediction: ModelPredictionResult,
  config?: any
): Promise<WorkOrder | null> {
  try {
    const res = await fetch('/api/triage/generate-work-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine, prediction, config }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.workOrder || null;
  } catch (err) {
    console.warn('Python generate-work-order fallback:', err);
    return null;
  }
}

/**
 * Call Python MLOps Engine to trigger model retraining pipeline
 */
export async function callPythonRetrainPipeline(
  triggerReason: string
): Promise<{ newVersion: ModelVersion; retrainingLog: RetrainingLog; models: ModelVersion[]; logs: RetrainingLog[] } | null> {
  try {
    const res = await fetch('/api/mlops/retrain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerReason }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Python retrain fallback:', err);
    return null;
  }
}

/**
 * Call Python MLOps Engine to retrieve model registry and drift metrics
 */
export async function callPythonFetchModels(): Promise<{
  models: ModelVersion[];
  logs: RetrainingLog[];
  driftMetrics: any[];
} | null> {
  try {
    const res = await fetch('/api/mlops/models');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Python fetch models fallback:', err);
    return null;
  }
}
