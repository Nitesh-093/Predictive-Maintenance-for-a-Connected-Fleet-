import React from 'react';
import { X, Printer, CheckCircle2, ShieldAlert, Wrench, User, Calendar, Clock, DollarSign } from 'lucide-react';
import { WorkOrder } from '../types/fleet';

interface WorkOrderDetailModalProps {
  workOrder: WorkOrder | null;
  onClose: () => void;
  onApprove: (id: string, notes?: string) => void;
  onDispatch: (id: string) => void;
}

export const WorkOrderDetailModal: React.FC<WorkOrderDetailModalProps> = ({
  workOrder,
  onClose,
  onApprove,
  onDispatch,
}) => {
  if (!workOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-sm text-slate-900">{workOrder.id}</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-blue-700 font-semibold">{workOrder.engineId}</span>
              </div>
              <p className="text-xs text-slate-500">Maintenance Dispatch Order &amp; Isolation Protocol</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Print Order Sheet"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Machine & Estimate Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500 text-[11px] block font-medium">Assigned Asset</span>
              <span className="text-xs font-bold text-slate-900">{workOrder.engineId}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block font-medium">Remaining Life</span>
              <span className="text-xs font-bold text-slate-900 font-mono tabular-nums">{workOrder.predictedRUL} Cycles</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block font-medium">Est. Downtime</span>
              <span className="text-xs font-bold text-slate-900 font-mono tabular-nums">{workOrder.estimatedDowntimeHours} Hours</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block font-medium">Est. Parts Cost</span>
              <span className="text-xs font-bold text-emerald-700 font-mono tabular-nums">${workOrder.estimatedCost.toLocaleString()}</span>
            </div>
          </div>

          {/* Diagnosed Subsystem Mode */}
          <div className="space-y-1.5">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Diagnosed Failure Signature</span>
            <div className="text-sm font-bold text-slate-900">{workOrder.primaryFailureMode}</div>
            <p className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed">
              {workOrder.agentTriggerReason}
            </p>
          </div>

          {/* Action Directive */}
          <div className="space-y-1.5">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Action Protocol</span>
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 leading-relaxed text-xs">
              {workOrder.actionRequired}
            </div>
          </div>

          {/* Required Parts List */}
          <div className="space-y-2">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Parts Requisition Package</span>
            <div className="space-y-1.5">
              {workOrder.requiredParts.map((part, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2 text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{part}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">1 Service Kit</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment & Routing */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block font-medium">Lead Field Technician</span>
              <span className="text-slate-900 font-bold">{workOrder.assignedTechnician}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block font-medium">Workflow Status</span>
              <span className="text-blue-700 font-bold">{workOrder.status}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {workOrder.isException && workOrder.status === 'PENDING_APPROVAL' ? (
              <span className="text-amber-800 font-semibold">Supervisor approval required for safety isolation</span>
            ) : (
              <span className="text-emerald-700 font-medium">Certified for depot dispatch</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {workOrder.status === 'PENDING_APPROVAL' && (
              <button
                onClick={() => {
                  onApprove(workOrder.id, 'Approved via Order Detail');
                  onClose();
                }}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors"
              >
                Sign &amp; Approve
              </button>
            )}
            {workOrder.status === 'APPROVED' && (
              <button
                onClick={() => {
                  onDispatch(workOrder.id);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors"
              >
                Dispatch Order
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
