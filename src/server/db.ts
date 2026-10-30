import { 
  Organization, 
  ClosePackage, 
  AuditLogEntry, 
  KnowledgeDoc, 
  ExceptionItem, 
  VarianceItem, 
  ASC606Waterfall 
} from '../types/finance.ts';

/**
 * FrogeClose Production Database Simulation with pgvector & RLS policies
 * In production this maps directly to PostgreSQL 16 + pgvector extension with RLS.
 */

export const mockOrg: Organization = {
  id: 'org_cloudscale_01',
  name: 'CloudScale Technologies, Inc.',
  domain: 'cloudscale.io',
  arr_usd: 24800000,
  currency: 'USD',
  fiscal_year_end: '12-31',
  accounting_basis: 'GAAP',
  pricing_tier: 'outcome_based',
  outcome_rate_per_close: 1250, // $1,250 per successful closed period
};

export const knowledgeBase: KnowledgeDoc[] = [
  {
    id: 'kb_asc606_01',
    title: 'ASC 606 Multi-Year SaaS Revenue Recognition Policy',
    category: 'ASC_606',
    content: 'CloudScale recognizes annual & multi-year SaaS contracts ratably over the subscription term beginning on the provision date. Implementation fees exceeding $25k are deferred and amortized over estimated 36-month customer lifetime. Overage and consumption-based telemetry fees are recognized in arrears in the month consumed.'
  },
  {
    id: 'kb_cap_02',
    title: 'Software Capitalization (ASC 350-40) Thresholds',
    category: 'CAPITALIZATION',
    content: 'Internal use software development projects are capitalized strictly during the application development stage. Minimum threshold for project capitalization is $50,000 in qualifying internal engineering wages and contractor invoices. Bug fixes, maintenance, and preliminary research are expensed immediately under R&D.'
  },
  {
    id: 'kb_coa_03',
    title: 'Chart of Accounts & Departmental Cost Allocation',
    category: 'CHART_OF_ACCOUNTS',
    content: 'Department 100: Cost of Revenue (AWS production cluster, Datadog prod, Stripe processing 2.2% + 30c, Level 2 Support). Department 200: R&D (Engineering salaries, GitHub Copilot, dev staging VPCs). Department 300: S&M (Sales commissions, HubSpot, paid acquisition, travel for closing). Department 400: G&A (Executive, legal, Rippling, audit fees).'
  },
  {
    id: 'kb_approval_04',
    title: 'Board Expense Authorization & Thresholds',
    category: 'APPROVAL_MATRIX',
    content: 'Any single vendor commitment exceeding $75,000 annually or discretionary non-budgeted expense >$20,000 requires written approval from the Audit Committee chair or CFO. Suspense accounts must be zeroed out prior to final ledger lock.'
  }
];

export const initialExceptions: ExceptionItem[] = [
  {
    id: 'exc_01',
    title: 'Unmatched AWS Reserved Instance True-Up',
    source: 'Silicon Valley Bank',
    amount: 18450.00,
    confidence: 0.94,
    detected_anomaly: 'Bank debit of $18,450.00 from Amazon Web Services on Sept 28 without a corresponding finalized NetSuite PO.',
    suggested_action: 'Classify under COGS: Hosting Infrastructure (Dept 100, Account 5010) as annual savings plan upfront deposit amortizable over 12 months.',
    resolved: false,
  },
  {
    id: 'exc_02',
    title: 'Stripe Enterprise Wire Transfer Reconciliation Delay',
    source: 'Stripe',
    amount: 142800.00,
    confidence: 0.97,
    detected_anomaly: 'Custom annual contract payment for customer "Acme Global Enterprise" received via Stripe manual wire payout with $142,800 net of $1,200 wire clearing fee.',
    suggested_action: 'Credit Deferred Revenue (2100) $144,000, Debit Stripe Processing Fees (5030) $1,200, Debit Operating Cash (1010) $142,800.',
    resolved: true,
    resolution_note: 'Auto-reconciled via Stripe Invoice Metadata #INV-2026-8819.',
    resolved_by: 'FrogeClose Autonomous Agent'
  }
];

