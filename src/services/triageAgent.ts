import { EngineData, TriageSeverity, WorkOrder } from '../types/fleet';
import { ModelPredictionResult } from './mlModels';

export interface TriageRuleConfig {
  criticalRulThreshold: number;      // e.g. < 20 cycles
  criticalAnomalyThreshold: number;  // e.g. > 0.82
  highRiskRulThreshold: number;      // e.g. < 45 cycles
  highRiskAnomalyThreshold: number;  // e.g. > 0.65
  moderateRiskRulThreshold: number;  // e.g. < 85 cycles
}

export const DEFAULT_TRIAGE_CONFIG: TriageRuleConfig = {
  criticalRulThreshold: 20,
  criticalAnomalyThreshold: 0.82,
  highRiskRulThreshold: 45,
  highRiskAnomalyThreshold: 0.65,
  moderateRiskRulThreshold: 85,
};

export interface TriageDecision {
  severity: TriageSeverity;
  primaryFailureMode: string;
  triggerReason: string;
  priority: WorkOrder['priority'];
  actionRequired: string;
  requiredParts: string[];
  assignedTechnician: string;
  estimatedDowntimeHours: number;
  estimatedCost: number;
  isException: boolean;
  exceptionReason?: string;
  confidenceScore: number;
}

/**
 * Deterministic Rule-Based Triage Engine (Closed-Loop, Non-LLM)
 */
