# FrogeClose: System Design & Technical Architecture Document
> **Data source:** Synthetic demo / Uploaded CSV  
> **Status:** Prototype on synthetic data

## 1. High-Level Architecture Diagram

```mermaid
graph TD
    Client[FrogeClose Minimalist Executive UI\nReact 19 + Tailwind v4 + Recharts]
    
    subgraph Data Input & Ingestion
        CSVUpload[CSV Ingestion Engine\nBank CSV + NetSuite GL CSV]
        SampleData[Synthetic Demo Dataset\n5,128 Ledger Transactions]
    end

    subgraph Agentic & Deterministic Engine
        LLMEngine[LLM Agent Drafting\nClassification & Variance Root-Cause]
        CodeSandbox[Deterministic Verification Engine\nTypeScript Code: Debits == Credits & Balance Sheet]
    end

    subgraph Storage & Verification
        PostgreSQL[(PostgreSQL 16 Schema\nRow-Level Security)]
        PgVector[(pgvector Extension\nASC 606 & ASC 340-40 Policies)]
        AuditLog[(Cryptographic Audit Log\nSHA-256 Chained Hashes)]
    end

    Client -->|Upload / Stream| CSVUpload
    CSVUpload --> LLMEngine
    SampleData --> LLMEngine
    LLMEngine --> CodeSandbox
    CodeSandbox -->|Verify Invariants| PostgreSQL
    CodeSandbox -->|Policy Embeddings| PgVector
    CodeSandbox -->|Append Immutable Actions| AuditLog
```

---

## 2. Deterministic Accounting Invariants (Evaluated in Code)

Unlike probabilistic text generation, financial close requires strict mathematical determinism:

1. **Double-Entry Invariant:**
   $$\sum \text{Debits} \equiv \sum \text{Credits}$$
   Evaluated with zero decimal tolerance across all journal lines in the trial balance.
2. **Balance Sheet Equation:**
   $$\text{Total Assets} \equiv \text{Total Liabilities} + \text{Total Equity}$$
   Evaluated after rolling closed Net Income into Accumulated Deficit.
3. **ASC 340-40 Capitalization & Amortization:**
   Sales commissions are capitalized on the Balance Sheet as contract acquisition assets and amortized straight-line over contract life (36 months).
4. **Subledger to General Ledger Tie-Out:**
   Bank statement verified depository cash balance must tie exactly to General Ledger Cash Account #1010.
5. **Zero Suspense Balance & Duplicate Detection:**
   Account #9999 (Suspense) ending balance must equal $0.00, and transaction SHA-256 hashing verifies zero duplicate entries.

---

## 3. Security & Safety Model
- **Tenant Isolation:** Postgres Row-Level Security (`tenant_id = current_setting('app.current_org_id')`).
- **Confidence Thresholding:** Any classification below 90% confidence or with unverified PO >$10k is routed to the Controller Exception Inbox.
- **Controller Rollback:** One-click rollback restores the ledger to the pre-close snapshot if any discrepancy is found.
