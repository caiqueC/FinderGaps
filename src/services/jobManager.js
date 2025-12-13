import {
    createJob,
    getNextJob,
    updateJobStep,
    completeJob,
    failJob,
    findActiveJobByEmail,
    recoverStalledJobs
} from './supabase.js';

export class JobManager {
    constructor() {
        this.activeListeners = new Map(); // Map<email, Response[]>
        this.MAX_CONCURRENT = 4;
        this.activeWorkers = 0;

        // Recover stalled jobs on boot
        recoverStalledJobs();

        // Start the worker loop
        this.workerLoop();
    }

    /**
     * Main Worker Loop
     * Polls DB for queued jobs if we have capacity.
     */
    async workerLoop() {
        setInterval(async () => {
            if (this.activeWorkers < this.MAX_CONCURRENT) {
                const job = await getNextJob();
                if (job) {
                    this.runWorker(job);
                }
            }
        }, 2000); // Check every 2 seconds
    }

    /**
     * Executes a job (Worker)
     * @param {object} job 
     */
    async runWorker(job) {
        this.activeWorkers++;
        const { id, email, prompt, state } = job;

        console.log(`[WORKER] Starting job ${id} for ${email}`);

        // Notify listeners processing started
        this.broadcast(email, 'log', { text: "Iniciando processamento na fila...", type: 'info' });

        try {
            // Import conductor dynamically to avoid circular deps if any
            const { runAnalysis } = await import('./conductor.js');

            // Run Analysis with Checkpointing
            // We pass 'state' (resumed data) and a checkpoint callback
            const result = await runAnalysis(prompt, {
                email,
                jobId: id,
                initialState: state, // RESUME DATA
                onLog: (logItem) => {
                    this.broadcast(email, 'log', logItem);
                },
                onCheckpoint: async (step, partialData) => {
                    // Save state to DB
                    await updateJobStep(id, step, partialData);
                }
            });

            // Success
            await completeJob(id, result);

            const completeMsg = {
                success: true,
                pdfURL: result.zipPath ? `/reports/pdf/${result.zipPath.split('/').pop()}` : null,
                message: 'Report generated successfully'
            };
            this.broadcast(email, 'complete', completeMsg);

        } catch (error) {
            console.error(`[WORKER] Job ${id} failed:`, error);
            await failJob(id, error.message);
            this.broadcast(email, 'error', { message: error.message });
        } finally {
            this.activeWorkers--;
            console.log(`[WORKER] Job ${id} finished. Slots: ${this.activeWorkers}/${this.MAX_CONCURRENT}`);
        }
    }

    /**
     * Entry point for new requests.
     * Just creates the DB record. The worker loop will pick it up.
     */
    async startJob(email, prompt, runFn, initialRes) {
        // 1. Check if already active to prevent duplicates
        const existing = await findActiveJobByEmail(email);
        if (existing) {
            console.log(`[JobManager] Existing job found for ${email}, attaching...`);
            if (initialRes) this.attach(email, initialRes);
            return;
        }

        // 2. Create in DB (Status: queued)
        const jobId = await createJob(email, prompt);

        if (initialRes) {
            this.attach(email, initialRes);
            // Send immediate feedback
            initialRes.write(`event: log\ndata: ${JSON.stringify({ text: "Solicitação na fila de processamento...", type: 'info' })}\n\n`);
        }
    }

    /**
     * Manages SSE connections
     */
    attach(email, res) {
        if (!this.activeListeners.has(email)) {
            this.activeListeners.set(email, []);
        }

        this.setupResponse(res);
        this.activeListeners.get(email).push(res);

        // Clean up on close
        res.on('close', () => {
            const list = this.activeListeners.get(email) || [];
            this.activeListeners.set(email, list.filter(r => r !== res));
        });
    }

    async hasJob(email) {
        if (!email) return false;
        // Check DB for active job
        const job = await findActiveJobByEmail(email);
        return !!job;
    }

    broadcast(email, event, data) {
        const listeners = this.activeListeners.get(email);
        if (!listeners) return;

        listeners.forEach(res => {
            if (!res.writableEnded) {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            }
        });
    }

    setupResponse(res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
    }
}

export const jobManager = new JobManager();
