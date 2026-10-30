# FrogeClose: Evaluation Harness & Benchmark Criteria

How do you evaluate an autonomous agent that handles financial statement closing? Unlike text generation or casual chatbots, financial close is high-stakes and binary: **one incorrect debit or hallucinated revenue figure can lead to audit restatement or SEC inquiry.**

Below is FrogeClose's programmatic evaluation framework executed across synthetic and real historical company closes.

---

## 1. Quantitative Core Metrics

| Metric | Target Benchmark | Measurement Method | Failure Consequence |
| :--- | :--- | :--- | :--- |
| **Debit-Credit Balance Integrity** | **100.00%** (Zero Tolerance) | $\sum \text{Debits} - \sum \text{Credits} \equiv 0.00$ | Automated Job Rejection / $0 Billed |
| **Suspense Account Clearance** | **$0.00 unassigned** | Ending balance on account #9999 (Suspense) | Job flagged for human intervention |
| **Transaction Tie-Out Precision** | **$\ge 99.95\%$** | Automated matching vs. bank depository receipts | Review threshold triggered |
| **Material Variance Recall** | **100.0%** for $\Delta > \$25\text{k}$ or $>10\%$ | Detection of all budget deviations exceeding threshold | Incomplete board commentary |
| **ASC 606 Amortization Accuracy** | **$\pm \$0.00$** | Ratable schedule verification over contract terms | GAAP compliance violation |
| **Human Screen Time Reduction** | **$\ge 95\%$** | Time spent on exceptions vs. baseline manual close | Outcome pricing refund |

---

## 2. Invariant Verification Harness (Automated Gatekeeper)

Before any financial package is marked `completed` and before an outcome billing event is dispatched, the following deterministic tests must pass:

```typescript
export function evaluateFinancialInvariants(pkg: ClosePackage): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  // Invariant 1: Operating Income Math
  const expectedGrossProfit = pkg.income_statement.revenue.total - pkg.income_statement.cogs.total;
  if (Math.abs(expectedGrossProfit - pkg.income_statement.gross_profit) > 0.01) {
    failures.push(`Gross profit mismatch: expected ${expectedGrossProfit}, got ${pkg.income_statement.gross_profit}`);
  }

  // Invariant 2: Total Operating Expenses
  const opex = pkg.income_statement.operating_expenses;
  const expectedOpex = opex.research_and_development + opex.sales_and_marketing + opex.general_and_administrative;
  if (Math.abs(expectedOpex - opex.total) > 0.01) {
    failures.push(`Opex sum mismatch: expected ${expectedOpex}, got ${opex.total}`);
  }

  // Invariant 3: Unreconciled Delta must be Zero
  if (pkg.reconciliation_summary.unreconciled_delta_usd !== 0.0) {
    failures.push(`Unreconciled ledger delta remains: $${pkg.reconciliation_summary.unreconciled_delta_usd}`);
  }

  return {
    passed: failures.length === 0,
    failures
  };
}
```

---

## 3. Human Review Burden Scoring
We measure **Human Screen-Time Friction** using three concrete telemetry parameters:
1. **Total Exception Count:** Number of items routed to the controller inbox.
2. **Time to Decision:** Seconds spent by human reviewing suggested AI resolution.
3. **Rejection Rate:** Percentage of agent suggestions modified by the human controller.

*Target:* $<3$ exceptions per close, $<120$ seconds average human review time per close period.
