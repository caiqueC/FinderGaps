import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { loadEnv } from './services/env.js';
import { runAnalysis } from './services/conductor.js'; // We need to export this function from conductor.js first!
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Load Env
await loadEnv();

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'; // Default Vite port

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'FInderGaps API' });
});

// 1. Create Checkout Session
app.post('/api/checkout', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        console.log('[API] Creating checkout session for:', prompt.slice(0, 50) + '...');

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: 'Estudo de Mercado Profundo',
                            description: 'Análise completa de concorrentes, gaps e estratégia.',
                        },
                        unit_amount: 2997, // R$ 29,97
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${FRONTEND_URL}/payment/mock-checkout?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}?canceled=true`,
            metadata: {
                prompt: prompt.slice(0, 400), // Stripe limit is 500 chars
            },
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('[API] Stripe Error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// 2. Serve static reports (Explicit Download Route for ZIP/PDF)
app.get('/reports/pdf/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = join(process.cwd(), 'reports/pdf', filename);
    console.log(`[API] Download requested for: ${filename}`);
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('[API] Download Error:', err);
            if (!res.headersSent) res.status(404).send('File not found');
        }
    });
});

app.use('/reports', express.static(join(process.cwd(), 'reports')));

// 3. Generate Report Endpoint (Trigger only)
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, email } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const { jobManager } = await import('./services/jobManager.js');

        // If job exists, we just say "OK, connect to stream"
        if (email && jobManager.hasJob(email)) {
            return res.json({ success: true, message: 'Job already running, connect to stream.' });
        }

        console.log(`[API] Starting new analysis for: ${email || 'Anonymous'}`);
        const { runAnalysis } = await import('./services/conductor.js');

        if (email) {
            // Start managed job (fire and forget from HTTP perspective, but JobManager holds it)
            // We pass a FAKE response object because startJob expects to attach immediately?
            // Actually, we can modify startJob to not require a response immediately, 
            // OR we just don't pass one and JobManager handles empty listeners.
            // Let's modify JobManager.startJob to handle optional initialRes.
            jobManager.startJob(email, prompt, runAnalysis, null);
            return res.json({ success: true, message: 'Job started' });
        } else {
            // Anonymous flow: MUST keep holding connection (Legacy)
            // Cannot use GET stream easily for anonymous unless we issue a temp ID.
            // For now, let's keep the legacy behavior for implicit anonymous support?
            // User flow seems to always have email now.
            // But let's keep the old logic inline for safety if email is missing.
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            runAnalysis(prompt, {
                email,
                onLog: (log) => sendEvent(res, 'log', log)
            }).then(result => {
                const filename = result.zipPath.split('/').pop();
                const downloadURL = `${req.protocol}://${req.get('host')}/reports/pdf/${filename}`;
                sendEvent(res, 'complete', { success: true, pdfURL: downloadURL, message: 'Report generated successfully' });
                res.end();
            }).catch(error => {
                sendEvent(res, 'error', { message: error.message });
                res.end();
            });
        }
    } catch (error) {
        console.error('[API] Request Error:', error);
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
});

// 3b. Stream Endpoint (GET) - Dedicated for SSE
app.get('/api/stream', async (req, res) => {
    const { email } = req.query;
    if (!email) {
        // If no email, close.
        return res.status(400).send('Email required for streaming');
    }

    const { jobManager } = await import('./services/jobManager.js');

    // If no job found, maybe it finished? Or never started?
    // If it finished, JobManager keeps it for 5 mins.
    // If not found, we can send a custom event or just close.
    if (!jobManager.hasJob(email)) {
        // Send a specific event saying "No active job" so frontend can handle?
        // Or just 404?
        // Let's 404. Frontend assumes 404 = expired or not found.
        return res.status(404).send('No active job found');
    }

    console.log(`[API] Client connected to stream: ${email}`);
    jobManager.attach(email, res);
});

// Helper for Legacy anonymous flow
function sendEvent(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// 4. Recover Report Endpoint
app.post('/api/recover', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        console.log(`[API] Recovery requested for: ${email}`);

        // 0. Check for ACTIVE job first
        const { jobManager } = await import('./services/jobManager.js');
        if (jobManager.hasJob(email)) {
            const job = jobManager.jobs.get(email);
            console.log(`[API] Recovery: Found active job for ${email}`);
            return res.status(202).json({
                status: 'processing',
                message: 'Análise em andamento. Redirecionando...',
                prompt: job.prompt
            });
        }

        // 1. Find reports in Supabase
        const { findAllReportsByEmail } = await import('./services/supabase.js');
        const reports = await findAllReportsByEmail(email);

        if (!reports || reports.length === 0) {
            console.log('[API] Recovery: No reports found for this email.');
            return res.status(404).json({ error: 'Nenhum plano encontrado para este email.' });
        }

        // Scenario A: Multiple Reports -> User must select
        if (reports.length > 1) {
            console.log(`[API] Recovery: Found ${reports.length} reports. Asking user to select.`);
            return res.json({
                action: 'select',
                reports: reports.map(r => ({
                    id: r.id,
                    prompt: r.prompt,
                    created_at: r.created_at
                }))
            });
        }

        // Scenario B: Single Report -> Auto Send (Legacy convenience)
        const report = reports[0];
        console.log(`[API] Found single report: ${report.zip_path}`);

        // Check if file exists locally
        const { existsSync } = await import('node:fs');
        if (!existsSync(report.zip_path)) {
            console.error('[API] Recovery: File missing on disk:', report.zip_path);
            return res.status(410).json({ error: 'O arquivo expirou no servidor. Por favor, gere um novo plano.' });
        }

        // Send Email
        await sendRecoveryEmail(email, report);
        res.json({ action: 'sent', message: 'Email de recuperação enviado!' });

    } catch (err) {
        console.error('[API] Recovery Error:', err);
        res.status(500).json({ error: 'Erro interno ao recuperar documento.' });
    }
});

// 5. Send Specific Report Endpoint
app.post('/api/recover/send', async (req, res) => {
    try {
        const { email, reportId } = req.body;
        if (!email || !reportId) return res.status(400).json({ error: 'Email and Report ID required' });

        // Verify report ownership/existence
        const { findAllReportsByEmail } = await import('./services/supabase.js');
        const reports = await findAllReportsByEmail(email);
        const report = reports.find(r => r.id === reportId);

        if (!report) {
            return res.status(404).json({ error: 'Relatório não encontrado.' });
        }

        // Check if file exists locally
        const { existsSync } = await import('node:fs');
        if (!existsSync(report.zip_path)) {
            return res.status(410).json({ error: 'Arquivo expirado.' });
        }

        await sendRecoveryEmail(email, report);
        res.json({ success: true, message: 'Email enviado!' });

    } catch (err) {
        console.error('[API] Send Error:', err);
        res.status(500).json({ error: 'Falha ao enviar email.' });
    }
});

async function sendRecoveryEmail(email, report) {
    const { sendReportEmail } = await import('./services/email.js');
    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    };

    try {
        await sendReportEmail(email, report.zip_path, report.prompt, smtpConfig);
        console.log(`[RECOVERY] Email sent to ${email}`);
    } catch (err) {
        console.error(`[RECOVERY] Failed to send email: ${err.message}`);
        throw err;
    }
}

app.listen(PORT, () => {
    console.log(`[API] Server running on port ${PORT}`);
    console.log(`[API] Frontend URL set to: ${FRONTEND_URL}`);
});
