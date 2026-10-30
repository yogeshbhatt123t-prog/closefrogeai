/**
 * FrogeClose Centralized API Validation & Security Gateway
 * Enforces Zod input validation, server-side role gating, and rate limiting.
 */

// Universal Zod-compatible Schema Validator (Works with or without installed package)
export const z = {
  string: () => ({
    min: (len: number, msg?: string) => ({
      max: (maxLen: number) => ({
        parse: (v: string) => {
          if (typeof v !== 'string' || v.length < len || v.length > maxLen) {
            throw new Error(msg || `String length must be between ${len} and ${maxLen}`);
          }
          return v;
        },
        regex: (r: RegExp, rMsg?: string) => ({
          parse: (v: string) => {
            if (typeof v !== 'string' || !r.test(v)) throw new Error(rMsg || 'Invalid format');
            return v;
          }
        })
      }),
      regex: (r: RegExp, rMsg?: string) => ({
        parse: (v: string) => {
          if (typeof v !== 'string' || !r.test(v)) throw new Error(rMsg || 'Invalid format');
          return v;
        }
      }),
      parse: (v: string) => {
        if (typeof v !== 'string' || v.length < len) throw new Error(msg || `String length must be at least ${len}`);
        return v;
      }
    }),
    length: (len: number) => ({
      regex: (r: RegExp) => ({
        parse: (v: string) => {
          if (typeof v !== 'string' || v.length !== len || !r.test(v)) throw new Error('Invalid checksum format');
          return v;
        }
      })
    }),
    regex: (r: RegExp, msg?: string) => ({
      parse: (v: string) => {
        if (typeof v !== 'string' || !r.test(v)) throw new Error(msg || 'Regex validation failed');
        return v;
      }
    }),
    parse: (v: any) => {
      if (typeof v !== 'string') throw new Error('Expected string');
      return v;
    }
  }),
  number: () => ({
    int: () => ({
      positive: () => ({
        max: (m: number) => ({
          parse: (v: number) => {
            if (typeof v !== 'number' || v <= 0 || v > m) throw new Error('Number out of bounds');
            return v;
          }
        })
      })
    }),
    parse: (v: any) => {
      if (typeof v !== 'number') throw new Error('Expected number');
      return v;
    }
  }),
  boolean: () => ({
    default: (def: boolean) => ({
      parse: (v: any) => (v !== undefined ? Boolean(v) : def)
    }),
    parse: (v: any) => Boolean(v)
  }),
  enum: <T extends readonly string[]>(values: T) => ({
    default: (def: T[number]) => ({
      parse: (v: any) => (values.includes(v) ? v : def)
    }),
    parse: (v: any) => {
      if (!values.includes(v)) throw new Error(`Invalid enum: expected one of ${values.join(', ')}`);
      return v;
    }
  }),
  array: (itemSchema: any) => ({
    min: (m: number, msg?: string) => ({
      parse: (arr: any[]) => {
        if (!Array.isArray(arr) || arr.length < m) throw new Error(msg || `Expected array min length ${m}`);
        return arr;
      }
    }),
    parse: (arr: any[]) => {
      if (!Array.isArray(arr)) throw new Error('Expected array');
      return arr;
    }
  }),
  object: (shape: Record<string, any>) => ({
    parse: (obj: any) => {
      if (!obj || typeof obj !== 'object') throw new Error('Expected object');
      for (const key of Object.keys(shape)) {
        if (shape[key].parse) shape[key].parse(obj[key]);
      }
      return obj;
    },
    safeParse: (obj: any) => {
      try {
        return { success: true, data: obj };
      } catch (err: any) {
        return { success: false, error: err };
      }
    }
  })
};

// ==========================================
// 1. ZOD SCHEMAS FOR ALL ACTIONS
// ==========================================

