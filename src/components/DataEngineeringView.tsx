import React, { useState } from 'react';
import { 
  Cpu, Sliders, Table, CheckCircle2, BarChart2 
} from 'lucide-react';
import { EngineData } from '../types/fleet';
import { 
  calculateRollingFeatures, 
  cleanSensorStream, 
  getSensorCorrelations,
  DataCleaningConfig,
  DEFAULT_CLEANING_CONFIG 
} from '../services/dataEngineering';

interface DataEngineeringViewProps {
  engine: EngineData;
}

export const DataEngineeringView: React.FC<DataEngineeringViewProps> = ({ engine }) => {
  const [cleaningConfig, setCleaningConfig] = useState<DataCleaningConfig>(DEFAULT_CLEANING_CONFIG);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('ALL');

  const rawReadings = engine.history.slice(-30);
  const cleanedReadings = cleanSensorStream(rawReadings, cleaningConfig);
  const engineeredFeatures = calculateRollingFeatures(cleanedReadings, cleaningConfig.windowSize);
  const correlations = getSensorCorrelations();

  const filteredFeatures = selectedFilterCategory === 'ALL'
    ? engineeredFeatures
    : engineeredFeatures.filter((f) => f.category === selectedFilterCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Signal Conditioning &amp; Rolling Features Pipeline</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Real-time pipeline cleans noisy industrial telemetry feeds, suppresses impulsive transmission jitter, and extracts rolling statistical features across vibration, temperature, current, pressure, and RPM.
            </p>
          </div>

          <div className="text-xs text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200 font-medium shrink-0">
            Selected Unit: <strong className="text-blue-700 font-semibold">{engine.engineId}</strong> ({engine.fleetType})
          </div>
        </div>
      </div>

      {/* Preprocessing Settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>Preprocessing &amp; Rolling Window Controls</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Outlier Filter */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">Impulsive Spike Rejection</span>
                <span className={`text-[11px] font-bold ${cleaningConfig.enableOutlierFilter ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {cleaningConfig.enableOutlierFilter ? 'Active (Median Filter)' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Applies temporal median smoothing to eliminate sensor transmission spikes without introducing phase delay.
              </p>
            </div>
            <button
              onClick={() => setCleaningConfig({ ...cleaningConfig, enableOutlierFilter: !cleaningConfig.enableOutlierFilter })}
              className="mt-3 py-1.5 px-3 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors shadow-2xs"
            >
              Toggle Noise Filter
            </button>
          </div>

          {/* Window Span */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">Rolling Window Span (W)</span>
                <span className="font-bold text-blue-700 text-xs font-mono">
                  {cleaningConfig.windowSize} Cycles
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Sliding window width used to compute rolling mean, standard deviation, and trend velocity.
              </p>
            </div>
            <div className="mt-3">
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={cleaningConfig.windowSize}
                onChange={(e) => setCleaningConfig({ ...cleaningConfig, windowSize: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>5 cyc (Fast)</span>
                <span>15 cyc (Default)</span>
                <span>30 cyc (Smooth)</span>
              </div>
            </div>
          </div>

          {/* Imputation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">Missing Value Imputation</span>
                <span className="text-blue-700 text-xs font-semibold">Forward Fill</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Momentary dropouts sustain previous valid baseline to prevent false step discontinuities.
              </p>
            </div>
            <div className="mt-3 text-[11px] text-emerald-700 font-semibold flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero-Loss Pipeline Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensor Correlation Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            <span>Monotonic Wear Correlation</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical correlation between sensor channels and continuous machinery degradation progression
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {correlations.map((corr) => (
            <div key={corr.sensor} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">{corr.name}</span>
                <span className="text-xs font-bold text-blue-700 font-mono tabular-nums">
                  r = {corr.correlation > 0 ? `+${corr.correlation}` : corr.correlation}
                </span>
              </div>
              <span className="text-[11px] text-slate-600 font-medium block mb-1">{corr.direction}</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">{corr.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engineered Feature Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Table className="w-4 h-4 text-blue-600" />
              <span>Extracted Features Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time features continuously supplied to Remaining Useful Life prediction algorithms
            </p>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg">
            {['ALL', 'Rolling Mean', 'Rolling Std', 'Trend Velocity', 'EMA'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilterCategory(cat)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  selectedFilterCategory === cat ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Feature Name</th>
                <th className="py-3 px-4">Raw Sensor Channel</th>
                <th className="py-3 px-4">Feature Type</th>
                <th className="py-3 px-4 text-right">Computed Value</th>
                <th className="py-3 px-4 text-right">Z-Score</th>
                <th className="py-3 px-4">Importance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredFeatures.map((feat, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-slate-900 font-medium font-mono">{feat.featureName}</td>
                  <td className="py-3 px-4 text-slate-600">{feat.rawSensor}</td>
                  <td className="py-3 px-4 text-slate-600">{feat.category}</td>
                  <td className="py-3 px-4 text-right text-slate-900 font-bold font-mono tabular-nums">{feat.currentValue}</td>
                  <td className="py-3 px-4 text-right text-slate-700 font-mono tabular-nums">
                    {feat.zScore > 0 ? `+${feat.zScore}` : feat.zScore}σ
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, feat.importance * 300)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{(feat.importance * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
