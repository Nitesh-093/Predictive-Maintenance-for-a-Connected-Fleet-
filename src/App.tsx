/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Header } from './components/Header';
import { FleetMonitor } from './components/FleetMonitor';
import { ArchitectureView } from './components/ArchitectureView';
import { DataEngineeringView } from './components/DataEngineeringView';
import { ModelEvaluationView } from './components/ModelEvaluationView';
import { TriageAgentView } from './components/TriageAgentView';
import { MLOpsCenter } from './components/MLOpsCenter';
import { WorkOrderDetailModal } from './components/WorkOrderDetailModal';
import { FleetVoiceAssistantModal } from './components/FleetVoiceAssistantModal';
import { EngineData, ModelVersion, RetrainingLog, WorkOrder } from './types/fleet';
import { initializeFleet, generateMachineRun } from './data/cmapssData';
import { INITIAL_MODEL_VERSIONS, INITIAL_RETRAINING_LOGS } from './services/mlopsRegistry';
import { generateWorkOrder } from './services/triageAgent';
import { predictRUL } from './services/mlModels';
import {
  callPythonRetrainPipeline,
  callPythonFetchModels,
  callPythonGenerateWorkOrder,
} from './services/backendApi';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('fleet');
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [fleet, setFleet] = useState<EngineData[]>(() => initializeFleet());
  const [selectedEngineId, setSelectedEngineId] = useState<string>('TRK-101');
  const [selectedModelId, setSelectedModelId] = useState<string>('gbdt');
  
  const [activeWorkOrderForModal, setActiveWorkOrderForModal] = useState<WorkOrder | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);

  const [modelVersions, setModelVersions] = useState<ModelVersion[]>(INITIAL_MODEL_VERSIONS);
  const [retrainingLogs, setRetrainingLogs] = useState<RetrainingLog[]>(INITIAL_RETRAINING_LOGS);
  const [isRetraining, setIsRetraining] = useState<boolean>(false);

  // Initial work orders
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    const initialFleet = initializeFleet();
    const truck1 = initialFleet.find((e) => e.engineId === 'TRK-101')!;
    const bus1 = initialFleet.find((e) => e.engineId === 'BUS-204')!;
    const comp1 = initialFleet.find((e) => e.engineId === 'CMP-309')!;

    const wo1 = generateWorkOrder(truck1, predictRUL(truck1.history));
    wo1.status = 'PENDING_APPROVAL';
    wo1.isException = true;
    wo1.exceptionReason = 'P1 Safety Isolation: RUL < 20 cycles with severe vibration and motor current surge. Human supervisor sign-off required to ground truck.';

    const wo2 = generateWorkOrder(bus1, predictRUL(bus1.history));
    wo2.status = 'DISPATCHED';
    wo2.isException = false;

    const wo3 = generateWorkOrder(comp1, predictRUL(comp1.history));
    wo3.status = 'PENDING_APPROVAL';
    wo3.isException = true;
    wo3.exceptionReason = 'Bearing Thermal Overheat: Severe discharge pressure deficit on petrochemical gas line. Emergency isolation sign-off needed.';

    return [wo1, wo2, wo3];
  });

  // Telemetry stream simulation timer
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      setFleet((prevFleet) => {
        return prevFleet.map((eng) => {
          if (eng.currentCycle >= eng.maxHistoricalCycle) return eng;

          const nextCycle = eng.currentCycle + 1;
          const updated = generateMachineRun(
            eng.engineId,
            eng.maxHistoricalCycle,
            nextCycle,
            eng.fleetType,
            eng.modelDesignation,
            eng.operatingCondition
          );

          // Check if newly crossed critical threshold (< 20 cycles) and no work order yet
          if (updated.predictedRUL < 20 && !workOrders.some((w) => w.engineId === eng.engineId && w.status !== 'COMPLETED')) {
            const autoWO = generateWorkOrder(updated, predictRUL(updated.history));
            setWorkOrders((prev) => [autoWO, ...prev]);
          }

          return updated;
        });
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isStreaming, workOrders]);

  // Step cycle manually
  const handleStepCycle = (engineId: string, stepCount: number) => {
    setFleet((prev) =>
      prev.map((eng) => {
        if (eng.engineId !== engineId) return eng;
        const targetCycle = Math.min(eng.maxHistoricalCycle, eng.currentCycle + stepCount);
        return generateMachineRun(eng.engineId, eng.maxHistoricalCycle, targetCycle, eng.fleetType, eng.modelDesignation, eng.operatingCondition);
      })
    );
  };

  // Reset machine run
  const handleResetEngine = (engineId: string) => {
    setFleet((prev) =>
      prev.map((eng) => {
        if (eng.engineId !== engineId) return eng;
        return generateMachineRun(eng.engineId, eng.maxHistoricalCycle, 20, eng.fleetType, eng.modelDesignation, eng.operatingCondition);
      })
    );
  };

  // Trigger triage & work order from fleet view
  const handleTriggerTriage = (engine: EngineData) => {
    const prediction = predictRUL(engine.history, selectedModelId);
    const newWO = generateWorkOrder(engine, prediction);
    setWorkOrders((prev) => [newWO, ...prev]);
    setCurrentTab('work_orders');
  };

  // Work order approve (Human-in-the-loop exception sign-off)
  const handleApproveWorkOrder = (id: string, notes?: string) => {
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === id ? { ...wo, status: 'APPROVED', approvalNotes: notes || 'Signed off by Lead Maintenance Supervisor' } : wo
      )
    );
  };

  // Work order dispatch
  const handleDispatchWorkOrder = (id: string) => {
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === id ? { ...wo, status: 'DISPATCHED' } : wo
      )
    );
  };

  // Create new work order
  const handleCreateWorkOrder = (newWO: WorkOrder) => {
    setWorkOrders((prev) => [newWO, ...prev]);
  };

  // Sync models from Python backend on load
  useEffect(() => {
    callPythonFetchModels().then((data) => {
      if (data && data.models && data.models.length > 0) {
        setModelVersions(data.models);
        if (data.logs && data.logs.length > 0) {
          setRetrainingLogs(data.logs);
        }
      }
    });
  }, []);

  // Retraining simulation execution via Python backend
  const handleTriggerRetraining = async () => {
    setIsRetraining(true);

    try {
      const pythonResult = await callPythonRetrainPipeline('Automated Streaming Telemetry Batch Ingestion');
      if (pythonResult && pythonResult.newVersion && pythonResult.retrainingLog) {
        setModelVersions(pythonResult.models);
        setRetrainingLogs(pythonResult.logs);
        setIsRetraining(false);
        return;
      }
    } catch (err) {
      console.warn('Python backend retrain error, using client fallback:', err);
    }

    await new Promise((r) => setTimeout(r, 1200));

    const newVersion: ModelVersion = {
      version: 'v1.3.0',
      modelFamily: 'Gradient Boosted Trees (Python/LightGBM)',
      status: 'Production',
      trainedAt: new Date().toISOString(),
      rmse: 13.94,
      mae: 10.42,
      r2: 0.902,
      nasaScore: 432.1,
      driftStatus: 'Stable',
      hyperparameters: {
        max_depth: 6,
        n_estimators: 180,
        learning_rate: 0.045,
        subsample: 0.88,
      },
    };

    const newLog: RetrainingLog = {
      runId: `RUN-${Date.now().toString().slice(-8)}`,
      timestamp: new Date().toISOString(),
      triggeredBy: 'Automated Streaming Telemetry Batch Ingestion',
      dataPointsIngested: 3200,
      previousRMSE: 14.82,
      newRMSE: 13.94,
      deltaPercent: -5.94,
      status: 'SUCCESS',
      artifactsSaved: ['model_artifact_v1.3.0.joblib', 'pipeline_config.json', 'drift_post_check.json'],
    };

    setModelVersions((prev) => [
      newVersion,
      ...prev.map((m) => (m.status === 'Production' ? { ...m, status: 'Challenger' as const } : m)),
    ]);
    setRetrainingLogs((prev) => [newLog, ...prev]);
    setIsRetraining(false);
  };

  const selectedEngine = fleet.find((e) => e.engineId === selectedEngineId) || fleet[0];
  const pendingExceptionsCount = workOrders.filter((w) => w.isException && w.status === 'PENDING_APPROVAL').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isStreaming={isStreaming}
        setIsStreaming={setIsStreaming}
        activeWorkOrdersCount={workOrders.length}
        pendingExceptionsCount={pendingExceptionsCount}
        onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'fleet' && (
          <FleetMonitor
            fleet={fleet}
            selectedEngineId={selectedEngineId}
            onSelectEngine={setSelectedEngineId}
            onStepCycle={handleStepCycle}
            onResetEngine={handleResetEngine}
            onTriggerTriage={handleTriggerTriage}
            isStreaming={isStreaming}
            setIsStreaming={setIsStreaming}
          />
        )}

        {currentTab === 'closed_loop' && <ArchitectureView />}

        {currentTab === 'degradation' && (
          <div className="space-y-6">
            <ModelEvaluationView
              engine={selectedEngine}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
            />
            <DataEngineeringView engine={selectedEngine} />
          </div>
        )}

        {currentTab === 'work_orders' && (
          <TriageAgentView
            engine={selectedEngine}
            workOrders={workOrders}
            onApproveWorkOrder={handleApproveWorkOrder}
            onDispatchWorkOrder={handleDispatchWorkOrder}
            onCreateWorkOrder={handleCreateWorkOrder}
            onSelectWorkOrderForModal={setActiveWorkOrderForModal}
          />
        )}

        {currentTab === 'mlops' && (
          <MLOpsCenter
            modelVersions={modelVersions}
            retrainingLogs={retrainingLogs}
            onTriggerRetraining={handleTriggerRetraining}
            isRetraining={isRetraining}
          />
        )}
      </main>

      {/* Operational Footer */}
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">Connected Fleet Predictive Maintenance</span>
            <span className="text-slate-300">·</span>
            <span>Continuous Telemetry: Vibration, Temperature, Current, Pressure, RPM</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-600">
            <span>Closed-Loop Autonomous Dispatch</span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-700 font-semibold">Human-in-the-Loop for Safety Exceptions</span>
          </div>
        </div>
      </footer>

      {/* Work Order Detail Sheet Modal */}
      <WorkOrderDetailModal
        workOrder={activeWorkOrderForModal}
        onClose={() => setActiveWorkOrderForModal(null)}
        onApprove={handleApproveWorkOrder}
        onDispatch={handleDispatchWorkOrder}
      />

      {/* Fleet Condition Voice Assistant Modal (Gemini Live & TTS) */}
      <FleetVoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        fleet={fleet}
        workOrders={workOrders}
      />

      {/* Floating Fleet Advisor Button */}
      <button
        onClick={() => setIsVoiceModalOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center space-x-2.5 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
        title="Open Fleet Operations Advisor"
      >
        <MessageSquare className="w-4 h-4 text-white" />
        <span className="text-xs">Fleet Advisor</span>
      </button>
    </div>
  );
}