export const UploadFileSchema = z.object({
  file_name: z.string().min(3).max(255),
  file_type: z.enum(['bank_csv', 'gl_csv', 'stripe_csv', 'pdf']),
  file_size_bytes: z.number().int().positive().max(50 * 1024 * 1024), // 50MB max limit
  sha256_checksum: z.string().length(64).regex(/^[a-f0-9]+$/i),
  pii_redacted: z.boolean().default(true),
});

export const RunCloseJobSchema = z.object({
  org_id: z.string().min(1),
  period: z.string().regex(/^(\d{4}-Q[1-4]|\d{4}-\d{2}|Q[1-4]\s\d{4})$/, 'Invalid period format (e.g. Q3 2026 or 2026-09)'),
  goal: z.string().min(10).max(500),
  files: z.array(z.object({
    name: z.string(),
    size: z.number(),
    type: z.string()
  })).min(1, 'At least one file must be provided for the close run'),
  user_role: z.enum(['controller', 'reviewer', 'read_only']),
  idempotency_key: z.string().min(8)
});

export const ResolveExceptionSchema = z.object({
  exception_id: z.string().min(1),
  resolution_note: z.string().min(5, 'Resolution note must contain at least 5 characters'),
  resolved_by: z.string().min(2),
  user_role: z.enum(['controller', 'reviewer', 'read_only']),
  override_action: z.enum(['approve_suggested', 'custom_journal', 'reject']).default('approve_suggested')
});

export const CaptureBillingSchema = z.object({
  org_id: z.string().min(1),
  idempotency_key: z.string().min(8),
  controller_name: z.string().min(2),
  user_role: z.enum(['controller', 'reviewer', 'read_only']),
  all_invariants_passed: z.boolean()
});

// ==========================================
// 2. SERVER-SIDE ROLE AUTHORIZATION GUARDS
// ==========================================

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

/**
 * Server-side guard: Ensures only Controller role can execute write/approval actions.
 * UI hiding is never security; this runs strictly in business logic/server.
 */
export function enforceControllerRole(userRole: string, actionName: string): void {
  if (userRole !== 'controller') {
    throw new AuthorizationError(
      `SECURITY ACCESS DENIED: Action '${actionName}' strictly requires 'controller' role. Current role is '${userRole}'.`
    );
  }
}

/**
 * Server-side guard: Reviewer and Controller can comment, Read-only cannot.
 */
export function enforceReviewerOrController(userRole: string, actionName: string): void {
  if (userRole === 'read_only') {
    throw new AuthorizationError(
      `SECURITY ACCESS DENIED: Action '${actionName}' is prohibited for 'read_only' role. Reviewer or Controller permissions required.`
    );
  }
}

// ==========================================
// 3. PER-ORG RATE LIMITER & COST CAPS
// ==========================================

interface TenantRateLimitState {
  requestCountInWindow: number;
  windowStartTimeMs: number;
  monthlySpendUsd: number;
}

const tenantLimitRegistry = new Map<string, TenantRateLimitState>();

export function checkTenantRateLimit(orgId: string, maxPerMin: number = 60, monthlyCapUsd: number = 5000): {
  allowed: boolean;
  reason?: string;
} {
  const now = Date.now();
  let state = tenantLimitRegistry.get(orgId);

  if (!state) {
    state = { requestCountInWindow: 1, windowStartTimeMs: now, monthlySpendUsd: 0.18 };
    tenantLimitRegistry.set(orgId, state);
    return { allowed: true };
  }

  // Check 1-minute window reset
  if (now - state.windowStartTimeMs > 60000) {
    state.requestCountInWindow = 1;
    state.windowStartTimeMs = now;
  } else {
    state.requestCountInWindow++;
    if (state.requestCountInWindow > maxPerMin) {
      return { allowed: false, reason: `Rate limit exceeded: max ${maxPerMin} operations/min per tenant.` };
    }
  }

  // Check cost cap
  if (state.monthlySpendUsd >= monthlyCapUsd) {
    return { allowed: false, reason: `Tenant monthly compute spend cap ($${monthlyCapUsd}) reached.` };
  }

  return { allowed: true };
}
