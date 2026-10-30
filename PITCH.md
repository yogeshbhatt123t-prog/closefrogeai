# FrogeClose (FrogeClose.com): YC & a16z Speedrun 1-Page Pitch Memo

**Company:** FrogeClose (FrogeClose.com)  
**One-Line Description:** AI closes the books; the controller only reviews exceptions. Outcome-based financial close engine for mid-market SaaS.  
**Founder:** Yogesh Bhatt, B.Sc. CSIT student, Kathmandu. Built this prototype solo.  
**Stage:** Functional prototype tested on synthetic multi-source data with deterministic code verification.

---

### 1. Problem
Every high-growth mid-market SaaS company ($5M to $100M ARR) loses 10 to 18 business days every month closing their books. Senior controllers spend 60–100 hours copy-pasting Stripe payouts into spreadsheets, matching bank wire receipts, tracking deferred revenue waterfalls under ASC 606, and amortizing sales commissions under ASC 340-40. Companies spend $150k+/year on internal controllers and outsourced CPA firms for repetitive, manual tie-outs prone to formula breakage.

### 2. Solution
FrogeClose kills the screen-time KPI: **AI closes the books; the controller only reviews exceptions.**  
The finance team connects their stack (Stripe + NetSuite/QBO + Bank CSVs). FrogeClose parses, reconciles, and evaluates 5 deterministic code-computed GAAP invariants. The controller only inspects flagged edge-case exceptions with proposed journal entries.

### 3. Why Now?
1. **Long-Context Window & Multimodal Parsing:** Models can now ingest 5,000+ line general ledgers, raw Stripe webhooks, and PDF bank statements in a single reasoning loop.
2. **Deterministic Sandboxing:** By strictly separating AI classification from deterministic arithmetic code execution, agents can now perform accounting without hallucinating numbers.

### 4. Target Customer
Mid-market B2B SaaS companies ($5M–$100M ARR) using Stripe + NetSuite or QuickBooks Online + Silicon Valley Bank / Mercury. The entry wedge is the month-end close package and one-page executive board memo.

### 5. Business Model & Outcome Pricing
100% outcome-based billing: **$1,250 per successful monthly close**.  
- Zero seat licensing lock-in.
- **Risk-free guarantee:** If mathematical invariants fail ($\sum \text{Debits} \neq \sum \text{Credits}$), the customer pays $0.
- Unit economics: Compute and LLM inference cost is ~$0.18–$0.45 per run, yielding high software gross margins while saving the customer $12k+/mo in manual accounting costs.

### 6. The Moat: Institutional Accounting Memory (`pgvector`)
Every SaaS business has bespoke accounting policies (e.g. custom multi-year contract renewals, capitalization thresholds under ASC 350-40, and commission amortization schedules under ASC 340-40). FrogeClose stores every approved journal entry and exception resolution in tenant-isolated vector memory. Switching away means losing the institutional memory of how the company accounts for its contracts.

### 7. Competition & Differentiation
- **FloQast / BlackLine:** Checklist and Excel-sync tools that still require humans to perform every reconciliation by hand.
- **Numeric:** Modern close workspace, but still designed around maximizing human screen time.
- **Rillet:** Modern ERP, but requires migrating away from NetSuite/QBO entirely (high friction).
- **FrogeClose:** Sits on top of existing stacks (NetSuite, QBO, Stripe) and autonomously generates the reconciled package while humans only review exceptions.

### 8. Traction & Transparency
- Functional working prototype with real CSV ingestion and deterministic code checks.
- Conducted discovery interviews with SaaS controllers to map the Stripe-to-GL tie-out bottleneck.
- **Target:** 3 mid-market SaaS design partner pilots ($5M–$25M ARR) to run parallel month-end closes.

### 9. The Ask
Looking for design partners and pre-seed backing to scale native ERP connectors and conduct pilot closes with 3 SaaS finance teams.
