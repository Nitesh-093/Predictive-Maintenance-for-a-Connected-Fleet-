export type MachineFleetType = 'Heavy Haul Truck' | 'City Transit Bus' | 'Industrial Compressor' | 'Turbofan Machine';

export interface SensorReading {
  cycle: number;
  timestamp?: string;
  // Core sensors explicitly defined in problem statement:
  vibration: number;     // Vibration (RMS in mm/s or g)
  temperature: number;   // Temperature (°C)
  motorCurrent: number;  // Motor Current (Amps A)
  pressure: number;      // Pressure (PSI)
  rpm: number;           // Rotational Speed (RPM)

  // C-MAPSS mapped channels
  s2_T24: number;
  s3_T30: number;
  s4_T50: number;
  s7_P30: number;
  s8_Nf: number;
  s9_Nc: number;
  s11_Ps30: number;
  s12_phi: number;
  s13_NRf: number;
  s14_NRc: number;
  s15_BPR: number;
  [key: string]: any;
}

export interface EngineData {
  engineId: string;
  fleetType: MachineFleetType;
  modelDesignation: string;
  currentCycle: number;
  maxHistoricalCycle: number;
  trueRUL: number;
  predictedRUL: number;
  healthScore: number; // 0 to 100%
  anomalyScore: number; // 0 to 1
  status: 'Healthy' | 'Degrading' | 'Critical' | 'Maintenance Required';
  history: SensorReading[];
  operatingCondition: string;
  subsystemDegradation: {
    compressorHPC: number; // 0 - 100% wear
    turbineLPT: number;
    bearingsVibration: number;
    combustionThermal: number;
  };
  image?: string;
  assignedDepot?: string;
  operatingHours?: number;
}

export interface EngineeredFeature {
  featureName: string;
  rawSensor: string;
  category: 'Rolling Mean' | 'Rolling Std' | 'Trend Velocity' | 'EMA' | 'Normalized Delta';
  currentValue: number;
  zScore: number;
  importance: number;
}

export type TriageSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'NORMAL';

export interface WorkOrder {
  id: string;
  engineId: string;
  timestamp: string;
  severity: TriageSeverity;
  predictedRUL: number;
  primaryFailureMode: string;
  confidenceScore: number;
  priority: 'P1 - Immediate Grounding' | 'P2 - 48h Inspection' | 'P3 - Next Turnaround' | 'P4 - Routine';
  actionRequired: string;
  requiredParts: string[];
  assignedTechnician: string;
  estimatedDowntimeHours: number;
  estimatedCost: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED';
  humanApprovalRequired: boolean;
  approvalNotes?: string;
  agentTriggerReason: string;
  isException: boolean;
  exceptionReason?: string;
}

export interface ModelMetrics {
  modelName: string;
  rmse: number;
  mae: number;
  r2: number;
  nasaScore: number;
  latencyMs: number;
  trainingSamples: number;
  featuresCount: number;
}

export interface ModelVersion {
  version: string;
  modelFamily: 'Gradient Boosted Trees' | 'Random Forest Regressor' | 'Linear ElasticNet' | 'Temporal ConvNet' | string;
  status: 'Production' | 'Challenger' | 'Archived';
  trainedAt: string;
  rmse: number;
  mae: number;
  r2: number;
  nasaScore: number;
  driftStatus: 'Stable' | 'Minor Drift' | 'Retraining Recommended';
  hyperparameters: Record<string, string | number>;
}

export interface RetrainingLog {
  runId: string;
  timestamp: string;
  triggeredBy: string;
  dataPointsIngested: number;
  previousRMSE: number;
  newRMSE: number;
  deltaPercent: number;
  status: 'SUCCESS' | 'VALIDATING' | 'FAILED';
  artifactsSaved: string[];
}
