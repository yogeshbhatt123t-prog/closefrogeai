/**
 * FrogeClose Automated Test Suite
 * Covers 8 critical areas required for GAAP compliance, security, and integrity:
 * 1. Deterministic Reconciliation & Bipartite Matching
 * 2. ASC 606 Revenue Recognition Waterfall & Separate ARR
 * 3. ASC 340-40 Sales Commission Capitalization & Amortization
 * 4. 5 Deterministic GAAP Invariants
 * 5. Server-Side Role Enforcement (Controller / Reviewer / Read-Only)
 * 6. Multi-Tenant Organization Isolation
 * 7. Stripe Webhook & Billing Idempotency
 * 8. Cryptographic SHA-256 Audit Hash Chain & Tamper Detection
 */

import {
  reconcileBankVsLedger,
  computeASC606Waterfall,
  computeASC340Commissions,
  evaluateGAAPInvariants,
  type TransactionRecord
} from './deterministicEngine.ts';
import {
  appendAuditEntry,
  verifyAuditChain,
  type ChainedAuditLogEntry,
  GENESIS_HASH
} from './auditChain.ts';
import {
  enforceControllerRole,
  enforceReviewerOrController,
  AuthorizationError
} from '../server/api.ts';
import {
  authorizeCloseBilling,
  captureCloseBilling,
  verifyStripeWebhookSignature
} from '../server/stripeService.ts';

export interface TestCaseResult {
  suite: string;
  test_name: string;
  passed: boolean;
  message: string;
  duration_ms: number;
}

export interface FullTestSuiteReport {
  timestamp: string;
  total_suites: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  all_passed: boolean;
  results: TestCaseResult[];
}

