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

// 3. Generate Report Endpoint (SSE)
app.post('/api/generate', async (req, res) => {
    // SSE Setup is now handled by JobManager, but we need to check inputs first
    try {
        const { prompt, email } = req.body;

        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
        // Email is optional in legacy flow but required for recovery. 
        // If no email, we can't recover sessions, so standard flow applies?
        // For now, let's assume email is passed (frontend enforces it).

        const { jobManager } = await import('./services/jobManager.js');

        if (email && jobManager.hasJob(email)) {
            // RECOVERY MODE: Attach to existing job
            console.log(`[API] Recovering session for: ${email}`);
            jobManager.attach(email, res);
            return;
        }

        // NEW JOB MODE
        console.log(`[API] Starting new analysis for: ${email || 'Anonymous'}`);

        // Dynamic import to ensure fresh logic if hot-reloaded (though ESM caching applies)
        const { runAnalysis } = await import('./services/conductor.js');

        if (email) {
            // Start managed job
            jobManager.startJob(email, prompt, runAnalysis, res);
        } else {
            // Legacy/Anonymous flow (no recovery support)
            // Just mimic the old behavior setup headers manually
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            runAnalysis(prompt, {
                email,
                onLog: (log) => {
                    sendEvent(res, 'log', log);
                }
            }).then(result => {
                const filename = result.zipPath.split('/').pop();
                const downloadURL = `${req.protocol}://${req.get('host')}/reports/pdf/${filename}`;
                sendEvent(res, 'complete', {
                    success: true,
                    pdfURL: downloadURL,
                    message: 'Report generated successfully'
                });
                res.end();
            }).catch(error => {
                console.error('[API] Generation Error:', error);
                res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
                res.end();
            });
        }

    } catch (error) {
        console.error('[API] Request Error:', error);
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
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

        // 1. Find latest report in Supabase
        const { findLatestReportByEmail } = await import('./services/supabase.js');
        const report = await findLatestReportByEmail(email);

        if (!report) {
            console.log('[API] Recovery: No report found for this email.');
            // Security: We might simulate success to avoid email enumeration, 
            // but for this MVP let's be explicit or just 404.
            // Let's return 404 for now so UI knows.
            return res.status(404).json({ error: 'Nenhum plano encontrado para este email.' });
        }

        console.log(`[API] Found report: ${report.zip_path}`);

        // 2. Check if file exists locally
        const { existsSync } = await import('node:fs');
        if (!existsSync(report.zip_path)) {
            console.error('[API] Recovery: File missing on disk:', report.zip_path);
            return res.status(410).json({ error: 'O arquivo expirou no servidor. Por favor, gere um novo plano.' });
        }

        // 3. Send Email
        const { sendReportEmail } = await import('./services/email.js');
        // Retrieve SMTP config (can assume it's loaded in env)
        const smtpConfig = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        };

        // Fire-and-forget email sending
        sendReportEmail(email, report.zip_path, report.prompt, smtpConfig)
            .then(() => console.log(`[RECOVERY] Email sent to ${email}`))
            .catch(err => console.error(`[RECOVERY] Failed to send email: ${err.message}`));

        res.json({ success: true, message: 'Email de recuperação enviado!' });

    } catch (err) {
        console.error('[API] Recovery Error:', err);
        res.status(500).json({ error: 'Erro interno ao recuperar documento.' });
    }
});

app.listen(PORT, () => {
    console.log(`[API] Server running on port ${PORT}`);
    console.log(`[API] Frontend URL set to: ${FRONTEND_URL}`);
});
