-- ==============================================================================
-- FrogeClose Autonomous Financial Close Engine - Production Database Schema
-- Dialect: PostgreSQL 16+ with pgvector extension & Row Level Security (RLS)
-- Multi-Tenant Isolation: Enforced at database level via current_setting('app.current_org_id')
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('controller', 'reviewer', 'read_only');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'succeeded', 'failed');
CREATE TYPE step_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE match_status AS ENUM ('matched', 'unmatched', 'flagged', 'manually_resolved');
CREATE TYPE exception_status AS ENUM ('pending', 'approved', 'rejected', 'auto_resolved');
CREATE TYPE billing_event_status AS ENUM ('pending', 'authorized', 'captured', 'voided', 'refunded');

-- 3. ORGANIZATIONS (TENANTS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    currency VARCHAR(3) DEFAULT 'USD',
    fiscal_year_end VARCHAR(5) DEFAULT '12-31',
    accounting_basis VARCHAR(16) DEFAULT 'GAAP',
    price_per_close_cents INTEGER DEFAULT 125000, -- $1,250.00
    stripe_customer_id VARCHAR(255),
    rate_limit_per_minute INTEGER DEFAULT 60,
    monthly_cost_cap_usd NUMERIC(10,2) DEFAULT 5000.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    external_auth_id VARCHAR(255) UNIQUE, -- Clerk or Supabase Auth ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MEMBERSHIPS (Multi-tenant firm access: one user in multiple orgs)
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'read_only',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_org_user UNIQUE (org_id, user_id)
);
CREATE INDEX idx_memberships_org_user ON memberships(org_id, user_id);

-- 6. CLOSE JOBS (Background async close jobs)
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period VARCHAR(32) NOT NULL, -- e.g. '2026-09' or 'Q3 2026'
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    status job_status NOT NULL DEFAULT 'queued',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    initiated_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    total_duration_ms INTEGER DEFAULT 0,
    total_compute_cost_usd NUMERIC(8,4) DEFAULT 0.0000,
    all_invariants_passed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_jobs_org_period ON jobs(org_id, period);

-- 7. JOB STEPS (7-stage state machine execution)
CREATE TABLE job_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(64) NOT NULL, -- Plan, Ingest, Reconcile, Draft, Verify, Exceptions, Finalize
    status step_status NOT NULL DEFAULT 'pending',
    duration_ms INTEGER DEFAULT 0,
    input_payload JSONB,
    output_payload JSONB,
    confidence_score NUMERIC(5,4),
    compute_cost_usd NUMERIC(8,4) DEFAULT 0.0000,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_job_steps_job ON job_steps(job_id, step_number);

-- 8. UPLOADED FILES & ATTACHMENTS
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(32) NOT NULL, -- 'bank_csv', 'gl_csv', 'stripe_csv', 'pdf'
    file_size_bytes BIGINT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    storage_signed_url TEXT NOT NULL,
    pii_redacted BOOLEAN DEFAULT TRUE,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_files_org ON files(org_id);

-- 9. BANK TRANSACTIONS (Source A)
CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    source_bank VARCHAR(128) NOT NULL, -- e.g. 'Silicon Valley Bank'
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL, -- Positive for deposits, negative for withdrawals
    account_number_mask VARCHAR(16),
    raw_reference VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bank_tx_org_date ON bank_transactions(org_id, transaction_date);

-- 10. GENERAL LEDGER ENTRIES (Source B)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    entry_number VARCHAR(64) NOT NULL,
    posting_date DATE NOT NULL,
    account_code VARCHAR(32) NOT NULL,
    account_name VARCHAR(128) NOT NULL,
    department VARCHAR(64),
    debit_amount NUMERIC(14,2) DEFAULT 0.00,
    credit_amount NUMERIC(14,2) DEFAULT 0.00,
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_org_date ON ledger_entries(org_id, posting_date);
CREATE INDEX idx_ledger_org_account ON ledger_entries(org_id, account_code);

-- 11. STRIPE PAYOUTS & CLEARING
CREATE TABLE stripe_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payout_id VARCHAR(128) NOT NULL,
    arrival_date DATE NOT NULL,
    gross_volume NUMERIC(14,2) NOT NULL,
    fee_deductions NUMERIC(14,2) NOT NULL,
    refund_deductions NUMERIC(14,2) NOT NULL,
    dispute_reserves NUMERIC(14,2) NOT NULL,
    timing_variance NUMERIC(14,2) DEFAULT 0.00,
    net_payout_amount NUMERIC(14,2) NOT NULL,
    bank_matched BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stripe_payouts_org ON stripe_payouts(org_id, arrival_date);

