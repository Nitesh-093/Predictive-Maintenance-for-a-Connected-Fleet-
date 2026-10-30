import React from 'react';
import { X, ExternalLink, Download, FileText, CheckCircle2, Award } from 'lucide-react';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const pdfUrl = '/assets/aistudio/Case_Study_1_ACTG_Predictive_Maintenance_c0f78def.pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Tata Elxsi TELIPORT Season 4 — Case Study 1 Specification
                <span className="text-xs font-normal text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                  Official Brief
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                "Self-Healing Machines: Predictive Maintenance for a Connected Fleet"
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={pdfUrl}
              download="Case_Study_1_ACTG_Predictive_Maintenance.pdf"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split view with Quick Summary & PDF Iframe */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950">
          {/* Left summary checklist */}
          <div className="w-full lg:w-80 bg-slate-900/60 border-r border-slate-800 p-4 overflow-y-auto text-xs space-y-4">
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                <Award className="w-4 h-4" />
                <span>Round Deliverables</span>
              </div>
              <ul className="text-slate-300 space-y-1.5 list-disc list-inside text-[11px]">
                <li><strong className="text-white">Round 1 (Design deck):</strong> Architecture diagram, data cleaning, ML model choice, triage logic.</li>
                <li><strong className="text-white">Round 2 (PoC):</strong> Working pipeline, RUL predictions, live monitoring dashboard, triage agent auto work orders, demo retraining run.</li>
              </ul>
            </div>

            <div>
              <h4 className="text-slate-300 font-semibold uppercase tracking-wider text-[11px] mb-2">Ground Rules Checked</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Handle imbalance:</strong> Failures are less common than normal cycles.</span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>End-to-end automation:</strong> Zero manual intervention required once sensor stream is active.</span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Lightweight (No LLM):</strong> Triage agent uses deterministic rule logic and thresholds.</span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>NASA C-MAPSS:</strong> Standard 21 sensors + 3 operating settings on FD001-FD004.</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-950/40 p-3 rounded-lg border border-blue-900/60">
              <span className="text-[11px] text-blue-300 font-medium block mb-1">Interactive App Built</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                This app fully implements all 4 layers (Data Engineering, Machine Learning, MLOps, Non-LLM Triage Agent) with live simulation, benchmark model comparisons, and automated work orders.
              </p>
            </div>
          </div>

          {/* Right: Embedded PDF viewer */}
          <div className="flex-1 bg-slate-900 relative">
            <iframe
              src={`${pdfUrl}#toolbar=1`}
              title="Case Study Document"
              className="w-full h-full border-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