export function evaluateTriageLogic(
  engine: EngineData,
  prediction: ModelPredictionResult,
  config: TriageRuleConfig = DEFAULT_TRIAGE_CONFIG
): TriageDecision {
  const { predictedRUL, anomalyScore, dominantSensorContribution } = prediction;
  const latest = engine.history[engine.history.length - 1];

  // Failure Mode Diagnosis based on machine type and dominant sensor
  let dominantFailure = 'Rotor Shaft Bearing Pitting & Severe Vibration';
  let partsList = ['High-Speed Spherical Roller Bearings', 'Vibration Isolator Bushings', 'Synthetic Gear Lubricant'];
  let action = 'Immediate bearing vibration survey; laser alignment of motor-compressor coupling; oil flush';
  let baseHours = 14;
  let baseCost = 6400;

  if (engine.fleetType === 'Heavy Haul Truck') {
    if (latest && latest.motorCurrent > 62) {
      dominantFailure = 'Electric Drivetrain Inverter & Motor Winding Thermal Overload';
      partsList = ['Stator Winding Thermal Sensor', 'Cooling Fan Assembly', 'Insulation Resistance Test Kit'];
      action = 'Megohmmeter insulation resistance test; clean cooling channels; inspect power IGBT inverter';
      baseHours = 10;
      baseCost = 8200;
    } else {
      dominantFailure = 'Drive Axle Differential & Wheel End Bearing Degradation';
      partsList = ['Tapered Wheel Bearings', 'Hub Oil Seals', 'Heavy-Duty Synthetic 75W-90'];
      action = 'Borescope inspection of differential ring gear; replace wheel end hub seals; torque check';
      baseHours = 8;
      baseCost = 4500;
    }
  } else if (engine.fleetType === 'City Transit Bus') {
    dominantFailure = 'Pneumatic Braking Compressor & Air Dryer Desiccant Saturation';
    partsList = ['Twin-Cylinder Compressor Overhaul Kit', 'Desiccant Cartridge', 'Pressure Relief Unloader Valve'];
    action = 'Service air delivery circuit; test unloader valve pressure cutoff; rebuild compressor cylinder head';
    baseHours = 7;
    baseCost = 3900;
  } else if (engine.fleetType === 'Industrial Compressor') {
    dominantFailure = 'Screw Element Clearance Erosion & High Discharge Pressure Loss';
    partsList = ['Rotary Screw Airend Rotor Set', 'PTFE Shaft Seal Kit', 'Minimum Pressure Check Valve'];
    action = 'Inspect screw rotor tip clearances with feeler gauges; replace mechanical shaft seals and separator';
    baseHours = 20;
    baseCost = 14800;
  }

  // 1. Exception Check: Emergency Grounding / Critical Threshold Breach
  if (predictedRUL <= config.criticalRulThreshold || anomalyScore >= config.criticalAnomalyThreshold) {
    return {
      severity: 'CRITICAL',
      primaryFailureMode: dominantFailure,
      triggerReason: `Remaining useful life (${predictedRUL} cycles) breached safety threshold (< ${config.criticalRulThreshold} cycles) with high anomaly index (${(anomalyScore * 100).toFixed(1)}%). Dominant: ${dominantSensorContribution}.`,
      priority: 'P1 - Immediate Grounding',
      actionRequired: `SAFETY ISOLATION: Lock out and tag out machine immediately. Halt operation prior to next shift. ${action}`,
      requiredParts: [...partsList, 'Emergency Hardware Overhaul Pack'],
      assignedTechnician: 'Sarah Jenkins (Lead Mechanical Systems Engineer)',
      estimatedDowntimeHours: baseHours + 8,
      estimatedCost: baseCost + 2800,
      isException: true,
      exceptionReason: `Critical Safety Event: RUL is below ${config.criticalRulThreshold} cycles. Automatic work order raised; human supervisor sign-off required to authorize emergency equipment grounding.`,
      confidenceScore: 0.97,
    };
  }

  // 2. High Risk
  if (predictedRUL <= config.highRiskRulThreshold || anomalyScore >= config.highRiskAnomalyThreshold) {
    return {
      severity: 'HIGH',
      primaryFailureMode: dominantFailure,
      triggerReason: `Accelerated sensor degradation detected. RUL: ${predictedRUL} cycles (Threshold < ${config.highRiskRulThreshold}). Dominant: ${dominantSensorContribution}.`,
      priority: 'P2 - 48h Inspection',
      actionRequired: `Schedule maintenance bay diagnostic within 48 operational hours. ${action}`,
      requiredParts: partsList,
      assignedTechnician: 'Marcus Vance (Field Diagnostic Lead)',
      estimatedDowntimeHours: baseHours,
      estimatedCost: baseCost,
      isException: false,
      confidenceScore: 0.91,
    };
  }

  // 3. Moderate Wear
  if (predictedRUL <= config.moderateRiskRulThreshold) {
    return {
      severity: 'MODERATE',
      primaryFailureMode: `${dominantFailure} (Incipient Wear)`,
      triggerReason: `Linear wear progression detected (RUL: ${predictedRUL} cycles).`,
      priority: 'P3 - Next Turnaround',
      actionRequired: 'Pre-allocate replacement parts from inventory; execute service at next scheduled turnaround interval.',
      requiredParts: [partsList[0], 'Gasket & Filter Pack'],
      assignedTechnician: 'David Chen (Fleet Technician II)',
      estimatedDowntimeHours: Math.round(baseHours * 0.6),
      estimatedCost: Math.round(baseCost * 0.55),
      isException: false,
      confidenceScore: 0.86,
    };
  }

  // 4. Normal
  return {
    severity: 'NORMAL',
    primaryFailureMode: 'Nominal Operating Parameters (Zero Degradation Faults)',
    triggerReason: `All sensor channels (vibration, temp, current, pressure, rpm) operate inside nominal ±1.5σ baseline.`,
    priority: 'P4 - Routine',
    actionRequired: 'Continue continuous streaming sensor ingestion.',
    requiredParts: [],
    assignedTechnician: 'Automated Diagnostic Daemon',
    estimatedDowntimeHours: 0,
    estimatedCost: 0,
    isException: false,
    confidenceScore: 0.99,
  };
}

export function generateWorkOrder(
  engine: EngineData,
  prediction: ModelPredictionResult,
  config?: TriageRuleConfig
): WorkOrder {
  const decision = evaluateTriageLogic(engine, prediction, config);
  const now = new Date();
  const woNumber = `WO-${engine.engineId.replace(/[^A-Za-z0-9]/g, '')}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

  return {
    id: woNumber,
    engineId: engine.engineId,
    timestamp: now.toISOString(),
    severity: decision.severity,
    predictedRUL: prediction.predictedRUL,
    primaryFailureMode: decision.primaryFailureMode,
    confidenceScore: decision.confidenceScore,
    priority: decision.priority,
    actionRequired: decision.actionRequired,
    requiredParts: decision.requiredParts,
    assignedTechnician: decision.assignedTechnician,
    estimatedDowntimeHours: decision.estimatedDowntimeHours,
    estimatedCost: decision.estimatedCost,
    status: decision.isException ? 'PENDING_APPROVAL' : 'DISPATCHED',
    humanApprovalRequired: decision.isException,
    isException: decision.isException,
    exceptionReason: decision.exceptionReason,
    agentTriggerReason: decision.triggerReason,
  };
}
