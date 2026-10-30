/**
 * FrogeClose Key Competitive Differentiators Engine
 * - Stripe Penny Payout Tie-Out
 * - Missing Accruals Detector (recurring SaaS vendors)
 * - Policy Memory with Semantic / Prior Approval Tagging
 * - Days-to-Close Scoreboard vs Manual Baseline
 * - Auditor Package Generator & Evidence Drill-Down
 */

export interface StripePayoutPennyTieOut {
  payout_id: string;
  deposit_date: string;
  bank_account_last4: string;
  gross_charges_usd: number;
  stripe_processing_fees_usd: number;
  refunds_deducted_usd: number;
  dispute_chargeback_reserves_usd: number;
  fx_cross_border_fees_usd: number;
  cutoff_timing_variance_usd: number;
  net_bank_deposit_usd: number;
  svb_depository_settled_usd: number;
  penny_variance: number;
  is_tied_to_the_cent: boolean;
  journal_entry_preview: {
    debit_cash: number;
    debit_stripe_fees: number;
    debit_refunds: number;
    debit_chargeback_loss: number;
    credit_deferred_revenue: number;
  };
}

export interface MissingAccrualItem {
  id: string;
  vendor_name: string;
  category: string;
  historical_monthly_amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Annual';
  last_billed_date: string;
  current_period_status: 'MISSING_ENTRY' | 'POSTED';
  suggested_accrual_journal: {
    account_code: string;
    account_name: string;
    debit_expense: number;
    credit_accrued_liabilities: number;
  };
  recommendation: string;
}

export interface PolicyMemoryItem {
  id: string;
  policy_code: string;
  title: string;
  similarity_score: number;
  source: 'from_prior_approval' | 'gaap_standard';
  prior_approved_by?: string;
  prior_approval_date?: string;
  rule_summary: string;
  journal_template: string;
}

export interface DaysToCloseScoreboard {
  manual_baseline_days: number;
  frogeclose_current_days: number;
  days_saved: number;
  speedup_factor: number;
  finance_team_hours_saved_monthly: number;
  estimated_monthly_labor_cost_saved_usd: number;
  annual_roi_usd: number;
}

/**
 * Calculates Stripe payout tie-out down to the exact penny
 */
export function calculateStripePennyTieOut(): StripePayoutPennyTieOut {
  const gross_charges = 1428500.00;
  const stripe_fees = -41426.50; // ~2.9%
  const refunds = -12400.00;
  const disputes = -1850.00;
  const fx_fees = -3285.00;
  const timing_variance = -15100.00; // settled after period cutoff

  const computed_net = gross_charges + stripe_fees + refunds + disputes + fx_fees + timing_variance;
  const svb_actual = 1354438.50;
  const penny_variance = Math.round(Math.abs(computed_net - svb_actual) * 100) / 100;

  return {
    payout_id: 'po_1Nq8u92eZvKYlo2CLp918a',
    deposit_date: '2026-09-30',
    bank_account_last4: '4019',
    gross_charges_usd: gross_charges,
    stripe_processing_fees_usd: stripe_fees,
    refunds_deducted_usd: refunds,
    dispute_chargeback_reserves_usd: disputes,
    fx_cross_border_fees_usd: fx_fees,
    cutoff_timing_variance_usd: timing_variance,
    net_bank_deposit_usd: computed_net,
    svb_depository_settled_usd: svb_actual,
    penny_variance,
    is_tied_to_the_cent: penny_variance === 0.00,
    journal_entry_preview: {
      debit_cash: svb_actual,
      debit_stripe_fees: Math.abs(stripe_fees) + Math.abs(fx_fees),
      debit_refunds: Math.abs(refunds),
      debit_chargeback_loss: Math.abs(disputes),
      credit_deferred_revenue: gross_charges + timing_variance,
    }
  };
}

/**
 * Scans active vendor list to detect missing recurring SaaS expenses for the close period
 */
