import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { ShieldAlert, Lock, UserCheck, Eye, FileText, CheckCircle2 } from 'lucide-react';

export type UserRole = 'controller' | 'reviewer' | 'read_only';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  title: string;
  role: UserRole;
  avatarInitials: string;
  department: string;
  certifications?: string[];
}

export interface AuthContextType {
  user: AuthUser;
  role: UserRole;
  setRole: (role: UserRole) => void;
  canApprove: boolean;
  canRollback: boolean;
  canRunClose: boolean;
  canComment: boolean;
  isReadOnly: boolean;
  requireController: (actionName: string, onSuccess: () => void) => boolean;
  deniedNotice: { action: string; reason: string } | null;
  clearDeniedNotice: () => void;
  usersByRole: Record<UserRole, AuthUser>;
}

const PRESET_USERS: Record<UserRole, AuthUser> = {
  controller: {
    id: 'usr_controller_01',
    name: 'Elena Rostova, CPA',
    email: 'elena.rostova@acme-saas.com',
    title: 'VP of Finance & Corporate Controller',
    role: 'controller',
    avatarInitials: 'ER',
    department: 'Corporate Accounting',
    certifications: ['CPA (Active)', 'ASC 606 Certified', 'SEC Reporting Fellow'],
  },
  reviewer: {
    id: 'usr_reviewer_02',
    name: 'Marcus Vance',
    email: 'marcus.vance@acme-saas.com',
    title: 'Senior Financial Analyst & Accountant',
    role: 'reviewer',
    avatarInitials: 'MV',
    department: 'FP&A & Revenue Operations',
    certifications: ['CMA Candidate'],
  },
  read_only: {
    id: 'usr_readonly_03',
    name: 'Sarah Sterling',
    email: 's.sterling@altitude-ventures.com',
    title: 'Board Audit Committee Chair & Investor',
    role: 'read_only',
    avatarInitials: 'SS',
    department: 'Board of Directors / Audit Committee',
    certifications: ['Audit Committee Chair'],
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('controller');
  const [deniedNotice, setDeniedNotice] = useState<{ action: string; reason: string } | null>(null);

  const user = PRESET_USERS[role];

  const permissions = useMemo(() => {
    const isCtrl = role === 'controller';
    const isRev = role === 'reviewer';
    const isRO = role === 'read_only';

    return {
      canApprove: isCtrl,
      canRollback: isCtrl,
      canRunClose: isCtrl || isRev,
      canComment: isCtrl || isRev,
      isReadOnly: isRO,
    };
  }, [role]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setDeniedNotice(null);
  };

  const clearDeniedNotice = () => {
    setDeniedNotice(null);
  };

  /**
   * Enforces controller authorization gate.
   * If user has controller permissions, executes onSuccess() and returns true.
   * If user lacks controller permission, triggers authorization denied modal and returns false.
   */
  const requireController = (actionName: string, onSuccess: () => void): boolean => {
    if (permissions.canApprove) {
      onSuccess();
      return true;
    }

    const reason =
      role === 'read_only'
        ? 'Read-only observers (Board Members & External Auditors) have view-only access. Financial statements and journal exceptions cannot be modified or approved.'
        : 'Reviewers can stage adjustments and propose entries, but GAAP compliance requires sign-off from a certified Corporate Controller.';

    setDeniedNotice({
      action: actionName,
      reason,
    });
    return false;
  };

  const contextValue: AuthContextType = {
    user,
    role,
    setRole,
    ...permissions,
    requireController,
    deniedNotice,
    clearDeniedNotice,
    usersByRole: PRESET_USERS,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}

      {/* Global Access Denied Security Modal */}
      {deniedNotice && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f131c] border border-red-900/60 rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-700/80 flex items-center justify-center mb-4 text-red-400">
              <Lock className="w-6 h-6" />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 bg-red-950/90 px-2 py-0.5 rounded border border-red-800/80">
                Authorization Gate Enforced
              </span>
              <span className="text-xs text-slate-400 font-mono">Role: {user.title}</span>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Action Blocked: {deniedNotice.action}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-4 font-mono bg-[#141926] p-3 rounded border border-neutral-800">
              {deniedNotice.reason}
            </p>

            <div className="space-y-2 mb-5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Internal Controls Policy: Dual-sign-off SOX/GAAP separation.</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Switch to <strong>Controller (Elena Rostova, CPA)</strong> in the top-right menu to exercise approval rights.</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setRole('controller');
                  clearDeniedNotice();
                }}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>Switch to Controller Role</span>
              </button>
              <button
                onClick={clearDeniedNotice}
                className="py-2 px-4 bg-neutral-800 hover:bg-neutral-700 text-slate-300 text-xs rounded transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * ControllerGate Component:
 * Conditionally renders children if the active role is Controller.
 * Otherwise, renders an accessible disabled state or informative fallback.
 */
export function ControllerGate({
  children,
  fallback,
  actionName = 'Controller Approval',
}: {
  children: ReactNode;
  fallback?: ReactNode;
  actionName?: string;
}) {
  const { canApprove, role, requireController } = useAuth();

  if (canApprove) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <div
      onClick={() => requireController(actionName, () => {})}
      className="inline-flex cursor-not-allowed opacity-60 hover:opacity-100 transition-opacity"
      title={`Restricted to Controller role (current role: ${role})`}
    >
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}
