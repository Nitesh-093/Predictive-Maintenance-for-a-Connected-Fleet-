import React, { useState } from 'react';
import { 
  GitBranch, Award, CheckCircle2, AlertTriangle, TrendingUp, 
  HelpCircle, Zap, Clock, ShieldAlert, Cpu, BarChart3
} from 'lucide-react';
import { EngineData } from '../types/fleet';
import { 
  BENCHMARK_MODELS, 
  calculateNasaScore, 
  generateRunComparison, 
  predictRUL, 
  ModelBenchmark 
} from '../services/mlModels';

interface ModelEvaluationViewProps {
  engine: EngineData;
  selectedModelId: string;
  onSelectModel: (id: string) => void;
}

export const ModelEvaluationView: React.FC<ModelEvaluationViewProps> = ({
  engine,
  selectedModelId,
  onSelectModel,
}) => {
  const [showFormulaExplanation, setShowFormulaExplanation] = useState<boolean>(false);

  const activeBenchmark = BENCHMARK_MODELS.find((m) => m.id === selectedModelId) || BENCHMARK_MODELS[0];
  const prediction = predictRUL(engine.history, selectedModelId);

  // Trajectory comparison points across cycles
  const runComparison = generateRunComparison(engine.maxHistoricalCycle, engine.maxHistoricalCycle);

  // SVG dimensions for RUL comparison plot
  const svgWidth = 650;
  const svgHeight = 220;
  const pad = 32;

  const maxCycle = engine.maxHistoricalCycle;
  const maxRUL = 140;

  const getCoord = (cycle: number, rul: number) => {
    const x = pad + (cycle / maxCycle) * (svgWidth - pad * 2);
    const y = svgHeight - pad - (Math.min(maxRUL, rul) / maxRUL) * (svgHeight - pad * 2);
    return { x, y };
  };

  const truePoints = runComparison.map((p) => `${getCoord(p.cycle, p.actualRUL).x},${getCoord(p.cycle, p.actualRUL).y}`).join(' ');
  const benchmarkCappedPoints = runComparison.map((p) => `${getCoord(p.cycle, p.benchmarkCappedRUL).x},${getCoord(p.cycle, p.benchmarkCappedRUL).y}`).join(' ');
  const gbdtPoints = runComparison.map((p) => `${getCoord(p.cycle, p.gbdtPredicted).x},${getCoord(p.cycle, p.gbdtPredicted).y}`).join(' ');
  const linearPoints = runComparison.map((p) => `${getCoord(p.cycle, p.linearPredicted).x},${getCoord(p.cycle, p.linearPredicted).y}`).join(' ');

  // Current engine marker
  const currentEngineCoord = getCoord(engine.currentCycle, prediction.predictedRUL);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Degradation Detection &amp; Remaining Useful Life (RUL) Models</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Supervised regression models ingest continuous 5-channel telemetry (vibration, temperature, current, pressure, and RPM) to calculate non-linear degradation and forecast cycles before mechanical breakdown.
            </p>
          </div>

          <div className="text-xs text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200 font-medium shrink-0">
            Active Serving Model: <strong className="text-blue-700 font-semibold">{activeBenchmark.name.split('(')[0]}</strong>
          </div>
        </div>
      </div>

      {/* Model Comparison Cards */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Evaluated Regression Models
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Trained and benchmarked on continuous run-to-failure sensor streams
            </p>
          </div>

          <button
            onClick={() => setShowFormulaExplanation(!showFormulaExplanation)}
            className="flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Why Asymmetric Penalty Scoring?</span>
          </button>
        </div>

        {/* Asymmetric Formula Explanation */}
        {showFormulaExplanation && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 text-xs text-slate-700 space-y-2.5 animate-in fade-in">
            <span className="font-bold text-slate-900 block">Aviation &amp; Heavy Fleet Safety Asymmetry</span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              In heavy transport and fleet maintenance, an <strong>under-prediction</strong> (predicting failure earlier than reality, error d = y_hat - y &lt; 0) is safe because preventative maintenance is performed early. An <strong>over-prediction</strong> (predicting equipment has life left when it is already in danger of breakdown, d &gt; 0) is hazardous and risks unexpected en-route breakdown.
            </p>
            <div className="bg-white p-3 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200">
              S = ∑ [ exp(-d / 13) - 1 for d &lt; 0 (conservative) ; exp(+d / 10) - 1 for d ≥ 0 (heavily penalized) ]
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {BENCHMARK_MODELS.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-500 font-medium">{model.family}</span>
                    <span className={`text-[10px] font-bold ${model.suitability === 'Recommended' ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {model.suitability}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-2 leading-tight">{model.name}</h4>

                  <div className="grid grid-cols-2 gap-2 my-2 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">RMSE:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">{model.rmse}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">R² Score:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">{model.r2}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">NASA Score:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">{model.nasaScore}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-medium">Latency:</span>
                      <span className="text-slate-700 font-mono tabular-nums">{model.inferenceLatencyMs}ms</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                  {model.pros}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Degradation Trajectory Comparison */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Run-to-Failure Degradation Trajectory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Linear plateau capping at 125 cycles stabilizes early healthy baseline before mechanical wear acceleration
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-medium">
            <span className="flex items-center space-x-1.5 text-slate-500">
              <span className="w-3 h-0.5 bg-slate-400"></span>
              <span>Ground Truth</span>
            </span>
            <span className="flex items-center space-x-1.5 text-blue-600">
              <span className="w-3 h-0.5 bg-blue-600"></span>
              <span>Capped Target</span>
            </span>
            <span className="flex items-center space-x-1.5 text-emerald-600">
              <span className="w-3 h-0.5 bg-emerald-600"></span>
              <span>Predicted (GBDT)</span>
            </span>
          </div>
        </div>

        {/* Plot */}
        <div className="relative w-full overflow-hidden bg-slate-50 rounded-lg border border-slate-200 p-3 shadow-2xs">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44">
            <line x1={pad} y1={pad} x2={svgWidth - pad} y2={pad} stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1={pad} y1={svgHeight / 2} x2={svgWidth - pad} y2={svgHeight / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1={pad} y1={svgHeight - pad} x2={svgWidth - pad} y2={svgHeight - pad} stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1={pad} y1={pad} x2={pad} y2={svgHeight - pad} stroke="#cbd5e1" strokeWidth="1.5" />

            <text x={pad + 4} y={pad + 12} fill="#64748b" fontSize="10" fontFamily="sans-serif" fontWeight="500">Plateau: 125 Cycles</text>
            <text x={svgWidth - pad - 110} y={svgHeight - pad - 6} fill="#64748b" fontSize="10" fontFamily="sans-serif" fontWeight="500">Cycle {maxCycle} (Breakdown)</text>

            <polyline fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" points={truePoints} />
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={benchmarkCappedPoints} />
            <polyline fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" points={linearPoints} />
            <polyline fill="none" stroke="#059669" strokeWidth="2.5" points={gbdtPoints} />

            {engine.currentCycle <= maxCycle && (
              <g>
                <line
                  x1={currentEngineCoord.x}
                  y1={pad}
                  x2={currentEngineCoord.x}
                  y2={svgHeight - pad}
                  stroke="#2563eb"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={currentEngineCoord.x}
                  cy={currentEngineCoord.y}
                  r="5"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