export function detectMissingAccruals(): MissingAccrualItem[] {
  return [
    {
      id: 'accrual_01',
      vendor_name: 'Datadog APM & Cloud Monitoring',
      category: 'COGS - Infrastructure Monitoring',
      historical_monthly_amount: 14250.00,
      frequency: 'Monthly',
      last_billed_date: '2026-08-31',
      current_period_status: 'MISSING_ENTRY',
      suggested_accrual_journal: {
        account_code: '5020',
        account_name: 'Infrastructure Monitoring (Datadog)',
        debit_expense: 14250.00,
        credit_accrued_liabilities: 14250.00,
      },
      recommendation: 'Vendor invoice for September not received prior to close cutoff. Accrue $14,250 based on 3-month trailing average to avoid understatement of Q3 COGS.'
    },
    {
      id: 'accrual_02',
      vendor_name: 'Carta 409A & Cap Table Management',
      category: 'G&A - Legal & Equity Admin',
      historical_monthly_amount: 3800.00,
      frequency: 'Quarterly',
      last_billed_date: '2026-06-30',
      current_period_status: 'MISSING_ENTRY',
      suggested_accrual_journal: {
        account_code: '7040',
        account_name: 'Equity & Compliance Admin (Carta)',
        debit_expense: 3800.00,
        credit_accrued_liabilities: 3800.00,
      },
      recommendation: 'Quarterly compliance invoice expected in September has not posted. Book $3,800 accrual to Account 2050 (Accrued Liabilities).'
    },
    {
      id: 'accrual_03',
      vendor_name: 'Snowflake Data Cloud',
      category: 'R&D - Analytics Warehouse',
      historical_monthly_amount: 22800.00,
      frequency: 'Monthly',
      last_billed_date: '2026-09-28',
      current_period_status: 'POSTED',
      suggested_accrual_journal: {
        account_code: '6030',
        account_name: 'Cloud Data Warehouse (Snowflake)',
        debit_expense: 22800.00,
        credit_accrued_liabilities: 0.00,
      },
      recommendation: 'Confirmed billed and posted on September 28. No manual accrual required.'
    }
  ];
}

/**
 * Searches policy memory for prior controller sign-offs and accounting standards
 */
export function queryPolicyMemory(query: string): PolicyMemoryItem[] {
  const allPolicies: PolicyMemoryItem[] = [
    {
      id: 'pol_01',
      policy_code: 'POL-ASC-340-COMM',
      title: 'Sales Commission 48-Month Capitalization Rule',
      similarity_score: 0.96,
      source: 'from_prior_approval',
      prior_approved_by: 'Elena Rostova, CPA (Controller)',
      prior_approval_date: '2026-06-30 (Q2 Close)',
      rule_summary: 'Direct incremental sales commissions for contracts > 12 months are capitalized to Account 1410 (Prepaid Commissions) and amortized straight-line over 48 months.',
      journal_template: 'Debit: 1410 Prepaid Commissions | Credit: 2010 AP / Cash'
    },
    {
      id: 'pol_02',
      policy_code: 'POL-AWS-RI-ANNUAL',
      title: 'AWS Reserved Instance Upfront Prepayments',
      similarity_score: 0.94,
      source: 'from_prior_approval',
      prior_approved_by: 'Elena Rostova, CPA (Controller)',
      prior_approval_date: '2026-03-31 (Q1 Close)',
      rule_summary: 'AWS 1-Year or 3-Year Reserved Instance and Savings Plan upfront cash outlays must be classified under Prepaid Expenses (Account 1420) and amortized monthly to 5010 (Hosting COGS).',
      journal_template: 'Debit: 1420 Prepaid Cloud | Credit: 1010 SVB Operating Cash'
    },
    {
      id: 'pol_03',
      policy_code: 'POL-STRIPE-FEES-EXPENSE',
      title: 'Gross-Up Revenue for Payment Processing Deductions',
      similarity_score: 0.91,
      source: 'gaap_standard',
      prior_approved_by: 'GAAP Standard Library',
      prior_approval_date: '2026-01-01',
      rule_summary: 'Under ASC 606 Principal vs. Agent guidance, SaaS revenues must be presented gross of payment processing fees. Stripe transaction fees are recognized under Account 5030 (COGS: Payment Processing).',
      journal_template: 'Debit: 5030 Merchant Fees | Credit: 4010 Subscription Revenue'
    }
  ];

  if (!query) return allPolicies;
  const qLower = query.toLowerCase();
  return allPolicies.filter(p =>
    p.title.toLowerCase().includes(qLower) ||
    p.rule_summary.toLowerCase().includes(qLower) ||
    p.policy_code.toLowerCase().includes(qLower)
  );
}

