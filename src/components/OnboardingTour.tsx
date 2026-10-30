import React, { useEffect, useReducer } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  FileSpreadsheet,
  AlertCircle,
  ShieldCheck,
  BarChart3,
  FileText,
  Lock,
  Play,
  CheckCircle2,
  Cpu
} from 'lucide-react';

export type TourStepKey =
  | 'goal_input'
  | 'reconciliation'
  | 'exceptions'
  | 'verification'
  | 'variance'
  | 'statements'
  | 'audit_safety';

export interface TourStepDefinition {
  key: TourStepKey;
  stepNumber: number;
  title: string;
  badge: string;
  targetTab: 'memo' | 'pnl' | 'variance' | 'reconciliation' | 'exceptions' | 'verification' | 'audit';
  headline: string;
  description: string;
  proTip: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const TOUR_STEPS: TourStepDefinition[] = [
  {
    key: 'goal_input',
    stepNumber: 1,
    title: 'Autonomous Goal Declaration',
    badge: 'YC Wedge: End of Screen Time',
    targetTab: 'memo',
    headline: 'Define the desired outcome once. The agent handles the rest.',
    description:
      'Instead of spending 7 days clicking through ERP menus, controllers write or select high-level outcomes: "Reconcile Stripe and SVB bank deposits against NetSuite GL, recognize ASC 606 ratable revenue, and generate the board deck." CloseRun autonomously plans, executes, and surfaces only exceptions.',
    proTip: 'Outcome-based model: Companies pay per successful close rather than seat licenses.',
    icon: Cpu,
    accentColor: 'text-emerald-400',
  },
  {
    key: 'reconciliation',
    stepNumber: 2,
    title: 'Reconciliation & Instant 5-Row CSV Preview',
    badge: 'Real Data Ingestion',
    targetTab: 'reconciliation',
    headline: 'Real-time schema validation with instant row-level feedback.',
    description:
      'Upload bank feeds (SVB, Mercury, Brex) and General Ledger exports (NetSuite, QuickBooks). As soon as files are uploaded, FrogeClose parses and displays the first 5 rows immediately, confirming debit/credit balance, ISO date formats, and reference IDs.',
    proTip: 'Download our pre-seeded sample CSVs directly from the dashboard to test without external data.',
    icon: FileSpreadsheet,
    accentColor: 'text-emerald-400',
  },
  {
    key: 'exceptions',
    stepNumber: 3,
    title: 'Exception Inbox & Controller Gating',
    badge: 'Human-in-the-Loop',
    targetTab: 'exceptions',
    headline: 'AI only surfaces what truly requires human CPA judgment.',
    description:
      'Transactions with >90% confidence are reconciled automatically. Any entry with an unmatched purchase order, unusual tax jurisdiction, or confidence below 90% routes directly to the Exception Inbox with a pre-drafted proposed classification.',
    proTip: 'The Controller role has exclusive authority to click "Approve All Pending Exceptions" or resolve items.',
    icon: AlertCircle,
    accentColor: 'text-amber-400',
  },
  {
    key: 'verification',
    stepNumber: 4,
    title: 'Deterministic Code Invariants',
    badge: 'Accounting Correctness',
    targetTab: 'verification',
    headline: 'The LLM drafts; deterministic TypeScript code verifies.',
    description:
      'We never allow the LLM to grade its own work. 5 hardcoded mathematical invariants verify the books: Debits equal Credits ($34.59M), Assets equal Liabilities + Equity ($17.29M), subledger ties to cash account 1010, and Account 9999 (Suspense) is zero.',
    proTip: 'Any invariant failure halts the close and alerts the controller immediately.',
    icon: ShieldCheck,
    accentColor: 'text-emerald-400',
  },
  {
    key: 'variance',
    stepNumber: 5,
    title: 'Variance Attribution & Recharts Visualizer',
    badge: 'Visual FP&A',
    targetTab: 'variance',
    headline: 'Instant actual vs. budget comparison with QoQ trend markers.',
    description:
      'Compare actual expenditures against plan across COGS, S&M, R&D, and G&A. Each line includes an automated commentary identifying operational drivers (e.g. GPU token surges, quota over-performance) and directional trend indicators.',
    proTip: 'Toggle between Department view and Category view using the interactive tab switch.',
    icon: BarChart3,
    accentColor: 'text-cyan-400',
  },
  {
    key: 'statements',
    stepNumber: 6,
    title: 'ASC 340-40 Capitalization & Statements',
    badge: 'GAAP Compliance',
    targetTab: 'pnl',
    headline: 'Rigorously modeled commissions amortization & ratable revenue.',
    description:
      'Unlike naive tools, FrogeClose correctly distinguishes between ASC 606 revenue recognition and ASC 340-40 sales commission capitalization. Sales commissions are capitalized on the balance sheet and amortized over 48 months ($15,000/quarter).',
    proTip: 'Check the ASC 340-40 schedule under the Statements tab for the full asset roll-forward.',
    icon: FileText,
    accentColor: 'text-emerald-400',
  },
  {
    key: 'audit_safety',
    stepNumber: 7,
    title: 'Immutable Audit Trail & Instant Rollback',
    badge: 'SOX Trust & Security',
    targetTab: 'audit',
    headline: 'Cryptographic SHA-256 block chaining and one-click rollback.',
    description:
      'Every agent decision, tool execution, and controller approval is recorded in an immutable ledger where each block hashes the prior block. If anything needs revision, the controller can trigger an instant rollback to the pre-close baseline.',
    proTip: 'Switch roles in the top-right header to test Controller, Reviewer, and Read-only permission gates.',
    icon: Lock,
    accentColor: 'text-cyan-400',
  },
];

// --- TOUR STATE MACHINE REDUCER ---
export type TourAction =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'JUMP_TO_STEP'; stepIndex: number }
  | { type: 'DISMISS' };

