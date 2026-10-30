/**
 * FrogeClose Deterministic GAAP Engine
 * Plain TypeScript - Zero LLM Hallucinations.
 * All math, GAAP waterfalls, invariants, and reconciliations are computed deterministically.
 */

export interface TransactionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  source: 'bank' | 'ledger' | 'stripe';
  account_code?: string;
  reference_id?: string;
}

export interface ReconciliationMatchResult {
  bank_item: TransactionRecord;
  ledger_item?: TransactionRecord;
  status: 'matched' | 'unmatched' | 'flagged';
  score: number; // 0.00 to 1.00
  method: 'exact_hash' | 'bipartite_date_window' | 'unmatched';
  variance: number;
  flag_reason?: string;
}

export interface ASC606WaterfallSchedule {
  contract_id: string;
  customer_name: string;
  contract_start: string;
  contract_end: string;
  total_contract_value: number;
  term_months: number;
  monthly_ratable_revenue: number;
  prior_recognized: number;
  current_period_recognized: number;
  future_deferred_balance: number;
}

export interface ASC340AmortizationSchedule {
  asset_id: string;
  contract_ref: string;
  sales_rep: string;
  capitalized_commission: number;
  amortization_term_months: number; // e.g., 48 months under ASC 340-40
  prior_accumulated_amort: number;
  current_month_amortization: number;
  closing_unamortized_asset: number;
}

export interface GAAPInvariantResult {
  id: string;
  name: string;
  code: 'DEBITS_EQUAL_CREDITS' | 'BALANCE_SHEET_IDENTITY' | 'TB_TIES_STATEMENTS' | 'SUBLEDGER_TIES_GL' | 'ZERO_SUSPENSE_NO_DUPLICATES';
  evaluated_formula: string;
  left_val: number;
  right_val: number;
  delta: number;
  tolerance: number;
  passed: boolean;
  actual_numbers_breakdown: string;
}

/**
 * Normalizes text for robust financial matching
 */
