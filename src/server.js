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

// 3. Generate Report (SSE Stream)
app.post('/api/generate', async (req, res) => {
    console.log('[API] Receive generation request (SSE)');

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const { prompt, email } = req.body;
        if (!prompt) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: 'Prompt is required' })}\n\n`);
            return res.end();
        }

        console.log('[API] Starting analysis stream for:', prompt);

        // Helper to send events
        const sendEvent = (type, data) => {
            res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        const result = await runAnalysis(prompt, {
            email,
            onLog: (log) => {
                sendEvent('log', log);
            }
        });

        // Construct access URL
        const filename = result.zipPath.split('/').pop();
        const downloadURL = `${req.protocol}://${req.get('host')}/reports/pdf/${filename}`;

        sendEvent('complete', {
            success: true,
            pdfURL: downloadURL, // Keeping field name 'pdfURL' for frontend compatibility, but it's a zip now
            message: 'Report generated successfully'
        });

        res.end();

    } catch (error) {
        console.error('[API] Generation Error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);

        try {
            await import('node:fs/promises').then(fs => fs.appendFile('debug_error.log', `[${new Date().toISOString()}] Error: ${error.stack || error}\n`));
        } catch (e) { }
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`[API] Server running on port ${PORT}`);
    console.log(`[API] Frontend URL set to: ${FRONTEND_URL}`);
});