export interface TourState {
  isActive: boolean;
  currentIndex: number;
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START':
      return { isActive: true, currentIndex: 0 };
    case 'NEXT':
      if (state.currentIndex >= TOUR_STEPS.length - 1) {
        return { isActive: false, currentIndex: 0 };
      }
      return { ...state, currentIndex: state.currentIndex + 1 };
    case 'PREV':
      return {
        ...state,
        currentIndex: Math.max(0, state.currentIndex - 1),
      };
    case 'JUMP_TO_STEP':
      return {
        isActive: true,
        currentIndex: Math.max(0, Math.min(TOUR_STEPS.length - 1, action.stepIndex)),
      };
    case 'DISMISS':
      return { isActive: false, currentIndex: 0 };
    default:
      return state;
  }
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tab: any) => void;
}

export function OnboardingTour({ isOpen, onClose, onTabChange }: OnboardingTourProps) {
  const [state, dispatch] = useReducer(tourReducer, {
    isActive: isOpen,
    currentIndex: 0,
  });

  // Sync open state
  useEffect(() => {
    if (isOpen && !state.isActive) {
      dispatch({ type: 'START' });
    } else if (!isOpen && state.isActive) {
      dispatch({ type: 'DISMISS' });
    }
  }, [isOpen]);

  const currentStep = TOUR_STEPS[state.currentIndex];

  // Whenever step changes, switch the active app tab to showcase the highlighted component!
  useEffect(() => {
    if (state.isActive && currentStep) {
      onTabChange(currentStep.targetTab);
    }
  }, [state.isActive, state.currentIndex, currentStep, onTabChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!state.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'DISMISS' });
        onClose();
      } else if (e.key === 'ArrowRight') {
        dispatch({ type: 'NEXT' });
      } else if (e.key === 'ArrowLeft') {
        dispatch({ type: 'PREV' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isActive, onClose]);

  if (!state.isActive || !currentStep) return null;

  const isFirst = state.currentIndex === 0;
  const isLast = state.currentIndex === TOUR_STEPS.length - 1;
  const StepIcon = currentStep.icon;

  const handleNext = () => {
    if (isLast) {
      dispatch({ type: 'DISMISS' });
      onClose();
    } else {
      dispatch({ type: 'NEXT' });
    }
  };

  const handlePrev = () => {
    dispatch({ type: 'PREV' });
  };

  const handleClose = () => {
    dispatch({ type: 'DISMISS' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end sm:items-center justify-center p-4">
      {/* Dimmed backdrop with highlight focus */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-[2px] pointer-events-auto transition-opacity"
      />

      {/* Floating State Machine Tour Card */}
      <div className="relative pointer-events-auto bg-[#0d111a] border border-neutral-700/80 rounded-xl shadow-2xl max-w-xl w-full p-6 text-slate-100 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header & Progress */}
        <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-950 border border-emerald-700/80 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
              {currentStep.stepNumber}
            </span>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Interactive Onboarding Tour ({state.currentIndex + 1} / {TOUR_STEPS.length})
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161c2b] text-slate-300 border border-neutral-700">
              {currentStep.badge}
            </span>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-neutral-800 transition-colors"
              title="Close tour (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-4">
          <div
            className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full transition-all duration-300 ease-out"
            style={{
              width: `${((state.currentIndex + 1) / TOUR_STEPS.length) * 100}%`,
            }}
          />
        </div>

        {/* Step Content */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-[#141a27] border border-neutral-700/70 text-emerald-400 shrink-0 mt-0.5">
              <StepIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {currentStep.title}
              </h3>
              <p className="text-xs text-emerald-400 font-mono mt-0.5">
                {currentStep.headline}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#121622] p-3 rounded-lg border border-neutral-800">
            {currentStep.description}
          </p>

          {/* Pro Tip Box */}
          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-emerald-950/30 border border-emerald-900/40 p-2.5 rounded-md font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-emerald-300">CPA / YC Insight:</strong> {currentStep.proTip}
            </span>
          </div>
        </div>

        {/* Quick Step Indicators */}
        <div className="flex items-center justify-center gap-1.5 my-4">
          {TOUR_STEPS.map((step, idx) => (
            <button
              key={step.key}
              onClick={() => dispatch({ type: 'JUMP_TO_STEP', stepIndex: idx })}
              className={`h-2 rounded-full transition-all ${
                idx === state.currentIndex
                  ? 'w-6 bg-emerald-400'
                  : 'w-2 bg-neutral-700 hover:bg-neutral-500'
              }`}
              title={`Jump to step ${idx + 1}: ${step.title}`}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-800">
          <button
            onClick={handleClose}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-mono"
          >
            Skip Tour (Esc)
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 text-xs bg-[#141926] hover:bg-[#1c2336] text-slate-300 border border-neutral-700 rounded transition-colors flex items-center gap-1 font-mono"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
            >
              <span>{isLast ? 'Finish Tour & Get Started' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
