import React, { useState } from 'react';
import { 
  RefreshCw, CheckCircle2, AlertTriangle, GitCommit, Play, 
  BarChart2, Activity, ArrowUpRight, Database
} from 'lucide-react';
import { ModelVersion, RetrainingLog } from '../types/fleet';
import { computeDataDrift } from '../services/mlopsRegistry';

interface MLOpsCenterProps {
  modelVersions: ModelVersion[];
  retrainingLogs: RetrainingLog[];
  onTriggerRetraining: () => Promise<void>;
  isRetraining: boolean;
}

export const MLOpsCenter: React.FC<MLOpsCenterProps> = ({
  modelVersions,
  retrainingLogs,
  onTriggerRetraining,
  isRetraining,
}) => {
  const [retrainingStage, setRetrainingStage] = useState<string>('');
  const driftMetrics = computeDataDrift();

  const handleRetrainingDemo = async () => {
    try {
      setRetrainingStage('Ingesting 3,200 continuous sensor cycles from connected fleet...');
      await new Promise((r) => setTimeout(r, 600));
      setRetrainingStage('Extracting rolling window features & computing PSI drift...');
      await new Promise((r) => setTimeout(r, 700));
      setRetrainingStage('Fitting challenger regression model against streaming wear data...');
      await new Promise((r) => setTimeout(r, 800));
      setRetrainingStage('Validating against RMSE threshold and NASA asymmetric score...');
      await new Promise((r) => setTimeout(r, 600));
      
      await onTriggerRetraining();
      setRetrainingStage('Model v1.3.0 promoted to active production serving.');
      setTimeout(() => setRetrainingStage(''), 3000);
    } catch (e) {
      setRetrainingStage('');
    }
  };

  const activeModel = modelVersions.find((m) => m.status === 'Production') || modelVersions[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Model Registry &amp; Automated Pipeline Retraining</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Continuously monitors multi-channel telemetry distribution drift across the connected fleet and executes automated retraining cycles as streaming data batches accumulate.
            </p>
          </div>

          <button
            onClick={handleRetrainingDemo}
            disabled={isRetraining}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg shadow-xs transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
            <span>{isRetraining ? 'Retraining...' : 'Trigger Retraining Pipeline'}</span>
          </button>
        </div>

        {/* Retraining Notification Banner */}
        {retrainingStage && (
          <div className="mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-2 text-xs text-blue-900 animate-in fade-in">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            <span className="font-medium">{retrainingStage}</span>
          </div>
        )}
      </div>

      {/* Operational Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs font-medium block">Inference Throughput</span>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">1,480 <span className="text-xs font-normal text-slate-500">ev/s</span></div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">Edge buffer latency &lt; 3ms</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs font-medium block">P99 Inference Latency</span>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">2.4 <span className="text-xs font-normal text-slate-500">ms</span></div>
          <span className="text-[11px] text-slate-500 mt-1 block">Deterministic budget</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs font-medium block">Active Version</span>
          <div className="text-2xl font-bold text-blue-700 mt-1 font-mono">{activeModel.version}</div>
          <span className="text-[11px] text-slate-600 mt-1 block truncate">{activeModel.modelFamily}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs font-medium block">Validation RMSE</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums">{activeModel.rmse}</div>
          <span className="text-[11px] text-slate-600 mt-1 block font-mono">R² Score: {activeModel.r2}</span>
        </div>
      </div>

      {/* Model Registry Version Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <GitCommit className="w-4 h-4 text-blue-600" />
          <span>Model Registry &amp; Version Lineage</span>
        </h3>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Architecture</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">RMSE</th>
                <th className="py-3 px-4">R² Score</th>
                <th className="py-3 px-4">Target Fleet</th>
                <th className="py-3 px-4">Trained Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {modelVersions.map((mv) => (
                <tr key={mv.version} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{mv.version}</td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{mv.modelFamily}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                      mv.status === 'Production' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                      mv.status === 'Challenger' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {mv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 font-mono tabular-nums">{mv.rmse}</td>
                  <td className="py-3 px-4 text-slate-700 font-mono tabular-nums">{mv.r2}</td>
                  <td className="py-3 px-4 text-slate-600">Trucks, Buses &amp; Compressors</td>
                  <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">{new Date(mv.trainedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sensor Data Drift Monitor */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
            <BarChart2 className="w-4 h-4 text-blue-600" />
            <span>Telemetry Distribution Shift Monitor (Population Stability Index)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            PSI evaluated on rolling 100-cycle sensor streams against baseline distributions
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {driftMetrics.map((dm) => (
            <div key={dm.feature} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-800 font-bold block truncate" title={dm.feature}>
                {dm.feature}
              </span>
              <div className="my-2 flex items-baseline justify-between">
                <span className="text-[10px] text-slate-500 font-medium">PSI Score:</span>
                <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">{dm.psiScore}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] border-t border-slate-200/60 pt-2">
                <span className={`font-semibold ${dm.status === 'In-Bounds' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {dm.status}
                </span>
                <span className="text-slate-500 font-mono text-[10px]">p={dm.pVal}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Retraining Execution Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Retraining Pipeline History
        </h3>

        <div className="space-y-2.5">
          {retrainingLogs.map((log) => (
            <div key={log.runId} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-slate-900">{log.runId}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-emerald-700 font-semibold">Success</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600">{log.triggeredBy}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Ingested {log.dataPointsIngested.toLocaleString()} continuous sensor cycles
                </div>
              </div>

              <div className="flex items-center space-x-4 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block font-medium">Prev RMSE</span>
                  <span className="text-slate-700 font-mono font-medium">{log.previousRMSE}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-medium">New RMSE</span>
                  <span className="text-emerald-700 font-bold font-mono">{log.newRMSE}</span>
                </div>
                <div className="text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-mono">
                  {log.deltaPercent}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
