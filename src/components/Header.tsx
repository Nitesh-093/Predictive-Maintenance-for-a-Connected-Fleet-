/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, ShieldAlert, Cpu, RefreshCw, GitBranch, MessageSquare } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  activeWorkOrdersCount: number;
  pendingExceptionsCount: number;
  onOpenVoiceAssistant: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  isStreaming,
  setIsStreaming,
  pendingExceptionsCount,
  onOpenVoiceAssistant,
}) => {
  const tabs = [
    { id: 'fleet', label: 'Fleet Overview', icon: Activity },
    { id: 'degradation', label: 'Diagnostics & RUL', icon: Cpu },
    { id: 'work_orders', label: 'Work Orders', icon: ShieldAlert, badge: pendingExceptionsCount },
    { id: 'closed_loop', label: 'System Architecture', icon: GitBranch },
    { id: 'mlops', label: 'Model Retraining', icon: RefreshCw },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Zone */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-slate-900 tracking-tight">FleetPulse</span>
                <span className="text-slate-300 text-xs">/</span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Predictive Fleet Operations</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Continuous Ingestion · Vibration · Temp · Current · Pressure · RPM
              </p>
            </div>
          </div>

          {/* Action Zone */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Live Fleet Advisor Button */}
            <button
              onClick={onOpenVoiceAssistant}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs"
              title="Open Fleet Advisor conversation"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Fleet Advisor</span>
            </button>

            {/* Pending Exceptions Badge (if any) */}
            {pendingExceptionsCount > 0 && (
              <button
                onClick={() => setCurrentTab('work_orders')}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>{pendingExceptionsCount} Exception{pendingExceptionsCount > 1 ? 's' : ''}</span>
              </button>
            )}

            {/* Streaming Toggle */}
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isStreaming
                  ? 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title={isStreaming ? 'Pause real-time stream' : 'Resume real-time stream'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
              <span>{isStreaming ? 'Live' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-100 overflow-x-auto scrollbar-none py-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-3.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