export const sampleVariances: VarianceItem[] = [
  {
    id: 'var_01',
    account_code: '5010',
    account_name: 'Cloud Hosting & GPUs (AWS/CoreWeave)',
    category: 'COGS',
    actual_amount: 342500,
    budget_amount: 285000,
    prior_amount: 281000,
    variance_amount: 57500,
    variance_pct: 20.18,
    materiality: 'high',
    ai_analysis: '20.2% unfavorable variance driven by enterprise customer AI inference spike on Claude/Llama inference endpoints. Fully offset by +$84k usage revenue billing in Q3.',
    flagged_for_exception: false
  },
  {
    id: 'var_02',
    account_code: '4010',
    account_name: 'SaaS Subscription Revenue',
    category: 'Revenue',
    actual_amount: 6200000,
    budget_amount: 5950000,
    prior_amount: 5540000,
    variance_amount: 250000,
    variance_pct: 4.20,
    materiality: 'high',
    ai_analysis: '+$250k (+4.2%) favorable to plan. Driven by accelerated mid-market expansion (NDR expanded from 114% to 118%) and 3 new 7-figure multi-year renewals.',
    flagged_for_exception: false
  },
  {
    id: 'var_03',
    account_code: '6010',
    account_name: 'Sales Commission & Quota Accelerators',
    category: 'S&M',
    actual_amount: 495000,
    budget_amount: 410000,
    prior_amount: 390000,
    variance_amount: 85000,
    variance_pct: 20.73,
    materiality: 'medium',
    ai_analysis: '+$85k commission overrun due to 142% quota attainment in EMEA enterprise tier. Under ASC 340-40, qualifying commissions are capitalized and amortized over 4.2yr CAC life.',
    flagged_for_exception: false
  },
  {
    id: 'var_04',
    account_code: '7020',
    account_name: 'Legal & Compliance (SOC2 / ISO Audit)',
    category: 'G&A',
    actual_amount: 112000,
    budget_amount: 135000,
    prior_amount: 128000,
    variance_amount: -23000,
    variance_pct: -17.04,
    materiality: 'low',
    ai_analysis: '-17.0% favorable variance resulting from automated continuous audit compliance tooling replacing manual external advisory billable hours.',
    flagged_for_exception: false
  }
];

export const sampleWaterfall: ASC606Waterfall[] = [
  {
    month: 'July 2026',
    beginning_deferred_revenue: 8450000,
    new_billings: 2180000,
    recognized_revenue: 2040000,
    ending_deferred_revenue: 8590000
  },
  {
    month: 'August 2026',
    beginning_deferred_revenue: 8590000,
    new_billings: 2340000,
    recognized_revenue: 2060000,
    ending_deferred_revenue: 8870000
  },
  {
    month: 'September 2026',
    beginning_deferred_revenue: 8870000,
    new_billings: 2490000,
    recognized_revenue: 2100000,
    ending_deferred_revenue: 9260000
  }
];

export const sampleAuditLogs: AuditLogEntry[] = [
  {
    id: 'log_01',
    timestamp: '2026-10-29T23:45:10Z',
    actor: 'system',
    action: 'JOB_INITIALIZATION',
    details: 'Tenant ID org_cloudscale_01 verified with RLS security token. Job session #FC-2026-Q3 created.',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },
  {
    id: 'log_02',
    timestamp: '2026-10-29T23:45:12Z',
    actor: 'agent',
    action: 'TOOL_CALL',
    tool_called: 'fetch_accounting_policies',
    details: 'Queried pgvector knowledge_base with embedding vector(1536) for "ASC 606 SaaS ratable revenue & commission capitalization". Top 2 docs matched (cos_sim > 0.89).',
    hash: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5'
  },
  {
    id: 'log_03',
    timestamp: '2026-10-29T23:45:18Z',
    actor: 'agent',
    action: 'TOOL_CALL',
    tool_called: 'reconcile_bank_vs_ledger',
    details: 'Processed 4,892 Stripe payment events against SVB depository records. 4,891 matched (99.98%). 1 discrepancy flagged for human review ($18,450 AWS charge).',
    hash: 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35'
  },
  {
    id: 'log_04',
    timestamp: '2026-10-29T23:45:25Z',
    actor: 'agent',
    action: 'SELF_CRITIQUE_VERIFICATION',
    details: 'Invariants checked: Debits = Credits ($31,840,290.00). Suspense balance = $0.00. Cash flow reconciliation tie-out confirmed.',
    hash: '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce'
  }
];

