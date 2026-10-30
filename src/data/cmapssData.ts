import { EngineData, MachineFleetType, SensorReading } from '../types/fleet';
import truckImg from '../assets/images/heavy_haul_truck_1792683000517.jpg';
import busImg from '../assets/images/transit_city_bus_1792683001012.jpg';
import compressorImg from '../assets/images/industrial_compressor_1792683001945.jpg';
import turbofanImg from '../assets/images/turbofan_engine_1792683001707.jpg';

export function getMachineAssetImage(fleetType: MachineFleetType): string {
  switch (fleetType) {
    case 'Heavy Haul Truck':
      return truckImg;
    case 'City Transit Bus':
      return busImg;
    case 'Industrial Compressor':
      return compressorImg;
    case 'Turbofan Machine':
      return turbofanImg;
    default:
      return truckImg;
  }
}

/**
 * Generate physics-based run-to-failure continuous sensor stream for connected machines
 * Sensors modeled: Vibration, Temperature, Motor Current, Pressure, RPM
 */
export function generateMachineRun(
  machineId: string,
  totalLifetimeCycles: number,
  currentCycle: number,
  fleetType: MachineFleetType,
  modelDesignation: string,
  opCondition = 'Continuous Full-Load Standard'
): EngineData {
  const history: SensorReading[] = [];
  const safeCycle = Math.min(currentCycle, totalLifetimeCycles);

  // Degradation onset typically begins around 40-45% of total operating life
  const onsetCycle = Math.floor(totalLifetimeCycles * 0.42);

  for (let c = 1; c <= safeCycle; c++) {
    const isDegrading = c > onsetCycle;
    const degProgress = isDegrading ? (c - onsetCycle) / (totalLifetimeCycles - onsetCycle) : 0;
    // Non-linear exponential wear acceleration
    const wearFactor = Math.pow(degProgress, 1.85);

    const noise = () => (Math.random() - 0.5) * 0.3;
    const transientJitter = Math.random() > 0.96 ? (Math.random() - 0.5) * 1.8 : 0;

    // 1. Vibration (mm/s RMS): 1.4 baseline -> rises sharply to 7.8 mm/s before breakdown
    const vibration = Number((1.42 + wearFactor * 6.1 + noise() * 0.25 + (degProgress > 0.7 ? Math.abs(transientJitter) : 0)).toFixed(2));

    // 2. Temperature (°C): 76.5 °C baseline -> climbs to 134.8 °C due to friction & thermodynamic losses
    const temperature = Number((76.5 + wearFactor * 54.0 + noise() * 1.2).toFixed(1));

    // 3. Motor Current (Amps A): 42.0 A baseline -> motor pulls 74.2 A to maintain output against mechanical resistance
    const motorCurrent = Number((42.0 + wearFactor * 29.5 + noise() * 0.8).toFixed(1));

    // 4. Pressure (PSI): 148.0 PSI baseline -> drops to 112.5 PSI as internal clearance and seals erode
    const pressure = Number((148.0 - wearFactor * 32.5 + noise() * 0.7).toFixed(1));

    // 5. RPM: 2400 RPM nominal -> rotational speed fluctuates and slips to 2260 RPM with instability
    const rpm = Number((2400 - wearFactor * 125 + noise() * 8.0 + transientJitter * 10).toFixed(0));

    // C-MAPSS compatible sensor mappings
    const s3_T30 = Number((1585.5 + wearFactor * 26.5 + noise() * 1.2).toFixed(2));
    const s4_T50 = Number((1402.1 + wearFactor * 34.0 + noise() * 1.5).toFixed(2));
    const s11_Ps30 = Number((47.45 - wearFactor * 0.82 + noise() * 0.05).toFixed(3));
    const s15_BPR = Number((8.412 + wearFactor * 0.145 + noise() * 0.015).toFixed(4));

    history.push({
      cycle: c,
      vibration,
      temperature,
      motorCurrent,
      pressure,
      rpm,
      s2_T24: Number((642.3 + wearFactor * 3.8).toFixed(2)),
      s3_T30,
      s4_T50,
      s7_P30: Number((553.8 - wearFactor * 5.2).toFixed(2)),
      s8_Nf: rpm,
      s9_Nc: Number((9052.0 + wearFactor * 38.0).toFixed(2)),
      s11_Ps30,
      s12_phi: Number((521.8 + wearFactor * 4.6).toFixed(2)),
      s13_NRf: rpm,
      s14_NRc: Number((8135.0 + wearFactor * 24.0).toFixed(2)),
      s15_BPR,
    });
  }

  const trueRUL = Math.max(0, totalLifetimeCycles - safeCycle);
  const predVariance = Math.sin(safeCycle * 0.3) * 3;
  const predictedRUL = Math.max(0, Math.round(trueRUL + predVariance));

  // Health Score from 100% down to 0%
  const healthScore = Math.max(0, Math.min(100, Math.round((1 - safeCycle / totalLifetimeCycles) * 100)));

  // Multi-sensor composite anomaly score (0.0 to 1.0)
  const rawDeg = safeCycle > onsetCycle ? (safeCycle - onsetCycle) / (totalLifetimeCycles - onsetCycle) : 0.04;
  const anomalyScore = Number(Math.min(0.99, Math.max(0.02, Math.pow(rawDeg, 1.45) + (Math.random() * 0.04))).toFixed(3));

  let status: EngineData['status'] = 'Healthy';
  if (predictedRUL < 20 || anomalyScore > 0.82) {
    status = 'Critical';
  } else if (predictedRUL < 48 || anomalyScore > 0.65) {
    status = 'Maintenance Required';
  } else if (predictedRUL < 85 || anomalyScore > 0.38) {
    status = 'Degrading';
  }

  return {
    engineId: machineId,
    fleetType,
    modelDesignation,
    currentCycle: safeCycle,
    maxHistoricalCycle: totalLifetimeCycles,
    trueRUL,
    predictedRUL,
    healthScore,
    anomalyScore,
    status,
    history,
    operatingCondition: opCondition,
    subsystemDegradation: {
      compressorHPC: Math.min(100, Math.round(Math.pow(rawDeg, 1.2) * 100)),
      turbineLPT: Math.min(100, Math.round(Math.pow(rawDeg, 1.5) * 92)),
      bearingsVibration: Math.min(100, Math.round(Math.pow(rawDeg, 2.0) * 98)),
      combustionThermal: Math.min(100, Math.round(Math.pow(rawDeg, 1.3) * 88)),
    },
    image: getMachineAssetImage(fleetType),
    assignedDepot: machineId.startsWith('TRK') ? 'Midwest Logistics Hub (Bay 4)' :
                   machineId.startsWith('BUS') ? 'Metro Transit Depot Central' :
                   machineId.startsWith('CMP') ? 'Petrochemical Refinery Sector 7' : 'Skyway Fleet Hangar B',
    operatingHours: safeCycle * 14 + 120,
  };
}

export function initializeFleet(): EngineData[] {
  return [
    generateMachineRun('TRK-101', 220, 198, 'Heavy Haul Truck', 'Freightliner Cascadia DD16', 'Highway Haul (Vibration & Current Spike)'),
    generateMachineRun('BUS-204', 195, 162, 'City Transit Bus', 'Proterra ZX5 Urban Transit', 'City Stop-and-Go (Thermal Elevation)'),
    generateMachineRun('CMP-302', 240, 140, 'Industrial Compressor', 'Atlas Copco GA-160 VSD', 'Petrochemical Gas Line (Pressure Loss)'),
    generateMachineRun('TRB-408', 210, 68, 'Turbofan Machine', 'CFM International LEAP-1B', 'High-Altitude Cruise (Healthy Envelope)'),
    generateMachineRun('TRK-105', 255, 34, 'Heavy Haul Truck', 'Volvo VNL 860 Heavy Haul', 'Nominal New Unit Run'),
    generateMachineRun('CMP-309', 180, 168, 'Industrial Compressor', 'Ingersoll Rand Centac C800', 'High Duty Heavy Cycle (Bearing Distress)'),
  ];
}
