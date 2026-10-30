# FrogeClose (FrogeClose.com)
> **The Outcome-Based Autonomous Financial Close Agent for Mid-Market SaaS**  
> *Killing the Screen Time KPI. Pay only for certified closed books and board-ready deliverables.*

---

## 1. Core Vision: The End of Screen Time in Enterprise Finance
For the last 15 years, enterprise software success was judged by daily active users (DAU) and screen time. If accountants sat inside ERPs (NetSuite, QuickBooks) for 80 hours a month, software vendors rejoiced and charged $150/seat/month.

**FrogeClose kills the screen time KPI.**

As highlighted in a16z’s landmark essay *“The End of the Screen Time KPI in AI Applications,”* the true promise of agentic AI is not making users click buttons faster—it is **relieving humans from the screen entirely**.

With FrogeClose, a mid-market finance team describes their desired outcome once:
> *"Close Q3 2026 books across Stripe, SVB, Brex, and NetSuite. Perform ASC 606 revenue waterfall, flag budget variances over 10%, verify debits equal credits, and synthesize a one-page board summary."*

FrogeClose plans, executes, cross-reconciles, self-critiques, and returns polished deliverables in minutes with **almost zero human screen time**. The human finance leader only reviews isolated edge-case exceptions.

---

## 2. Target Customer & Strategic Wedge
- **Target Customer:** High-growth Mid-Market SaaS ($5M to $100M ARR, Series A through Pre-IPO).
- **The Pain Point:** Month-end and quarter-end close takes 10 to 18 business days. It consumes 60–120 hours of tedious manual Excel tie-outs, Stripe CSV exports, Brex receipt chasing, and variance writing. Companies pay $12,000–$25,000/month for outsourced accounting firms or overburdened internal controllers.
- **The Wedge:** Month-end financial close package + 1-page Board Memo. Once FrogeClose reconciles Stripe + Bank + General Ledger, it owns the system of record for financial truth and naturally expands into annual audit prep, FP&A scenario modeling, and continuous tax compliance.

---

## 3. Business Model: 100% Outcome-Based Pricing
Legacy SaaS charges per seat, per month. This aligns software vendors with inefficiency (more users spending more hours = higher bill).

FrogeClose prices strictly on **successful closed outcomes**:
- **$1,250 per Monthly Close** (guaranteed within 4 hours vs. 12 days manual).
- **$2,500 per Quarter-End Close + Board Package** (reconciled 3-statement model, ASC 606 waterfall, variance commentary, and audit binder).
- **Zero-Risk Guarantee:** If debits do not equal credits or invariants fail, the customer pays $0.
- **Unit Economics:** Cost to execute agent (Gemini tokens, OCR parsing, pgvector queries, sandbox compute) is approximately **$1.85 to $4.20 per close**. Gross margin on outcome: **>99.6%**.

---

## 4. Why A Focused Founder Can Win This Market
1. **The ERP Giants Can't Cannibalize Themselves:** NetSuite, Workday, and Intuit are locked into seat-based licensing. Re-architecting into autonomous outcome engines cannibalizes their core revenue model and requires cross-platform trust (connecting Stripe, Brex, Gusto, and Carta outside their walled garden).
2. **Context Window & Tool Calling Inflection:** Only now (with Gemini 1M+ context windows and deterministic tool-use) can an agent ingest raw ledger lines, multi-page PDF bank statements, and company accounting policy documents in a single reasoning loop.
3. **The Data Moat:** Every resolved exception and approved journal entry trains company-specific RLS-isolated embeddings in `pgvector`. Switching away means losing the institutional memory of how the company accounts for custom enterprise contracts.

---

## 5. Go-To-Market (GTM) Strategy
1. **VC Portfolio Fast-Track:** Partner directly with CFOs at top VC funds (YC, a16z, Sequoia, Benchmark). VCs hate delayed board packages. Offering free Q3 close packages for portfolio companies creates immediate pull.
2. **Fractional CFO Channel:** Fractional CFO firms (Kruze, Burkland, Escalon) suffer from extreme accountant churn. FrogeClose serves as their white-labeled autonomous engine, enabling 1 fractional CFO to manage 30 clients instead of 5.
3. **Self-Serve Wedge:** Upload prior month's GL + Bank PDF to get a free instant variance tie-out in 90 seconds.

---

## 6. Architecture Highlights
- **Agent Loop:** Finite state machine (Plan → Gather → Reconcile → Analyze → Draft → Self-Critique → Finalize).
- **Security & RLS:** Postgres Row-Level Security (`tenant_id = current_setting('app.current_org_id')`), end-to-end encrypted storage, SHA-256 audit chaining.
- **Multiplayer Workspaces:** Role-based access for Controller (approval/lock), External Auditor (cryptographic tie-out), and Board Members (executive memo).
- **Zero-Hallucination Guardrails:** Mathematical invariants (Debits = Credits, zero suspense balance, cash flow tie-out) enforced programmatically outside the LLM.
