import { ModelVersion, RetrainingLog } from '../types/fleet';

export const INITIAL_MODEL_VERSIONS: ModelVersion[] = [
  {
    version: 'v1.2.0',
    modelFamily: 'Gradient Boosted Trees',
    status: 'Production',
    trainedAt: '2026-10-18T14:32:00Z',
    rmse: 14.82,
    mae: 11.24,
    r2: 0.884,
    nasaScore: 486.2,
    driftStatus: 'Stable',
    hyperparameters: {
      max_depth: 6,
      n_estimators: 150,
      learning_rate: 0.05,
      subsample: 0.85,
    },
  },
  {
    version: 'v1.1.0',
    modelFamily: 'Random Forest Regressor',
    status: 'Challenger',
    trainedAt: '2026-10-10T09:15:00Z',
    rmse: 16.14,
    mae: 12.45,
    r2: 0.862,
    nasaScore: 592.8,
    driftStatus: 'Stable',
    hyperparameters: {
      n_estimators: 100,
      max_features: 'sqrt',
      min_samples_leaf: 4,
    },
  },
  {
    version: 'v1.0.0',
    modelFamily: 'Linear ElasticNet',
    status: 'Archived',
    trainedAt: '2026-09-28T11:00:00Z',
    rmse: 22.40,
    mae: 17.65,
    r2: 0.735,
    nasaScore: 1142.5,
    driftStatus: 'Retraining Recommended',
    hyperparameters: {
      alpha: 0.1,
      l1_ratio: 0.5,
    },
  },
];

export const INITIAL_RETRAINING_LOGS: RetrainingLog[] = [
  {
    runId: 'RUN-20261018-01',
    timestamp: '2026-10-18T14:32:00Z',
    triggeredBy: 'Weekly Automated Telemetry Batch Ingestion',
    dataPointsIngested: 24800,
    previousRMSE: 16.14,
    newRMSE: 14.82,
    deltaPercent: -8.18,
    status: 'SUCCESS',
    artifactsSaved: ['model_artifact_v1.2.0.joblib', 'feature_scaler.pkl', 'drift_baseline.json'],
  },
  {
    runId: 'RUN-20261010-01',
    timestamp: '2026-10-10T09:15:00Z',
    triggeredBy: 'Rolling Window Feature Expansion (15 cyc)',
    dataPointsIngested: 18500,
    previousRMSE: 22.40,
    newRMSE: 16.14,
    deltaPercent: -27.95,
    status: 'SUCCESS',
    artifactsSaved: ['model_artifact_v1.1.0.joblib', 'metadata.json'],
  },
];

export interface DriftMetric {
  feature: string;
  psiScore: number;
  status: 'In-Bounds' | 'Moderate Shift' | 'Severe Drift';
  pVal: number;
}

export function computeDataDrift(): DriftMetric[] {
  return [
    { feature: 'Vibration (mm/s RMS)', psiScore: 0.042, status: 'In-Bounds', pVal: 0.82 },
    { feature: 'Temperature (°C)', psiScore: 0.065, status: 'In-Bounds', pVal: 0.74 },
    { feature: 'Motor Current (Amps)', psiScore: 0.128, status: 'Moderate Shift', pVal: 0.06 },
    { feature: 'Discharge Pressure (PSI)', psiScore: 0.038, status: 'In-Bounds', pVal: 0.89 },
    { feature: 'Rotational Speed (RPM)', psiScore: 0.051, status: 'In-Bounds', pVal: 0.79 },
  ];
}