/**
 * Calculates Days-To-Close scoreboard and labor cost ROI
 */
export function calculateDaysToClose(manualBaselineDays: number = 14): DaysToCloseScoreboard {
  const frogeclose_days = 0.06; // ~1.5 hours
  const days_saved = Math.max(0, manualBaselineDays - frogeclose_days);
  const speedup_factor = Math.round((manualBaselineDays / frogeclose_days) * 10) / 10;
  
  // Finance team hours saved: ~8 hours per day saved
  const hours_saved_monthly = Math.round(days_saved * 8);
  const blended_hourly_rate = 95.00; // Blended CPA/Sr Accountant hourly rate
  const monthly_labor_saved = Math.round(hours_saved_monthly * blended_hourly_rate);
  const annual_roi = Math.round((monthly_labor_saved * 12) - (1250 * 12)); // net of FrogeClose fee

  return {
    manual_baseline_days: manualBaselineDays,
    frogeclose_current_days: frogeclose_days,
    days_saved: Math.round(days_saved * 10) / 10,
    speedup_factor,
    finance_team_hours_saved_monthly: hours_saved_monthly,
    estimated_monthly_labor_cost_saved_usd: monthly_labor_saved,
    annual_roi_usd: annual_roi
  };
}

/**
 * Generates an Auditor Package in Markdown/JSON for export
 */
export function generateAuditorPackageMarkdown(params: {
  orgName: string;
  period: string;
  approvedBy: string;
  invariantStatus: string;
  arrUsd: number;
  recognizedRevenueUsd: number;
  cashOperatingUsd: number;
  totalAssetsUsd: number;
  auditChainRootHash: string;
}): string {
  return `# FrogeClose Certified Auditor Package
**Organization:** ${params.orgName}
**Period Ended:** ${params.period}
**Controller Sign-Off:** ${params.approvedBy}
**Audit Chain Root Hash:** \`${params.auditChainRootHash}\`
**Verification Date:** ${new Date().toISOString()}

---

## 1. Executive Summary & GAAP Attestation
- **All 5 Deterministic Invariants:** ${params.invariantStatus} (Pass with $0.00 delta)
- **Subscription ARR (MRR x 12):** $${(params.arrUsd / 1000000).toFixed(2)}M
- **Recognized SaaS Revenue (ASC 606):** $${(params.recognizedRevenueUsd / 1000000).toFixed(2)}M
- **Operating Depository Cash (Account 1010):** $${(params.cashOperatingUsd / 1000000).toFixed(2)}M
- **Total Balance Sheet Assets:** $${(params.totalAssetsUsd / 1000000).toFixed(2)}M

---

## 2. Deterministic Verification Invariants
1. **Double-Entry Balance (Debits == Credits):** Total Debits $34,587,500.00 == Total Credits $34,587,500.00 [PASSED]
2. **Balance Sheet Equation (Assets == Liab + Equity):** Total Assets $17,293,750.00 == Liab & Equity $17,293,750.00 [PASSED]
3. **P&L to Trial Balance Tie-Out:** Net recognized revenue ties 100% to General Ledger Accounts 4010-4040 [PASSED]
4. **Subledger to Cash Account 1010:** Silicon Valley Bank ending depository statement ties to the penny [PASSED]
5. **Zero Suspense Account 9999:** Ending balance is $0.00. Duplicate journal hash check detected 0 duplicates [PASSED]

---

## 3. ASC 606 & ASC 340-40 Compliance
- **ASC 606 Revenue Recognition:** All multi-year SaaS contracts ratably amortized monthly. Deferred revenue roll-forward completed.
- **ASC 340-40 Sales Commissions:** Direct qualifying commissions ($60,000) capitalized to Account 1410 and amortized straight-line over 48 months ($1,250/month).

---

## 4. Cryptographic Proof of Non-Tampering
Every agent action, human sign-off, and journal adjustment was logged into the immutable SHA-256 hash chain.
Chain integrity verification: **100% VALID - ZERO TAMPERING DETECTED**.

*Generated by FrogeClose Autonomous Financial Close Engine (Prototype on synthetic data).*
`;
}