export function getFullClosePackage(): ClosePackage {
  return {
    period: 'Q3 2026 (July 1 - Sept 30, 2026)',
    company_name: mockOrg.name,
    arr: 24800000,
    mrr: 2066667,
    net_retention_rate: 118.2,
    gross_margin_pct: 81.4,
    burn_multiple: 0.62,
    cash_balance: 14250000,
    runway_months: 28.5,
    
    income_statement: {
      revenue: {
        subscription: 5920000,
        usage_services: 280000,
        total: 6200000
      },
      cogs: {
        hosting_infrastructure: 742000,
        support_success: 284000,
        payment_fees: 128000,
        total: 1154000
      },
      gross_profit: 5046000,
      operating_expenses: {
        research_and_development: 2150000,
        sales_and_marketing: 1680000,
        general_and_administrative: 790000,
        total: 4620000
      },
      operating_income: 426000,
      ebitda: 495000,
      net_income: 412000
    },
    
    reconciliation_summary: {
      total_transactions_parsed: 5128,
      automated_matches_count: 5126,
      match_rate_pct: 99.96,
      variance_items_flagged: 4,
      exceptions_cleared: 1,
      unreconciled_delta_usd: 0.00,
      debit_credit_invariant_passed: true
    },

    as606_waterfall: sampleWaterfall,
    variances: sampleVariances,
    exceptions: initialExceptions,
    
    executive_board_memo: `## FrogeClose Executive Financial Memo: Q3 2026 Performance
**To:** Board of Directors, CloudScale Technologies, Inc.  
**From:** Autonomous Close Agent (Reviewed by Controller)  
**Date:** October 30, 2026  
**Status:** GAAP Close Certified (Outcome Score: 98.4/100)

### 1. Executive Summary & Core Milestones
CloudScale delivered exceptional capital-efficient growth in Q3 2026. GAAP Net Revenue reached **$6.20M** (+11.9% QoQ, +4.2% favorable to budget), representing an annualized run-rate (ARR) of **$24.8M**. 
Operating Income turned positive to **+$426k** (EBITDA margin 8.0%), demonstrating inflection toward durable cash profitability. Cash and short-term equivalents stand at **$14.25M**, representing **28.5 months of runway** at current net burn trajectories (Burn Multiple: 0.62x).

### 2. Unit Economics & Retention (ASC 606 Compliant)
- **Net Dollar Retention (NDR):** Expanded to **118.2%** (up from 114.5% in Q2), fueled by tier migrations to enterprise AI pipelines.
- **Gross Margin:** Maintained at **81.4%**, despite a 20.2% increase in cloud infrastructure computing expenses caused by real-time customer inference spikes.
- **Customer Acquisition Payback:** 11.4 months on a fully burdened CAC basis.

### 3. Key Variance Commentary
- **Revenue (+4.2% to budget):** Accelerated enterprise closing cycle; 3 new contracts >$100k ACV closed in the final 10 days of September.
- **Cloud Hosting & GPUs (+20.2% to budget):** Unfavorable variance of $57.5k in AWS/CoreWeave clusters. Root cause: Enterprise customer AI inference overage, offset by $84k in billable consumption revenue.
- **Sales Commissions (+20.7% to budget):** $85k commission overrun reflecting 142% quota attainment in EMEA enterprise reps. In accordance with ASC 340-40, qualifying incremental acquisition costs have been capitalized and will amortize over customer lifetime.

### 4. Audit & Balance Sheet Tie-Out
All debit/credit invariants verified ($31.84M in total balance sheet footing). Suspense account balance is zero. All Stripe collections reconciled against SVB depository statements with 99.96% automated tie-out rate.`,

    outcome_score: 98.4,
    screen_time_saved_hours: 74.5,
    outcome_based_fee_usd: 1250,
    legacy_manual_cost_usd: 14800
  };
}
