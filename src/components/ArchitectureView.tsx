import React, { useState } from 'react';
import { 
  Database, Cpu, GitBranch, ShieldCheck, Wrench, 
  ArrowRight, CheckCircle2, UserCheck, Activity, Terminal
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);

  const stages = [
    {
      id: 0,
      title: '1. Continuous Telemetry Ingestion',
      subtitle: 'IoT Sensor Stream Layer',
      icon: Database,
      channels: 'Vibration · Temperature · Motor Current · Pressure · RPM',
      description: 'Continuous real-time ingestion from connected trucks, transit buses, and compressors. Eliminates blind spots between calendar service intervals.',
      highlights: [
        'Ingests continuous high-frequency streams across mechanical, thermal, electrical, fluid, and rotational axes.',
        'Asynchronous ring buffering handles streaming packets from heterogeneous mobile assets with zero data loss.',
        'Maintains running baselines per machine class (heavy freight haulers vs. transit buses vs. industrial compressors).',
      ],
      codeExcerpt: `# Ingestion of continuous telemetry stream
def ingest_telemetry_packet(machine_id, telemetry):
    stream_buffer[machine_id].append({
        'vibration': telemetry.vibration_rms,    # mm/s
        'temperature': telemetry.bearing_temp_c, # °C
        'current': telemetry.motor_current_amps, # Amps
        'pressure': telemetry.fluid_pressure_psi,# PSI
        'rpm': telemetry.rotational_rpm,         # RPM
    })
    return trigger_degradation_pipeline(machine_id)`,
    },
    {
      id: 1,
      title: '2. Signal Conditioning & Rolling Features',
      subtitle: 'Data Engineering Layer',
      icon: Cpu,
      channels: 'Noise Filtering · Rolling Mean & Variance · Rate-of-Change',
      description: 'Cleans raw streaming signals to remove transient transmission spikes and derives rolling window statistical features.',
      highlights: [
        '3-point temporal median filter eliminates spurious dropouts without introducing artificial phase lag.',
        'Missing value forward-fill preserves continuous mechanical state across momentary cellular disconnects.',
        'Sliding windows (15–30 cycles) extract trend velocity (delta x = x[t] - x[t-W]), rolling standard deviation, and exponential moving averages.',
      ],
      codeExcerpt: `# Rolling window feature extraction
def extract_rolling_features(history, window=15):
    features = {}
    for ch in ['vibration', 'temperature', 'motorCurrent', 'pressure', 'rpm']:
        slice_vals = history[ch].tail(window)
        features[f'{ch}_mean'] = slice_vals.mean()
        features[f'{ch}_std'] = slice_vals.std()
        features[f'{ch}_velocity'] = slice_vals.iloc[-1] - slice_vals.iloc[0]
        features[f'{ch}_ema'] = slice_vals.ewm(span=window).mean().iloc[-1]
    return features`,
    },
    {
      id: 2,
      title: '3. Degradation Detection & RUL Regression',
      subtitle: 'Machine Learning Layer',
      icon: GitBranch,
      channels: 'Multi-Sensor Anomaly Envelope · Piecewise Degradation Curve',
      description: 'Evaluates multi-sensor wear trajectories to detect early degradation onset and forecast Remaining Useful Life (RUL).',
      highlights: [
        'Composite Mahalanobis envelope flags subtle abnormal divergence long before physical breakdown.',
        'Piecewise linear target formulation models initial healthy plateau followed by accelerated wear progression.',
        'Gradient Boosted Decision Trees (XGBoost/LightGBM) provide reliable cycle-by-cycle predictions with low inference latency.',
      ],
      codeExcerpt: `# Multi-sensor anomaly & RUL prediction
def evaluate_degradation_and_rul(features):
    anomaly_score = compute_mahalanobis_envelope(features)
    predicted_rul = model_ensemble.predict(features)
    return {
        'predicted_rul': max(0, int(predicted_rul)),
        'anomaly_score': anomaly_score,
        'requires_action': anomaly_score > 0.40 or predicted_rul < 85
    }`,
    },
    {
      id: 3,
      title: '4. Autonomous Work Order Dispatch',
      subtitle: 'Closed-Loop Triage Layer',
      icon: Wrench,
      channels: 'Zero Manual Step Maintenance Dispatch',
      description: 'Deterministic rule-based agent maps model outputs directly into prioritized maintenance actions and spare parts packages.',
      highlights: [
        'Automated priority assignment: Routine Service (P4), Scheduled Turnaround (P3), 48h Inspection (P2), Emergency Isolation (P1).',
        'Auto-identifies degraded subsystem (bearings, screw rotor, electric inverter, seals) and reserves matching part kits.',
        'Assigns qualified technician and dispatches to hangar/depot without manual paperwork.',
      ],
      codeExcerpt: `# Autonomous work order generation
def auto_generate_work_order(machine, rul, anomaly):
    decision = triage_rule_matrix.evaluate(rul, anomaly)
    return create_work_order(
        machine_id=machine.id,
        priority=decision.priority,
        action=decision.action_required,
        parts=decision.required_parts,
        technician=decision.assigned_specialist,
        is_exception=decision.requires_human_approval
    )`,
    },
    {
      id: 4,
      title: '5. Supervisor Exception Approval Gate',
      subtitle: 'Human-in-the-Loop Safety Layer',
      icon: UserCheck,
      channels: 'Human Steps in ONLY for Exceptions',
      description: 'Standard maintenance executes with zero human friction; supervisors intervene strictly to certify safety-critical grounding decisions.',
      highlights: [
        'Over 90% of routine and planned maintenance orders flow through automatically without administrative overhead.',
        'Human supervisor review is required strictly when RUL < 20 cycles (Emergency Machine Grounding) or sensor channels conflict.',
        'Enforces accountability, safety compliance, and operator trust while eliminating manual maintenance scheduling.',
      ],
      codeExcerpt: `# Human intervention strictly for exceptions
def route_work_order(work_order):
    if not work_order.is_exception:
        dispatch_to_hangar_bay(work_order)
        order_parts_from_inventory(work_order.parts)
    else:
        notify_lead_supervisor(
            reason=work_order.exception_reason,
            order=work_order,
            requires_signoff=True
        )`,
    },
  ];

  const current = stages[activeStep];
  const Icon = current.icon;

  return (
    <div className="space-y-6">
      {/* Header Description */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900">System Architecture &amp; Closed-Loop Closed Workflow</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
          The end-to-end closed-loop pipeline continuously ingests sensor streams from connected fleet assets, detects early wear signatures, predicts remaining life, and automatically dispatches maintenance orders — with engineering supervisors stepping in strictly for safety-critical exceptions.
        </p>
      </div>

      {/* 5-Step Progress Stepper */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 mb-6">
          {stages.map((st, idx) => {
            const StageIcon = st.icon;
            const isSelected = activeStep === idx;
            return (
              <button
                key={st.id}
                onClick={() => setActiveStep(idx)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    <StageIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Phase {idx + 1}</span>
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">{st.title.split('. ')[1]}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{st.subtitle}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Panel */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{current.title}</h4>
                <span className="text-xs text-slate-500">{current.subtitle}</span>
              </div>
            </div>
            <div className="text-xs text-blue-700 font-semibold bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              {current.channels}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">{current.description}</p>
              <div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-2">Key Operational Rules:</span>
                <ul className="space-y-2">
                  {current.highlights.map((h, i) => (
                    <li key={i} className="flex items-start space-x-2 text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-xs shadow-xs text-slate-100">
              <div className="text-xs font-bold text-slate-200 pb-2 mb-2 border-b border-slate-800 flex items-center justify-between">
                <span>Executable Pipeline Logic</span>
                <span className="text-[10px] text-slate-400 font-normal">Python 3</span>
              </div>
              <pre className="text-[11px] text-emerald-400/90 overflow-x-auto leading-relaxed">
                {current.codeExcerpt}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