-- 12. DETERMINISTIC RECONCILIATION MATCHES
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    bank_tx_id UUID REFERENCES bank_transactions(id),
    ledger_entry_id UUID REFERENCES ledger_entries(id),
    match_score NUMERIC(5,4) NOT NULL,
    match_strategy VARCHAR(64) NOT NULL, -- 'exact_hash', 'bipartite_date_window', 'multi_line_group'
    status match_status NOT NULL DEFAULT 'matched',
    confidence NUMERIC(5,4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_matches_org_job ON matches(org_id, job_id);

-- 13. EXCEPTIONS & ANOMALY INBOX
CREATE TABLE exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    source VARCHAR(64) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    confidence NUMERIC(5,4) NOT NULL,
    detected_anomaly TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    proposed_entry JSONB, -- Drafted journal entry: { debits: [], credits: [] }
    status exception_status NOT NULL DEFAULT 'pending',
    resolution_note TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    policy_reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_exceptions_org_status ON exceptions(org_id, status);

-- 14. PROPOSED JOURNAL ENTRIES & ROLLBACK LOGS
CREATE TABLE journal_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    exception_id UUID REFERENCES exceptions(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    journal_hash VARCHAR(64) NOT NULL,
    lines JSONB NOT NULL, -- [{ account: '2100', debit: 0, credit: 144000 }, ...]
    is_posted BOOLEAN DEFAULT FALSE,
    is_rolled_back BOOLEAN DEFAULT FALSE,
    posted_by UUID REFERENCES users(id),
    rolled_back_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. IMMUTABLE AUDIT TRAIL (Cryptographic SHA-256 Hash Chain)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sequence_number BIGSERIAL NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor VARCHAR(32) NOT NULL, -- 'agent', 'user', 'system'
    action VARCHAR(64) NOT NULL,
    input_hash VARCHAR(64) NOT NULL,
    output_hash VARCHAR(64) NOT NULL,
    approved_by VARCHAR(128),
    prev_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL, -- SHA-256(prev_hash + sequence_number + timestamp + actor + action + input_hash + output_hash)
    signature TEXT
);
CREATE INDEX idx_audit_logs_org_seq ON audit_logs(org_id, sequence_number);

-- 16. STRIPE BILLING EVENTS (Per-close outcome billing)
CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    stripe_charge_id VARCHAR(128),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    amount_cents INTEGER NOT NULL,
    status billing_event_status NOT NULL DEFAULT 'pending',
    invariants_passed BOOLEAN NOT NULL,
    controller_approved BOOLEAN NOT NULL,
    void_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_billing_events_org ON billing_events(org_id);

-- 17. EVALUATION RESULTS (200 Transaction Benchmark)
CREATE TABLE evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    run_timestamp TIMESTAMPTZ DEFAULT NOW(),
    total_transactions INTEGER NOT NULL,
    true_positives INTEGER NOT NULL,
    true_negatives INTEGER NOT NULL,
    false_positives INTEGER NOT NULL,
    false_negatives INTEGER NOT NULL,
    accuracy NUMERIC(5,2) NOT NULL,
    precision_rate NUMERIC(5,2) NOT NULL,
    recall_rate NUMERIC(5,2) NOT NULL,
    f1_score NUMERIC(5,2) NOT NULL,
    runtime_ms INTEGER NOT NULL,
    compute_cost_usd NUMERIC(8,4) NOT NULL
);

-- 18. POLICY MEMORY & KNOWLEDGE BASE (pgvector 768-dim embeddings)
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    is_from_prior_approval BOOLEAN DEFAULT FALSE,
    prior_exception_id UUID REFERENCES exceptions(id),
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_kb_vector ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation: No query may read or write another org's data
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Helper RLS policy function to extract current session tenant
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_org_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Apply Tenant RLS Policies across all domain tables
CREATE POLICY tenant_isolation_jobs ON jobs FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_job_steps ON job_steps FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_files ON files FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_bank_tx ON bank_transactions FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_ledger ON ledger_entries FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_stripe ON stripe_payouts FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_matches ON matches FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_exceptions ON exceptions FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_proposals ON journal_proposals FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_audit_logs ON audit_logs FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_billing ON billing_events FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_eval ON evaluation_results FOR ALL USING (org_id = get_current_org_id());
CREATE POLICY tenant_isolation_kb ON knowledge_base FOR ALL USING (org_id = get_current_org_id());
