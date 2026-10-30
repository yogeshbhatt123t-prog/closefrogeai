export type CloseJobStatus = 
  | 'idle' 
  | 'planning' 
  | 'gathering' 
  | 'reconciling' 
  | 'analyzing_variance' 
  | 'drafting_package' 
  | 'self_critiquing' 
  | 'requires_exception_review'
  | 'completed' 
  | 'failed';

export type UserRole = 'controller' | 'external_auditor' | 'board_observer';

export interface Organization {
  id: string;
  name: string;
  domain: string;
  arr_usd: number;
  currency: string;
  fiscal_year_end: string;
  accounting_basis: 'GAAP' | 'IFRS';
  pricing_tier: 'outcome_based';
  outcome_rate_per_close: number;
}

export interface JobStep {
  id: string;
  step_number: number;
  name: string;
  state: CloseJobStatus;
  status: 'pending' | 'running' | 'completed' | 'flagged';
  duration_ms: number;
  tool_invocations: Array<{
    tool: string;
    input: Record<string, any>;
    output: Record<string, any>;
    status: 'success' | 'warn' | 'error';
  }>;
  reasoning: string;
  confidence_score: number; // 0.0 to 1.0
  created_at: string;
}

export interface FinancialMetric {
  name: string;
  current_period: number;
  prior_period: number;
  budget: number;
  variance_pct: number;
  variance_usd: number;
  status: 'favorable' | 'unfavorable' | 'neutral';
  commentary?: string;
}

export interface VarianceItem {
  id: string;
  account_code: string;
  account_name: string;
  category: 'Revenue' | 'COGS' | 'R&D' | 'S&M' | 'G&A';
  actual_amount: number;
  budget_amount: number;
  prior_amount: number;
  variance_amount: number;
  variance_pct: number;
  materiality: 'high' | 'medium' | 'low';
  ai_analysis: string;
  flagged_for_exception: boolean;
}

export interface ExceptionItem {
  id: string;
  title: string;
  source: 'Stripe' | 'Silicon Valley Bank' | 'Brex' | 'NetSuite' | 'Gusto';
  amount: number;
  confidence: number;
  detected_anomaly: string;
  suggested_action: string;
  resolved: boolean;
  resolution_note?: string;
  resolved_by?: string;
}

export interface ASC606Waterfall {
  month: string;
  beginning_deferred_revenue: number;
  new_billings: number;
  recognized_revenue: number;
  ending_deferred_revenue: number;
}

export interface ClosePackage {
  period: string; // e.g. "Q3 2026 (July - September)"
  company_name: string;
  arr: number;
  mrr: number;
  net_retention_rate: number;
  gross_margin_pct: number;
  burn_multiple: number;
  cash_balance: number;
  runway_months: number;
  
  income_statement: {
    revenue: {
      subscription: number;
      usage_services: number;
      total: number;
    };
    cogs: {
      hosting_infrastructure: number;
      support_success: number;
      payment_fees: number;
      total: number;
    };
    gross_profit: number;
    operating_expenses: {
      research_and_development: number;
      sales_and_marketing: number;
      general_and_administrative: number;
      total: number;
    };
    operating_income: number;
    ebitda: number;
    net_income: number;
  };
  
  reconciliation_summary: {
    total_transactions_parsed: number;
    automated_matches_count: number;
    match_rate_pct: number;
    variance_items_flagged: number;
    exceptions_cleared: number;
    unreconciled_delta_usd: number;
    debit_credit_invariant_passed: boolean;
  };

  as606_waterfall: ASC606Waterfall[];
  variances: VarianceItem[];
  exceptions: ExceptionItem[];
  
  executive_board_memo: string;
  outcome_score: number; // 0 to 100
  screen_time_saved_hours: number;
  outcome_based_fee_usd: number;
  legacy_manual_cost_usd: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: 'agent' | 'user' | 'system';
  action: string;
  details: string;
  tool_called?: string;
  hash: string; // SHA-256 integrity simulation
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: 'ASC_606' | 'CHART_OF_ACCOUNTS' | 'CAPITALIZATION' | 'APPROVAL_MATRIX';
  content: string;
  relevance_score?: number;
}
