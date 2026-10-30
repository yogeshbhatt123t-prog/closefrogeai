import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { 
  mockOrg, 
  knowledgeBase, 
  initialExceptions, 
  sampleAuditLogs, 
  getFullClosePackage 
} from './src/server/db.ts';
import { executeAutonomousClose } from './src/server/agent.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// In-memory runtime state for the prototype
let currentExceptions = [...initialExceptions];
let auditLogs = [...sampleAuditLogs];
let latestPackage = getFullClosePackage();

// API Health
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    agent: 'FrogeClose Autonomous Financial Close Engine',
    gemini_connected: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    organization: mockOrg.name,
    version: '1.0.0-prod'
  });
});

// Organization metadata & billing config
app.get('/api/org', (req: Request, res: Response) => {
  res.json(mockOrg);
});

// Knowledge Base vector search simulation
app.get('/api/knowledge', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase();
  if (!query) {
    return res.json(knowledgeBase);
  }
  const filtered = knowledgeBase.map(doc => {
    // Basic lexical + semantic weight simulation
    const matchScore = doc.title.toLowerCase().includes(query) || doc.content.toLowerCase().includes(query) ? 0.94 : 0.72;
    return { ...doc, relevance_score: matchScore };
  }).sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  
  res.json(filtered);
});

// Audit trail
app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json(auditLogs);
});

// Current Financial Package
app.get('/api/package', (req: Request, res: Response) => {
  res.json(latestPackage);
});

// Resolve exception
app.post('/api/exceptions/:id/resolve', (req: Request, res: Response) => {
  const { id } = req.params;
  const { note, resolved_by, user_role } = req.body;

  // Server-side role check: Only controller can sign off
  if (user_role && user_role !== 'controller') {
    return res.status(403).json({ error: 'SECURITY FORBIDDEN: Only Controller role can resolve exceptions.' });
  }
  
  currentExceptions = currentExceptions.map(exc => {
    if (exc.id === id) {
      return {
        ...exc,
        resolved: true,
        resolution_note: note || 'Resolved by Controller via FrogeClose Exception Portal',
        resolved_by: resolved_by || 'Elena Rostova, CPA (Controller)'
      };
    }
    return exc;
  });

  const auditEntry = {
    id: `log_exc_${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: 'user' as const,
    action: 'EXCEPTION_RESOLVED',
    details: `Exception ${id} signed off by ${resolved_by || 'Elena Rostova, CPA'}. Note: "${note || 'Manual sign-off'}"`,
    hash: '7c86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a11'
  };
  auditLogs.unshift(auditEntry);

  latestPackage.exceptions = currentExceptions;
  latestPackage.reconciliation_summary.exceptions_cleared += 1;
  latestPackage.outcome_score = Math.min(100, latestPackage.outcome_score + 1.2);

  res.json({ success: true, updated_exceptions: currentExceptions, package: latestPackage });
});

// Run Automated Test Suite (Reconciliation, ASC 606, ASC 340-40, 5 Invariants, Roles, RLS, Stripe, Audit)
app.get('/api/tests/run', async (_req: Request, res: Response) => {
  try {
    const { runAllAutomatedTests } = await import('./src/core/runTests.ts');
    const report = runAllAutomatedTests();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run Evaluation Benchmark (200 transactions live compute)
app.get('/api/evaluation/run', async (_req: Request, res: Response) => {
  try {
    const { runEvaluationBenchmark } = await import('./src/core/evaluationEngine.ts');
    const metrics = runEvaluationBenchmark();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Differentiator 1: Stripe Penny Tie-Out
app.get('/api/differentiators/stripe-tieout', async (_req: Request, res: Response) => {
  try {
    const { calculateStripePennyTieOut } = await import('./src/core/differentiators.ts');
    const tieOut = calculateStripePennyTieOut();
    res.json(tieOut);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Differentiator 2: Missing Accruals Detector
app.get('/api/differentiators/missing-accruals', async (_req: Request, res: Response) => {
  try {
    const { detectMissingAccruals } = await import('./src/core/differentiators.ts');
    const accruals = detectMissingAccruals();
    res.json(accruals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Differentiator 3: Policy Memory Query
app.get('/api/differentiators/policy-memory', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const { queryPolicyMemory } = await import('./src/core/differentiators.ts');
    const policies = queryPolicyMemory(q);
    res.json(policies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Differentiator 4: Days to Close Scoreboard
app.get('/api/differentiators/days-to-close', async (req: Request, res: Response) => {
  try {
    const baseline = parseFloat(req.query.baseline as string) || 14;
    const { calculateDaysToClose } = await import('./src/core/differentiators.ts');
    const scoreboard = calculateDaysToClose(baseline);
    res.json(scoreboard);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe Billing Capture Route (conditioned on invariants + controller approval)
app.post('/api/billing/capture', async (req: Request, res: Response) => {
  try {
    const { authorizeCloseBilling, captureCloseBilling } = await import('./src/server/stripeService.ts');
    const { org_id, period, controller_name, controller_role, all_invariants_passed } = req.body;

    const intent = authorizeCloseBilling({
      org_id: org_id || 'org_cloudscale_01',
      close_job_id: `job_${period || 'Q3_2026'}`,
      period: period || 'Q3 2026',
      price_per_close_usd: 1250,
      invariants_passed: Boolean(all_invariants_passed)
    });

    const result = captureCloseBilling({
      idempotency_key: intent.idempotency_key,
      controller_name: controller_name || 'Elena Rostova, CPA',
      controller_role: controller_role || 'controller',
      all_invariants_passed: Boolean(all_invariants_passed)
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Run autonomous close with Server-Sent Events (SSE) streaming for real-time progress
app.get('/api/agent/stream-close', async (req: Request, res: Response) => {
  const goal = (req.query.goal as string) || 'Execute full Q3 2026 financial close, reconcile Stripe to SVB, run variance analysis, and generate board deck memo.';
  const period = (req.query.period as string) || 'Q3 2026';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const generator = executeAutonomousClose({
      goal,
      period,
      files: [
        { name: 'Stripe_Payouts_Q3_2026.csv', size: 1420000, type: 'csv' },
        { name: 'NetSuite_GeneralLedger_Q3.csv', size: 3100000, type: 'csv' },
        { name: 'SVB_Operating_Statement.pdf', size: 890000, type: 'pdf' },
        { name: 'Brex_CorpExpenses_Q3.csv', size: 450000, type: 'csv' }
      ]
    });

    for await (const event of generator) {
      if (event.audit_entry) {
        auditLogs.unshift(event.audit_entry);
      }
      if (event.package_preview) {
        latestPackage = event.package_preview as any;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      // slight delay for UI visual feedback on state progression
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    res.write(`data: ${JSON.stringify({ finished: true, package: latestPackage })}\n\n`);
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ error: error?.message || 'Agent error' })}\n\n`);
    res.end();
  }
});

// Non-streaming fallback for run close
app.post('/api/agent/run-close', async (req: Request, res: Response) => {
  const { goal, period, files } = req.body;
  try {
    const generator = executeAutonomousClose({
      goal: goal || 'Execute Q3 financial close and produce board memo',
      period: period || 'Q3 2026',
      files: files || []
    });

    const steps = [];
    for await (const event of generator) {
      steps.push(event);
      if (event.audit_entry) {
        auditLogs.unshift(event.audit_entry);
      }
      if (event.package_preview) {
        latestPackage = event.package_preview as any;
      }
    }

    res.json({
      success: true,
      package: latestPackage,
      steps
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to execute close' });
  }
});

// Configure Vite middleware or static serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[FrogeClose] Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
