import React, { useState } from 'react';
import { 
  Activity, AlertTriangle, CheckCircle2, Wrench, 
  RotateCcw, Play, Pause, FastForward, Truck, Bus, Factory, Wind,
  ChevronRight, Filter, Search, ShieldAlert, Gauge, MapPin, Clock, ArrowUpRight
} from 'lucide-react';
import { EngineData } from '../types/fleet';
import { predictRUL } from '../services/mlModels';

interface FleetMonitorProps {
  fleet: EngineData[];
  selectedEngineId: string;
  onSelectEngine: (id: string) => void;
  onStepCycle: (engineId: string, stepCount: number) => void;
  onResetEngine: (engineId: string) => void;
  onTriggerTriage: (engine: EngineData) => void;
  isStreaming: boolean;
  setIsStreaming: (s: boolean) => void;
}

export const FleetMonitor: React.FC<FleetMonitorProps> = ({
  fleet,
  selectedEngineId,
  onSelectEngine,
  onStepCycle,
  onResetEngine,
  onTriggerTriage,
  isStreaming,
  setIsStreaming,
}) => {
  const [selectedSensorChart, setSelectedSensorChart] = useState<'vibration' | 'temperature' | 'motorCurrent' | 'pressure' | 'rpm'>('vibration');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const selectedEngine = fleet.find((e) => e.engineId === selectedEngineId) || fleet[0];
  const prediction = predictRUL(selectedEngine.history, 'gbdt');

  // The 5 core sensors from the brief
  const sensorDefinitions = {
    vibration: { 
      label: 'Vibration', 
      unit: 'mm/s', 
      nominal: 1.42, 
      warningThreshold: 4.5,
      criticalThreshold: 6.0,
      description: 'Bearing and mechanical vibration velocity'
    },
    temperature: { 
      label: 'Temperature', 
      unit: '°C', 
      nominal: 76.5, 
      warningThreshold: 105.0,
      criticalThreshold: 120.0,
      description: 'Drivetrain and bearing housing thermal state'
    },
    motorCurrent: { 
      label: 'Motor Current', 
      unit: 'A', 
      nominal: 42.0, 
      warningThreshold: 58.0,
      criticalThreshold: 68.0,
      description: 'Electrical current draw under mechanical load'
    },
    pressure: { 
      label: 'Fluid Pressure', 
      unit: 'PSI', 
      nominal: 148.0, 
      warningThreshold: 125.0,
      criticalThreshold: 115.0,
      description: 'System line and discharge pressure envelope'
    },
    rpm: { 
      label: 'Rotational Speed', 
      unit: 'RPM', 
      nominal: 2400, 
      warningThreshold: 2320,
      criticalThreshold: 2280,
      description: 'Shaft operating velocity and angular stability'
    },
  };

  const activeSensorInfo = sensorDefinitions[selectedSensorChart];

  // History slice for line chart
  const history = selectedEngine.history.slice(-50);
  const chartPoints = history.map((pt) => ({
    cycle: pt.cycle,
    val: Number(pt[selectedSensorChart]) || 0,
  }));

  const minVal = Math.min(...chartPoints.map((p) => p.val));
  const maxVal = Math.max(...chartPoints.map((p) => p.val));
  const range = maxVal - minVal || 1;

  const svgWidth = 620;
  const svgHeight = 160;
  const pad = 28;

  const pointsString = chartPoints
    .map((p, idx) => {
      const x = pad + (idx / (chartPoints.length - 1 || 1)) * (svgWidth - pad * 2);
      const y = svgHeight - pad - ((p.val - minVal) / range) * (svgHeight - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const latestReading = history[history.length - 1] || selectedEngine.history[selectedEngine.history.length - 1];

  // Filtering
  const filteredFleet = fleet.filter((m) => {
    if (typeFilter !== 'ALL' && m.fleetType !== typeFilter) return false;
    if (statusFilter === 'ATTENTION') return m.status === 'Critical' || m.status === 'Maintenance Required';
    if (statusFilter === 'NORMAL') return m.status === 'Healthy' || m.status === 'Degrading';
    return true;
  });

  const criticalCount = fleet.filter((m) => m.status === 'Critical').length;
  const maintenanceCount = fleet.filter((m) => m.status === 'Maintenance Required').length;
  const healthyCount = fleet.filter((m) => m.status === 'Healthy').length;
  const avgHealth = Math.round(fleet.reduce((acc, m) => acc + m.healthScore, 0) / fleet.length);

  return (
    <div className="space-y-6">
      {/* High-Level Fleet Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Monitored Fleet Assets</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{fleet.length} Units</div>
          <div className="text-[11px] text-slate-500 mt-1">Trucks, city transit buses &amp; compressors</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Fleet Health Index</span>
            <span className="text-xs font-semibold text-slate-700 font-mono tabular-nums">{avgHealth}%</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{avgHealth}% Nominal</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${avgHealth}%` }} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Attention Required</span>
            <span className={`w-2 h-2 rounded-full ${criticalCount > 0 ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono tabular-nums">{criticalCount + maintenanceCount} Units</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {criticalCount} critical isolation · {maintenanceCount} scheduled
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Nominal Operations</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">{healthyCount} Units</div>
          <div className="text-[11px] text-slate-500 mt-1">Operating safely inside wear thresholds</div>
        </div>
      </div>

      {/* Fleet Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
          <span className="text-xs text-slate-400 font-medium px-2">Asset Type:</span>
          {['ALL', 'Heavy Haul Truck', 'City Transit Bus', 'Industrial Compressor'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {type === 'ALL' ? 'All Connected Assets' : type.replace('Industrial ', '')}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-xs text-slate-400 font-medium px-2">Health State:</span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'ATTENTION', label: 'Needs Attention' },
            { id: 'NORMAL', label: 'Nominal Only' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                statusFilter === st.id
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Machine Cards Grid With Real Machinery Photography */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFleet.map((machine) => {
          const isSelected = machine.engineId === selectedEngine.engineId;
          const statusBadge = {
            Healthy: { label: 'Nominal', dot: 'bg-emerald-500', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
            Degrading: { label: 'Early Wear', dot: 'bg-amber-500', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
            'Maintenance Required': { label: 'Service Due', dot: 'bg-amber-600', bg: 'bg-amber-50 text-amber-800 border-amber-300' },
            Critical: { label: 'Critical Risk', dot: 'bg-rose-500', bg: 'bg-rose-50 text-rose-800 border-rose-300' },
          }[machine.status];

          const currentReading = machine.history[machine.history.length - 1];

          return (
            <div
              key={machine.engineId}
              onClick={() => onSelectEngine(machine.engineId)}
              className={`rounded-xl border text-left transition-all cursor-pointer overflow-hidden bg-white ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {/* Image Header */}
              <div className="relative h-40 bg-slate-100 overflow-hidden">
                {machine.image ? (
                  <img
                    src={machine.image}
                    alt={machine.modelDesignation}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                    <Factory className="w-8 h-8" />
                  </div>
                )}
                {/* Contrast gradient overlay for legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                {/* Header overlay metadata */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white/95 text-slate-900 shadow-sm backdrop-blur-xs">
                    {machine.engineId}
                  </span>
                </div>

                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border backdrop-blur-xs ${statusBadge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`}></span>
                    <span>{statusBadge.label}</span>
                  </span>
                </div>

                <div className="absolute bottom-2.5 left-3 right-3 text-white">
                  <div className="font-bold text-sm leading-tight text-white drop-shadow-xs truncate">
                    {machine.modelDesignation}
                  </div>
                  <div className="text-[11px] text-slate-200 mt-0.5 truncate">
                    {machine.fleetType} · {machine.assignedDepot || 'Depot Central'}
                  </div>
                </div>
              </div>

              {/* Body stats */}
              <div className="p-4">
                {/* 5 Core Live Sensor Bar */}
                <div className="grid grid-cols-5 gap-1.5 text-center pb-3 border-b border-slate-100">
                  <div className="bg-slate-50 rounded-md p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Vib</span>
                    <span className="text-xs font-bold text-slate-800 font-mono tabular-nums">{currentReading?.vibration ?? '--'}</span>
                  </div>
                  <div className="bg-slate-50 rounded-md p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Temp</span>
                    <span className="text-xs font-bold text-slate-800 font-mono tabular-nums">{Math.round(currentReading?.temperature ?? 0)}°</span>
                  </div>
                  <div className="bg-slate-50 rounded-md p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Curr</span>
                    <span className="text-xs font-bold text-slate-800 font-mono tabular-nums">{currentReading?.motorCurrent ?? '--'}A</span>
                  </div>
                  <div className="bg-slate-50 rounded-md p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Pres</span>
                    <span className="text-xs font-bold text-slate-800 font-mono tabular-nums">{Math.round(currentReading?.pressure ?? 0)}</span>
                  </div>
                  <div className="bg-slate-50 rounded-md p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">RPM</span>
                    <span className="text-xs font-bold text-slate-800 font-mono tabular-nums">{currentReading?.rpm ?? '--'}</span>
                  </div>
                </div>

                {/* Progress and Numbers */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Health Score</span>
                    <span className="font-bold text-slate-800 font-mono tabular-nums">{machine.healthScore}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Cycle</span>
                    <span className="font-medium text-slate-700 font-mono tabular-nums">{machine.currentCycle} / {machine.maxHistoricalCycle}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] block">Est. RUL</span>
                    <span className={`font-bold font-mono tabular-nums ${
                      machine.predictedRUL < 20 ? 'text-rose-600' :
                      machine.predictedRUL < 48 ? 'text-amber-600' : 'text-slate-800'
                    }`}>
                      {machine.predictedRUL} cycles left
                    </span>
                  </div>
                </div>

                {/* Health Meter */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      machine.healthScore < 30 ? 'bg-rose-500' : machine.healthScore < 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${machine.healthScore}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Machine Detailed Diagnostic Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        {/* Machine Dossier Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-xs">
              {selectedEngine.image ? (
                <img
                  src={selectedEngine.image}
                  alt={selectedEngine.modelDesignation}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Factory className="w-8 h-8" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold text-slate-900 tracking-tight">{selectedEngine.engineId}</span>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-semibold text-slate-700">{selectedEngine.modelDesignation}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Asset Class: <strong className="font-medium text-slate-700">{selectedEngine.fleetType}</strong> · Facility: <strong className="font-medium text-slate-700">{selectedEngine.assignedDepot || 'Depot Central'}</strong> · Operating Condition: <strong className="font-medium text-slate-700">{selectedEngine.operatingCondition}</strong>
              </p>
              <div className="flex items-center space-x-4 mt-2 text-xs">
                <span className="text-slate-600">
                  Current Run: <strong className="font-mono text-slate-900 font-semibold">{selectedEngine.currentCycle}</strong> / {selectedEngine.maxHistoricalCycle} cycles
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-600">
                  ML Predicted RUL: <strong className={`font-mono font-semibold ${selectedEngine.predictedRUL < 20 ? 'text-rose-600' : 'text-slate-900'}`}>{selectedEngine.predictedRUL} cycles</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Clean Stepper & Closed-Loop Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => onStepCycle(selectedEngine.engineId, 1)}
              disabled={selectedEngine.currentCycle >= selectedEngine.maxHistoricalCycle}
              className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 disabled:opacity-40 transition-colors shadow-xs"
              title="Ingest +1 cycle of sensor streaming"
            >
              +1 Cycle
            </button>

            <button
              onClick={() => onStepCycle(selectedEngine.engineId, 10)}
              disabled={selectedEngine.currentCycle >= selectedEngine.maxHistoricalCycle}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 disabled:opacity-40 transition-colors shadow-xs"
              title="Step forward by 10 cycles to accelerate degradation"
            >
              <FastForward className="w-3.5 h-3.5 text-slate-500" />
              <span>+10 Cycles</span>
            </button>

            <button
              onClick={() => onResetEngine(selectedEngine.engineId)}
              className="p-2 text-slate-500 hover:text-slate-800 bg-white rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
              title="Reset machine to nominal fresh baseline"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => onTriggerTriage(selectedEngine)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Raise Work Order</span>
            </button>
          </div>
        </div>

        {/* 5 Core Physical Sensors Cards */}
        <div className="my-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Continuous Telemetry Ingestion (5 Core Sensor Channels)
            </h3>
            <span className="text-xs text-slate-500">
              Click any channel to view 50-cycle trend
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {(['vibration', 'temperature', 'motorCurrent', 'pressure', 'rpm'] as const).map((key) => {
              const meta = sensorDefinitions[key];
              const currentVal = latestReading ? Number(latestReading[key]) : meta.nominal;
              const isSelected = selectedSensorChart === key;

              const isWarning = key === 'pressure'
                ? currentVal < meta.warningThreshold
                : currentVal > meta.warningThreshold;
              
              const isCritical = key === 'pressure'
                ? currentVal < meta.criticalThreshold
                : currentVal > meta.criticalThreshold;

              return (
                <div
                  key={key}
                  onClick={() => setSelectedSensorChart(key)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{meta.label}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                  </div>
                  
                  <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
                    {currentVal} <span className="text-xs font-normal text-slate-500">{meta.unit}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2">
                    <span>Nominal: {meta.nominal}</span>
                    {isCritical ? (
                      <span className="text-rose-600 font-semibold">Critical</span>
                    ) : isWarning ? (
                      <span className="text-amber-600 font-semibold">Elevated</span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Optimal</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Multi-Cycle Sensor Trajectory Graph */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900">
                  {activeSensorInfo.label} Trajectory
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-600">Past 50 Operational Cycles</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Current: <strong className="text-slate-900 font-mono">{latestReading ? latestReading[selectedSensorChart] : '--'} {activeSensorInfo.unit}</strong> — {activeSensorInfo.description}
              </p>
            </div>

            {/* Sensor selector tabs */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 p-1 rounded-lg">
              {(['vibration', 'temperature', 'motorCurrent', 'pressure', 'rpm'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedSensorChart(key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedSensorChart === key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {sensorDefinitions[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Graph on Daylight Surface */}
          <div className="relative w-full overflow-hidden bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-40">
              <defs>
                <linearGradient id="sensorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Reference Grid */}
              <line x1={pad} y1={pad} x2={svgWidth - pad} y2={pad} stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1" />
              <line x1={pad} y1={svgHeight / 2} x2={svgWidth - pad} y2={svgHeight / 2} stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1" />
              <line x1={pad} y1={svgHeight - pad} x2={svgWidth - pad} y2={svgHeight - pad} stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Labels */}
              <text x={pad + 4} y={pad + 10} fill="#64748b" fontSize="10" fontFamily="sans-serif" fontWeight="500">
                Peak: {maxVal.toFixed(1)} {activeSensorInfo.unit}
              </text>
              <text x={pad + 4} y={svgHeight - pad - 6} fill="#64748b" fontSize="10" fontFamily="sans-serif" fontWeight="500">
                Baseline: {minVal.toFixed(1)} {activeSensorInfo.unit}
              </text>

              {/* Shaded Area */}
              {chartPoints.length > 1 && (
                <polygon
                  fill="url(#sensorAreaGrad)"
                  points={`${pad},${svgHeight - pad} ${pointsString} ${svgWidth - pad},${svgHeight - pad}`}
                />
              )}

              {/* Sensor Line */}
              {chartPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsString}
                />
              )}

              {/* Current Value Marker */}
              {chartPoints.length > 0 && (() => {
                const lastIdx = chartPoints.length - 1;
                const lastPt = chartPoints[lastIdx];
                const cx = pad + (lastIdx / (chartPoints.length - 1 || 1)) * (svgWidth - pad * 2);
                const cy = svgHeight - pad - ((lastPt.val - minVal) / range) * (svgHeight - pad * 2);
                return (
                  <g>
                    <circle cx={cx} cy={cy} r="6" fill="#2563eb" opacity="0.3" />
                    <circle cx={cx} cy={cy} r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Subsystem Health Matrix */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Component Wear &amp; Subsystem Degradation
            </h4>
            <span className="text-xs text-slate-500">
              Composite degradation model derived from continuous telemetry
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-700">Compressor / Engine Core</div>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono tabular-nums">{selectedEngine.subsystemDegradation.compressorHPC}% wear</div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${selectedEngine.subsystemDegradation.compressorHPC}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-700">Drivetrain &amp; Turbine</div>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono tabular-nums">{selectedEngine.subsystemDegradation.turbineLPT}% wear</div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${selectedEngine.subsystemDegradation.turbineLPT}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-700">Bearings &amp; Shaft Vibration</div>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono tabular-nums">{selectedEngine.subsystemDegradation.bearingsVibration}% wear</div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-amber-600 h-full rounded-full"
                  style={{ width: `${selectedEngine.subsystemDegradation.bearingsVibration}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-700">Thermal Combustion / Seals</div>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono tabular-nums">{selectedEngine.subsystemDegradation.combustionThermal}% wear</div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${selectedEngine.subsystemDegradation.combustionThermal}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