export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[#\-_/\\,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates date difference in days between two ISO YYYY-MM-DD strings
 */
export function dateDiffDays(d1: string, d2: string): number {
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  return Math.abs(Math.round((t1 - t2) / (1000 * 60 * 60 * 24)));
}

/**
 * Jaccard token similarity for transaction description tie-breaking
 */
export function tokenSimilarity(s1: string, s2: string): number {
  const tokens1 = new Set(normalizeDescription(s1).split(' '));
  const tokens2 = new Set(normalizeDescription(s2).split(' '));
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Deterministic Bipartite Bank vs GL Reconciliation
 * Uses exact amount hashing first, then date window (±3 days) with Jaccard tie-breaker.
 */
export function reconcileBankVsLedger(
  bankRows: TransactionRecord[],
  ledgerRows: TransactionRecord[],
  maxDateWindowDays: number = 3
): {
  matches: ReconciliationMatchResult[];
  matched_count: number;
  unmatched_count: number;
  flagged_count: number;
  match_rate_pct: number;
} {
  const matches: ReconciliationMatchResult[] = [];
  const usedLedgerIndices = new Set<number>();

  // Pass 1: Exact Amount & Exact Date Hash Match
  const ledgerMap = new Map<string, number[]>();
  ledgerRows.forEach((row, idx) => {
    const key = `${Math.abs(row.amount).toFixed(2)}_${row.date}`;
    const list = ledgerMap.get(key) || [];
    list.push(idx);
    ledgerMap.set(key, list);
  });

  const unmatchedBankIndices: number[] = [];

  bankRows.forEach((bankTx, bIdx) => {
    const key = `${Math.abs(bankTx.amount).toFixed(2)}_${bankTx.date}`;
    const candidates = ledgerMap.get(key);
    let matched = false;
    if (candidates && candidates.length > 0) {
      for (let i = 0; i < candidates.length; i++) {
        const lIdx = candidates[i];
        if (!usedLedgerIndices.has(lIdx)) {
          usedLedgerIndices.add(lIdx);
          matched = true;
          matches.push({
            bank_item: bankTx,
            ledger_item: ledgerRows[lIdx],
            status: 'matched',
            score: 1.0,
            method: 'exact_hash',
            variance: 0.00
          });
          break;
        }
      }
    }
    if (!matched) {
      unmatchedBankIndices.push(bIdx);
    }
  });

  // Pass 2: Bipartite Matching with ±maxDateWindowDays & token similarity
  unmatchedBankIndices.forEach(bIdx => {
    const bankTx = bankRows[bIdx];
    let bestLIdx = -1;
    let bestScore = -1;

    for (let lIdx = 0; lIdx < ledgerRows.length; lIdx++) {
      if (usedLedgerIndices.has(lIdx)) continue;
      const ledgerTx = ledgerRows[lIdx];

      // Must match amount within 1 cent
      const amountDiff = Math.abs(Math.abs(bankTx.amount) - Math.abs(ledgerTx.amount));
      if (amountDiff > 0.01) continue;

      const dayDiff = dateDiffDays(bankTx.date, ledgerTx.date);
      if (dayDiff > maxDateWindowDays) continue;

      const sim = tokenSimilarity(bankTx.description, ledgerTx.description);
      // Score penalty for date difference: 0 days = 1.0, 3 days = 0.85
      const datePenalty = 1.0 - (dayDiff * 0.05);
      const totalScore = (0.7 * datePenalty) + (0.3 * sim);

      if (totalScore > bestScore && totalScore >= 0.70) {
        bestScore = totalScore;
        bestLIdx = lIdx;
      }
    }

    if (bestLIdx !== -1) {
      usedLedgerIndices.add(bestLIdx);
      matches.push({
        bank_item: bankTx,
        ledger_item: ledgerRows[bestLIdx],
        status: 'matched',
        score: parseFloat(bestScore.toFixed(3)),
        method: 'bipartite_date_window',
        variance: 0.00
      });
    } else {
      // Flag or Unmatched
      const isFeeOrDepositAnomaly = Math.abs(bankTx.amount) > 10000;
      matches.push({
        bank_item: bankTx,
        status: isFeeOrDepositAnomaly ? 'flagged' : 'unmatched',
        score: 0.0,
        method: 'unmatched',
        variance: bankTx.amount,
        flag_reason: isFeeOrDepositAnomaly
          ? `High-materiality bank item of $${Math.abs(bankTx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} has no GL counterparty.`
          : 'No ledger counterparty found within date window.'
      });
    }
  });

  const matched_count = matches.filter(m => m.status === 'matched').length;
  const flagged_count = matches.filter(m => m.status === 'flagged').length;
  const unmatched_count = matches.filter(m => m.status === 'unmatched').length;
  const match_rate_pct = parseFloat(((matched_count / (bankRows.length || 1)) * 100).toFixed(2));

  return {
    matches,
    matched_count,
    unmatched_count,
    flagged_count,
    match_rate_pct
  };
}

/**
 * ASC 606 Revenue Recognition Engine & Waterfall
 * Recognizes deferred software contract revenue strictly ratable over the term.
 * Explicitly separates recognized revenue from ARR (ARR = MRR * 12).
 */
export function computeASC606Waterfall(contracts: ASC606WaterfallSchedule[]): {
  contracts: ASC606WaterfallSchedule[];
  total_contract_value: number;
  total_recognized_this_period: number;
  total_closing_deferred: number;
  total_mrr: number;
  total_arr: number; // MRR * 12
} {
  let total_contract_value = 0;
  let total_recognized_this_period = 0;
  let total_closing_deferred = 0;
  let total_mrr = 0;

  const processed = contracts.map(c => {
    const monthly = c.total_contract_value / (c.term_months || 12);
    const recognized = monthly * 1; // 1 month period
    const remainingDeferred = c.total_contract_value - (c.prior_recognized + recognized);

    total_contract_value += c.total_contract_value;
    total_recognized_this_period += recognized;
    total_closing_deferred += Math.max(0, remainingDeferred);
    total_mrr += monthly;

    return {
      ...c,
      monthly_ratable_revenue: Math.round(monthly * 100) / 100,
      current_period_recognized: Math.round(recognized * 100) / 100,
      future_deferred_balance: Math.round(Math.max(0, remainingDeferred) * 100) / 100,
    };
  });

  const total_arr = Math.round(total_mrr * 12 * 100) / 100;

  return {
    contracts: processed,
    total_contract_value: Math.round(total_contract_value * 100) / 100,
    total_recognized_this_period: Math.round(total_recognized_this_period * 100) / 100,
    total_closing_deferred: Math.round(total_closing_deferred * 100) / 100,
    total_mrr: Math.round(total_mrr * 100) / 100,
    total_arr,
  };
}

/**
 * ASC 340-40 Sales Commission Capitalization & Amortization Engine
 * Under ASC 340-40, direct incremental costs of obtaining contracts (sales commissions)
 * must be capitalized as an asset and amortized ratably over the expected customer life (typically 48 months).
 */
export function computeASC340Commissions(schedules: ASC340AmortizationSchedule[]): {
  schedules: ASC340AmortizationSchedule[];
  total_capitalized: number;
  total_monthly_amortization: number;
  total_unamortized_asset: number;
} {
  let total_capitalized = 0;
  let total_monthly_amortization = 0;
  let total_unamortized_asset = 0;

  const processed = schedules.map(item => {
    const monthlyAmort = item.capitalized_commission / (item.amortization_term_months || 48);
    const newClosing = item.capitalized_commission - (item.prior_accumulated_amort + monthlyAmort);

    total_capitalized += item.capitalized_commission;
    total_monthly_amortization += monthlyAmort;
    total_unamortized_asset += Math.max(0, newClosing);

    return {
      ...item,
      current_month_amortization: Math.round(monthlyAmort * 100) / 100,
      closing_unamortized_asset: Math.round(Math.max(0, newClosing) * 100) / 100,
    };
  });

  return {
    schedules: processed,
    total_capitalized: Math.round(total_capitalized * 100) / 100,
    total_monthly_amortization: Math.round(total_monthly_amortization * 100) / 100,
    total_unamortized_asset: Math.round(total_unamortized_asset * 100) / 100,
  };
}

/**
 * 5 Deterministic GAAP Invariants Validator
 * Runs pure mathematical calculations against trial balance and balance sheet.
 * LLM is prohibited from passing checks; pass/fail is determined by code evaluation.
 */
export function evaluateGAAPInvariants(data: {
  total_debits: number;
  total_credits: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  pnl_net_revenue: number;
  trial_balance_revenue_credit: number;
  bank_verified_cash: number;
  gl_account_1010_cash: number;
  suspense_account_9999_balance: number;
  duplicate_journal_hashes_count: number;
}): GAAPInvariantResult[] {
  const tolerance = 0.001;

  // 1. Double Entry
  const debitCreditDelta = Math.abs(data.total_debits - data.total_credits);
  const debitsPassed = debitCreditDelta <= tolerance;

  // 2. Balance Sheet Identity
  const liabPlusEquity = data.total_liabilities + data.total_equity;
  const balanceSheetDelta = Math.abs(data.total_assets - liabPlusEquity);
  const balanceSheetPassed = balanceSheetDelta <= tolerance;

  // 3. Trial Balance Ties to Statements
  const revenueTieDelta = Math.abs(data.pnl_net_revenue - data.trial_balance_revenue_credit);
  const revenueTiePassed = revenueTieDelta <= tolerance;

  // 4. Subledger to GL Tie
  const cashTieDelta = Math.abs(data.bank_verified_cash - data.gl_account_1010_cash);
  const cashTiePassed = cashTieDelta <= tolerance;

  // 5. Zero Suspense & No Duplicates
  const suspenseZero = Math.abs(data.suspense_account_9999_balance) <= tolerance;
  const noDuplicates = data.duplicate_journal_hashes_count === 0;
  const suspensePassed = suspenseZero && noDuplicates;

  return [
    {
      id: 'inv_01',
      name: 'Double-Entry Invariant (Debits == Credits)',
      code: 'DEBITS_EQUAL_CREDITS',
      evaluated_formula: `|Debits ($${data.total_debits.toLocaleString()}) - Credits ($${data.total_credits.toLocaleString()})| == 0.00`,
      left_val: data.total_debits,
      right_val: data.total_credits,
      delta: debitCreditDelta,
      tolerance,
      passed: debitsPassed,
      actual_numbers_breakdown: debitsPassed
        ? `Passed: Exact equality ($${data.total_debits.toFixed(2)} debits == $${data.total_credits.toFixed(2)} credits). Delta: $0.00.`
        : `Failed: Imbalance of $${debitCreditDelta.toFixed(2)} detected.`
    },
    {
      id: 'inv_02',
      name: 'Balance Sheet Identity (Assets == Liabilities + Equity)',
      code: 'BALANCE_SHEET_IDENTITY',
      evaluated_formula: `Assets ($${data.total_assets.toLocaleString()}) == Liab ($${data.total_liabilities.toLocaleString()}) + Equity ($${data.total_equity.toLocaleString()})`,
      left_val: data.total_assets,
      right_val: liabPlusEquity,
      delta: balanceSheetDelta,
      tolerance,
      passed: balanceSheetPassed,
      actual_numbers_breakdown: balanceSheetPassed
        ? `Passed: Assets ($${data.total_assets.toFixed(2)}) == Liab & Equity ($${liabPlusEquity.toFixed(2)}). Delta: $0.00.`
        : `Failed: Delta of $${balanceSheetDelta.toFixed(2)} between Assets and Liab+Equity.`
    },
    {
      id: 'inv_03',
      name: 'Trial Balance Tie-Out to Financial Statements',
      code: 'TB_TIES_STATEMENTS',
      evaluated_formula: `P&L Recognized Revenue ($${data.pnl_net_revenue.toLocaleString()}) == TB Account 4010-4040 ($${data.trial_balance_revenue_credit.toLocaleString()})`,
      left_val: data.pnl_net_revenue,
      right_val: data.trial_balance_revenue_credit,
      delta: revenueTieDelta,
      tolerance,
      passed: revenueTiePassed,
      actual_numbers_breakdown: revenueTiePassed
        ? `Passed: Revenue recognizes $${data.pnl_net_revenue.toFixed(2)} matching trial balance credits exactly.`
        : `Failed: Unmapped revenue variance of $${revenueTieDelta.toFixed(2)}.`
    },
    {
      id: 'inv_04',
      name: 'Depository Subledger to General Ledger Tie-Out',
      code: 'SUBLEDGER_TIES_GL',
      evaluated_formula: `SVB Bank Verified Cash ($${data.bank_verified_cash.toLocaleString()}) == GL Cash Acct #1010 ($${data.gl_account_1010_cash.toLocaleString()})`,
      left_val: data.bank_verified_cash,
      right_val: data.gl_account_1010_cash,
      delta: cashTieDelta,
      tolerance,
      passed: cashTiePassed,
      actual_numbers_breakdown: cashTiePassed
        ? `Passed: Bank depository cash ($${data.bank_verified_cash.toFixed(2)}) ties 1:1 to GL Account 1010.`
        : `Failed: Unreconciled cash clearing delta of $${cashTieDelta.toFixed(2)}.`
    },
    {
      id: 'inv_05',
      name: 'Zero Suspense Balance & Deduplication Guard',
      code: 'ZERO_SUSPENSE_NO_DUPLICATES',
      evaluated_formula: `Suspense Acct #9999 ($${data.suspense_account_9999_balance.toFixed(2)}) == 0.00 && Duplicate Hashes (${data.duplicate_journal_hashes_count}) == 0`,
      left_val: data.suspense_account_9999_balance,
      right_val: 0.00,
      delta: Math.abs(data.suspense_account_9999_balance) + data.duplicate_journal_hashes_count,
      tolerance,
      passed: suspensePassed,
      actual_numbers_breakdown: suspensePassed
        ? `Passed: Suspense account 9999 is fully cleared ($0.00) and zero duplicate journal entries exist.`
        : `Failed: Suspense balance has $${data.suspense_account_9999_balance.toFixed(2)} or ${data.duplicate_journal_hashes_count} duplicates found.`
    }
  ];
}
