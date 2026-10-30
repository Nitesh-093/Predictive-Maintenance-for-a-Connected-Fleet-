import React, { useState } from 'react';
import { 
  ShieldAlert, Wrench, CheckCircle2, AlertTriangle, 
  FileText, Sliders, ExternalLink, PlusCircle, UserCheck, Shield, Clock, DollarSign
} from 'lucide-react';
import { EngineData, WorkOrder } from '../types/fleet';
import { 
  evaluateTriageLogic, 
  generateWorkOrder, 
  DEFAULT_TRIAGE_CONFIG, 
  TriageRuleConfig 
} from '../services/triageAgent';
import { predictRUL } from '../services/mlModels';

interface TriageAgentViewProps {
  engine: EngineData;
  workOrders: WorkOrder[];
  onApproveWorkOrder: (id: string, notes?: string) => void;
  onDispatchWorkOrder: (id: string) => void;
  onCreateWorkOrder: (wo: WorkOrder) => void;
  onSelectWorkOrderForModal: (wo: WorkOrder) => void;
}

export const TriageAgentView: React.FC<TriageAgentViewProps> = ({
  engine,
  workOrders,
  onApproveWorkOrder,
  onDispatchWorkOrder,
  onCreateWorkOrder,
  onSelectWorkOrderForModal,
}) => {
  const [config, setConfig] = useState<TriageRuleConfig>(DEFAULT_TRIAGE_CONFIG);
  const [statusFilter, setStatusFilter] = useState<string>('EXCEPTIONS_FIRST');
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  const prediction = predictRUL(engine.history, 'gbdt');
  const liveDecision = evaluateTriageLogic(engine, prediction, config);

  const handleGenerateNow = () => {
    const newWO = generateWorkOrder(engine, prediction, config);
    onCreateWorkOrder(newWO);
  };

  const pendingExceptions = workOrders.filter((wo) => wo.isException && wo.status === 'PENDING_APPROVAL');
  
  const filteredOrders = statusFilter === 'EXCEPTIONS_FIRST'
    ? [...workOrders].sort((a, b) => (b.isException ? 1 : 0) - (a.isException ? 1 : 0))
    : statusFilter === 'EXCEPTIONS_ONLY'
    ? workOrders.filter((wo) => wo.isException)
    : statusFilter === 'ALL'
    ? workOrders
    : workOrders.filter((wo) => wo.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Overview & Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Maintenance Work Orders &amp; Closed-Loop Dispatch</h2>
          <p className="text-xs text-slate-500 mt-1">
            Standard maintenance orders are raised and dispatched automatically upon sensor threshold breaches. Maintenance supervisors intervene strictly to review safety-critical exceptions.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>{showConfigPanel ? 'Close Thresholds' : 'Rule Thresholds'}</span>
          </button>
        </div>
      </div>

      {/* Human-in-the-Loop Exception Alert Box */}
      {pendingExceptions.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-amber-900 block">
                Supervisor Approval Required ({pendingExceptions.length} Safety Exception Pending)
              </span>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {pendingExceptions[0].exceptionReason || 'Critical safety event detected. Operational sign-off is required to certify equipment isolation before dispatch.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onApproveWorkOrder(pendingExceptions[0].id, 'Authorized by Lead Maintenance Supervisor')}
            className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors shrink-0"
          >
            Authorize Equipment Sign-Off
          </button>
        </div>
      )}

      {/* Threshold Configuration Drawer */}
      {showConfigPanel && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            Operational Trigger Thresholds
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="text-slate-700 font-semibold block mb-1">Critical RUL Exception</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.criticalRulThreshold}
                  onChange={(e) => setConfig({ ...config, criticalRulThreshold: Number(e.target.value) })}
                  className="w-16 bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-900 text-xs font-mono font-semibold"
                />
                <span className="text-slate-500 text-xs">cycles (triggers grounding)</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="text-slate-700 font-semibold block mb-1">High Risk Threshold</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.highRiskRulThreshold}
                  onChange={(e) => setConfig({ ...config, highRiskRulThreshold: Number(e.target.value) })}
                  className="w-16 bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-900 text-xs font-mono font-semibold"
                />
                <span className="text-slate-500 text-xs">cycles (48h depot dispatch)</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="text-slate-700 font-semibold block mb-1">Anomaly Deviation Index</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  value={config.criticalAnomalyThreshold}
                  onChange={(e) => setConfig({ ...config, criticalAnomalyThreshold: Number(e.target.value) })}
                  className="w-16 bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-900 text-xs font-mono font-semibold"
                />
                <span className="text-slate-500 text-xs">envelope threshold</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Machine Real-Time Assessment Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-200 gap-2 mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-medium text-slate-400">Target Machine:</span>
            <span className="font-bold text-slate-900 text-sm">{engine.engineId}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-600 font-medium">{engine.fleetType} ({engine.modelDesignation})</span>
          </div>

          <button
            onClick={handleGenerateNow}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Issue Work Order</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[11px] block font-semibold uppercase tracking-wider">Assessed Priority</span>
            <span className="text-sm font-bold text-slate-900 block mt-1">{liveDecision.priority}</span>
            <p className="text-slate-600 text-[11px] mt-1.5 leading-relaxed">{liveDecision.triggerReason}</p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[11px] block font-semibold uppercase tracking-wider">Action &amp; Diagnosis</span>
            <span className="font-bold text-slate-900 block mt-1">{liveDecision.primaryFailureMode}</span>
            <p className="text-slate-600 text-[11px] mt-1.5 leading-relaxed">{liveDecision.actionRequired}</p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[11px] block font-semibold uppercase tracking-wider">Assigned Tech &amp; Impact</span>
            <div className="text-slate-900 font-bold mt-1">{liveDecision.assignedTechnician}</div>
            <div className="text-slate-600 text-[11px] mt-1.5">
              Est. {liveDecision.estimatedDowntimeHours}h downtime · ${liveDecision.estimatedCost.toLocaleString()} parts &amp; labor
            </div>
          </div>
        </div>
      </div>

      {/* Active Work Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Work Orders Ledger ({workOrders.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Autonomous and supervisor-managed orders recorded across operational cycles
            </p>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'EXCEPTIONS_FIRST', label: 'All Orders' },
              { id: 'EXCEPTIONS_ONLY', label: 'Exceptions Only' },
              { id: 'DISPATCHED', label: 'Dispatched' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  statusFilter === st.id ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] border-b border-slate-200 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Primary Diagnosis</th>
                <th className="py-3 px-4">Routing</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredOrders.map((wo) => {
                return (
                  <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-900 font-semibold">{wo.id}</td>
                    <td className="py-3 px-4 text-blue-700 font-semibold">{wo.engineId}</td>
                    <td className="py-3 px-4 text-slate-700">{wo.priority.split(' - ')[1] || wo.priority}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={wo.primaryFailureMode}>
                      {wo.primaryFailureMode}
                    </td>
                    <td className="py-3 px-4">
                      {wo.isException ? (
                        <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          Supervisor Gate
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">Autonomous Flow</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        wo.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        wo.status === 'APPROVED' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        wo.status === 'DISPATCHED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {wo.status === 'PENDING_APPROVAL' ? 'Pending Approval' :
                         wo.status === 'APPROVED' ? 'Approved' :
                         wo.status === 'DISPATCHED' ? 'Dispatched' : wo.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {wo.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => onApproveWorkOrder(wo.id, 'Approved by Maintenance Supervisor')}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors shadow-2xs"
                          >
                            Sign-Off
                          </button>
                        )}
                        {wo.status === 'APPROVED' && (
                          <button
                            onClick={() => onDispatchWorkOrder(wo.id)}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-2xs"
                          >
                            Dispatch
                          </button>
                        )}
                        <button
                          onClick={() => onSelectWorkOrderForModal(wo)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
                          title="View Order Details"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