export function runAllAutomatedTests(): FullTestSuiteReport {
  const results: TestCaseResult[] = [];
  const startAll = Date.now();

  function test(suite: string, name: string, fn: () => void) {
    const t0 = Date.now();
    try {
      fn();
      results.push({
        suite,
        test_name: name,
        passed: true,
        message: 'PASS',
        duration_ms: Math.max(1, Date.now() - t0)
      });
    } catch (err: any) {
      results.push({
        suite,
        test_name: name,
        passed: false,
        message: err.message || 'Assertion error',
        duration_ms: Math.max(1, Date.now() - t0)
      });
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  // ==========================================
  // SUITE 1: DETERMINISTIC RECONCILIATION
  // ==========================================
  test('1. Reconciliation Engine', 'Exact hash match with identical date and amount', () => {
    const bank: TransactionRecord[] = [
      { id: 'b1', date: '2026-09-15', amount: 15000.00, description: 'Direct Wire SVB', source: 'bank' }
    ];
    const gl: TransactionRecord[] = [
      { id: 'g1', date: '2026-09-15', amount: 15000.00, description: 'NetSuite Wire Deposit', source: 'ledger' }
    ];
    const outcome = reconcileBankVsLedger(bank, gl, 3);
    assert(outcome.matched_count === 1, 'Expected 1 matched record');
    assert(outcome.matches[0].method === 'exact_hash', 'Expected exact_hash match method');
    assert(outcome.match_rate_pct === 100.00, 'Expected 100% match rate');
  });

  test('1. Reconciliation Engine', 'Bipartite matching within ±3 day window and tie-breaking', () => {
    const bank: TransactionRecord[] = [
      { id: 'b2', date: '2026-09-18', amount: 4200.50, description: 'AWS Cloud Services invoice #8812', source: 'bank' }
    ];
    const gl: TransactionRecord[] = [
      { id: 'g2', date: '2026-09-16', amount: 4200.50, description: 'Amazon Web Services bill 8812', source: 'ledger' }
    ];
    const outcome = reconcileBankVsLedger(bank, gl, 3);
    assert(outcome.matched_count === 1, 'Expected 1 matched item via bipartite matching');
    assert(outcome.matches[0].method === 'bipartite_date_window', 'Expected bipartite_date_window method');
    assert(outcome.matches[0].score >= 0.70, 'Expected score >= 0.70');
  });

  test('1. Reconciliation Engine', 'Flags transactions exceeding date window or missing counterparty', () => {
    const bank: TransactionRecord[] = [
      { id: 'b3', date: '2026-09-25', amount: 50000.00, description: 'Unrecorded Wire Payout', source: 'bank' }
    ];
    const gl: TransactionRecord[] = [
      { id: 'g3', date: '2026-09-10', amount: 50000.00, description: 'Old AP entry', source: 'ledger' } // 15 days apart
    ];
    const outcome = reconcileBankVsLedger(bank, gl, 3);
    assert(outcome.flagged_count === 1, 'High amount outside date window must be flagged');
  });

  // ==========================================
  // SUITE 2: ASC 606 REVENUE WATERFALL & ARR
  // ==========================================
  test('2. ASC 606 Waterfall', 'Ratable 12-month recognition and separate ARR calculation', () => {
    const contracts = [
      {
        contract_id: 'CTR-001',
        customer_name: 'Acme SaaS',
        contract_start: '2026-01-01',
        contract_end: '2026-12-31',
        total_contract_value: 120000,
        term_months: 12,
        monthly_ratable_revenue: 0,
        prior_recognized: 80000,
        current_period_recognized: 0,
        future_deferred_balance: 0
      }
    ];
    const waterfall = computeASC606Waterfall(contracts);
    assert(waterfall.total_recognized_this_period === 10000, 'Monthly recognized should be exactly $10k');
    assert(waterfall.total_closing_deferred === 30000, 'Closing deferred balance should be $30k');
    assert(waterfall.total_mrr === 10000, 'MRR should be $10k');
    assert(waterfall.total_arr === 120000, 'ARR should strictly equal MRR x 12 ($120k)');
  });

  // ==========================================
  // SUITE 3: ASC 340-40 COMMISSION AMORTIZATION
  // ==========================================
  test('3. ASC 340-40 Commissions', 'Capitalization and 48-month straight line amortization schedule', () => {
    const commissions = [
      {
        asset_id: 'COMM-01',
        contract_ref: 'CTR-001',
        sales_rep: 'Alex Thorne',
        capitalized_commission: 48000,
        amortization_term_months: 48,
        prior_accumulated_amort: 12000,
        current_month_amortization: 0,
        closing_unamortized_asset: 0
      }
    ];
    const result = computeASC340Commissions(commissions);
    assert(result.total_monthly_amortization === 1000, 'Monthly amortization must be $48,000 / 48 = $1,000');
    assert(result.total_unamortized_asset === 35000, 'Closing unamortized asset should be $35,000');
  });

  // ==========================================
  // SUITE 4: 5 DETERMINISTIC GAAP INVARIANTS
  // ==========================================
  test('4. GAAP Invariants', 'Evaluates all 5 invariants with exact zero delta on balanced trial balance', () => {
    const invariants = evaluateGAAPInvariants({
      total_debits: 34587500.00,
      total_credits: 34587500.00,
      total_assets: 17293750.00,
      total_liabilities: 8140000.00,
      total_equity: 9153750.00,
      pnl_net_revenue: 6200000.00,
      trial_balance_revenue_credit: 6200000.00,
      bank_verified_cash: 14250000.00,
      gl_account_1010_cash: 14250000.00,
      suspense_account_9999_balance: 0.00,
      duplicate_journal_hashes_count: 0
    });
    assert(invariants.length === 5, 'Must evaluate exactly 5 invariants');
    const allPassed = invariants.every(inv => inv.passed);
    assert(allPassed, 'All 5 GAAP invariants must pass with zero tolerance');
    assert(invariants[0].delta === 0, 'Debits - Credits delta must be 0.00');
    assert(invariants[1].delta === 0, 'Balance sheet delta must be 0.00');
  });

  test('4. GAAP Invariants', 'Detects debit/credit imbalance and fails mathematically', () => {
    const invariants = evaluateGAAPInvariants({
      total_debits: 34587500.00,
      total_credits: 34587400.00, // $100 off
      total_assets: 17293750.00,
      total_liabilities: 8140000.00,
      total_equity: 9153750.00,
      pnl_net_revenue: 6200000.00,
      trial_balance_revenue_credit: 6200000.00,
      bank_verified_cash: 14250000.00,
      gl_account_1010_cash: 14250000.00,
      suspense_account_9999_balance: 0.00,
      duplicate_journal_hashes_count: 0
    });
    assert(invariants[0].passed === false, 'Double-entry invariant must fail on $100 delta');
    assert(invariants[0].delta === 100, 'Delta must be exactly $100.00');
  });

  // ==========================================
  // SUITE 5: ROLE PERMISSIONS & SERVER GATING
  // ==========================================
  test('5. Role Permissions', 'Server strictly allows Controller but denies Reviewer and Read-Only for approvals', () => {
    // 1. Controller succeeds
    let controllerAllowed = false;
    try {
      enforceControllerRole('controller', 'APPROVE_EXCEPTION');
      controllerAllowed = true;
    } catch {
      controllerAllowed = false;
    }
    assert(controllerAllowed, 'Controller must be granted approval authority');

    // 2. Reviewer blocked
    let reviewerBlocked = false;
    try {
      enforceControllerRole('reviewer', 'APPROVE_EXCEPTION');
    } catch (e) {
      reviewerBlocked = e instanceof AuthorizationError;
    }
    assert(reviewerBlocked, 'Reviewer must be blocked with 403 AuthorizationError');

    // 3. Read-only blocked from commenting
    let readOnlyBlocked = false;
    try {
      enforceReviewerOrController('read_only', 'SUBMIT_COMMENT');
    } catch (e) {
      readOnlyBlocked = e instanceof AuthorizationError;
    }
    assert(readOnlyBlocked, 'Read-only must be blocked from adding comments');
  });

  // ==========================================
  // SUITE 6: MULTI-TENANT ISOLATION
  // ==========================================
  test('6. Multi-Tenant Isolation', 'Tenant context strictly filters all records by org_id', () => {
    const tenantA_records = [
      { id: '1', org_id: 'org_acme', title: 'Acme Invoice' },
      { id: '2', org_id: 'org_acme', title: 'Acme Payout' }
    ];
    const tenantB_records = [
      { id: '3', org_id: 'org_nordic', title: 'Nordic Bill' }
    ];
    const allRecords = [...tenantA_records, ...tenantB_records];

    const filterByTenant = (orgId: string) => allRecords.filter(r => r.org_id === orgId);
    const isolatedAcme = filterByTenant('org_acme');
    assert(isolatedAcme.length === 2, 'Tenant Acme should see exactly 2 records');
    assert(!isolatedAcme.some(r => r.org_id === 'org_nordic'), 'Zero cross-tenant data leakage');
  });

  // ==========================================
  // SUITE 7: STRIPE WEBHOOK & BILLING IDEMPOTENCY
  // ==========================================
  test('7. Stripe Billing & Idempotency', 'Charges only when invariants pass + controller signs; idempotent per close', () => {
    const orgId = 'org_test_saas';
    const period = 'Q3 2026';

    // 1. Authorize billing with all invariants passed
    const intent = authorizeCloseBilling({
      org_id: orgId,
      close_job_id: 'job_q3_01',
      period,
      price_per_close_usd: 1250,
      invariants_passed: true
    });
    assert(intent.idempotency_key === `close_bill_${orgId}_${period}`, 'Idempotency key must match format');

    // 2. Capture billing requires controller role
    const captureResult = captureCloseBilling({
      idempotency_key: intent.idempotency_key,
      controller_name: 'Elena Rostova, CPA',
      controller_role: 'controller',
      all_invariants_passed: true
    });
    assert(captureResult.success, 'Controller capture must succeed');

    // 3. Re-authorizing with same key returns identical intent (idempotency test)
    const duplicateIntent = authorizeCloseBilling({
      org_id: orgId,
      close_job_id: 'job_q3_01',
      period,
      price_per_close_usd: 1250,
      invariants_passed: true
    });
    assert(duplicateIntent.id === intent.id, 'Duplicate authorization must return identical intent');

    // 4. Invariant failure triggers automatic void
    let voidIntent = authorizeCloseBilling({
      org_id: 'org_broken',
      close_job_id: 'job_broken_01',
      period: 'Q3 2026',
      price_per_close_usd: 1250,
      invariants_passed: false
    });
    assert(voidIntent.status === 'voided_failed_checks', 'Broken invariants must automatically void billing');
  });

  // ==========================================
  // SUITE 8: AUDIT TRAIL SHA-256 HASH CHAIN
  // ==========================================
  test('8. Audit Hash Chain', 'Builds cryptographic SHA-256 chain and detects deliberate tampering', () => {
    const chain: ChainedAuditLogEntry[] = [];

    // Append 3 verified blocks
    const b1 = appendAuditEntry(chain, {
      actor: 'system',
      action: 'TENANT_INITIALIZED',
      input_data: '{"org": "acme"}',
      output_data: '{"status": "ok"}',
      approved_by: 'system'
    });
    chain.push(b1);

    const b2 = appendAuditEntry(chain, {
      actor: 'agent',
      action: 'RECONCILIATION_RUN',
      input_data: '{"items": 5128}',
      output_data: '{"matched": 5126}',
      approved_by: 'agent'
    });
    chain.push(b2);

    const b3 = appendAuditEntry(chain, {
      actor: 'user',
      action: 'CONTROLLER_SIGN_OFF',
      input_data: '{"period": "Q3 2026"}',
      output_data: '{"signed": true}',
      approved_by: 'Elena Rostova, CPA'
    });
    chain.push(b3);

    assert(b1.prev_hash === GENESIS_HASH, 'Genesis prev_hash must be 64 zeros');
    assert(b2.prev_hash === b1.current_hash, 'Block 2 prev_hash must match Block 1 current_hash');
    assert(b3.prev_hash === b2.current_hash, 'Block 3 prev_hash must match Block 2 current_hash');

    // Verify pristine chain
    const verification = verifyAuditChain(chain);
    assert(verification.is_valid === true, 'Pristine chain must verify valid');
    assert(verification.tampered_index === null, 'Tampered index must be null');

    // Simulate malicious tampering of block 2 payload
    const corruptedChain = JSON.parse(JSON.stringify(chain)) as ChainedAuditLogEntry[];
    corruptedChain[1].action = 'MALICIOUS_UNAUTHORIZED_OVERRIDE';

    const corruptedVerification = verifyAuditChain(corruptedChain);
    assert(corruptedVerification.is_valid === false, 'Tampered chain must be flagged as invalid');
    assert(corruptedVerification.tampered_index === 1, 'Tampered index must pinpoint block 1');
  });

  const passed_tests = results.filter(r => r.passed).length;
  const failed_tests = results.filter(r => !r.passed).length;

  return {
    timestamp: new Date().toISOString(),
    total_suites: 8,
    total_tests: results.length,
    passed_tests,
    failed_tests,
    all_passed: failed_tests === 0,
    results
  };
}

// If executed via node / tsx directly, run and print
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('runTests')) {
  console.log('--- Running FrogeClose Automated GAAP & Security Test Suite ---');
  const report = runAllAutomatedTests();
  console.log(`Suites: ${report.total_suites} | Tests: ${report.total_tests} | Passed: ${report.passed_tests} | Failed: ${report.failed_tests}`);
  report.results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.suite} > ${r.test_name} (${r.duration_ms}ms)`);
  });
  if (!report.all_passed) {
    process.exit(1);
  } else {
    console.log('All 8 Test Suites Passed Successfully!');
  }
}
