
/**
 * JobManager handles active analysis jobs to support session recovery (page refresh).
 * It stores logs in memory and allows multiple clients (or the same client after refresh)
 * to attach to the same running process.
 */
export class JobManager {
    constructor() {
        this.jobs = new Map(); // Map<email, { logs: [], listeners: [], process: Promise }>
    }

    hasJob(email) {
        return this.jobs.has(email);
    }

    /**
     * Starts a new job or returns existing one if race condition.
     * @param {string} email 
     * @param {string} prompt 
     * @param {function} runFn - The runAnalysis function
     * @param {Response} initialRes - The response object of the first request
     */
    async startJob(email, prompt, runFn, initialRes) {
        if (this.jobs.has(email)) {
            return this.attach(email, initialRes);
        }

        console.log(`[JobManager] Starting new job for: ${email}`);

        const job = {
            logs: [],
            listeners: [],
            prompt, // Store prompt for potential cleanup or recovery
            startTime: Date.now()
        };

        this.jobs.set(email, job);

        // Attach the initial response immediately
        this.setupResponse(initialRes);
        job.listeners.push(initialRes);

        try {
            // Run the analysis
            const result = await runFn(prompt, {
                email,
                onLog: (logItem) => {
                    // Buffer log
                    job.logs.push(logItem);
                    // Broadcast to all active listeners
                    this.broadcast(email, 'log', logItem);
                }
            });

            // Job Done
            const completeMsg = {
                success: true,
                pdfURL: result.zipPath ? `/reports/pdf/${result.zipPath.split('/').pop()}` : null,
                message: 'Report generated successfully'
            };

            // Buffer final state so late joiners see it's done
            job.logs.push({ type: 'complete', data: completeMsg });

            this.broadcast(email, 'complete', completeMsg);

        } catch (error) {
            console.error(`[JobManager] Job failed for ${email}:`, error);
            const errorMsg = { message: error.message };
            job.logs.push({ type: 'error', data: errorMsg });
            this.broadcast(email, 'error', errorMsg);
        } finally {
            // Cleanup after a delay to allow final polling/fetching
            setTimeout(() => {
                console.log(`[JobManager] Cleaning up job for: ${email}`);
                this.jobs.delete(email);
            }, 60000 * 5); // Keep for 5 minutes after finish, just in case
        }
    }

    /**
     * Reconnects a client to an active job.
     * Replays all buffered logs.
     */
    attach(email, res) {
        const job = this.jobs.get(email);
        if (!job) return false;

        console.log(`[JobManager] Re-attaching client for: ${email}`);

        this.setupResponse(res);
        job.listeners.push(res);

        // Replay history
        for (const item of job.logs) {
            if (item.type === 'complete') {
                res.write(`event: complete\ndata: ${JSON.stringify(item.data)}\n\n`);
            } else if (item.type === 'error') {
                res.write(`event: error\ndata: ${JSON.stringify(item.data)}\n\n`);
            } else {
                // Regular log
                res.write(`event: log\ndata: ${JSON.stringify(item)}\n\n`);
            }
        }

        // If job is already finished (has complete/error in logs), end responses?
        // Actually, we usually leave the stream open until client closes, or we can end it if done.
        // For simplicity, let's keep it open, the client usually calls EventSource.close().

        return true;
    }

    broadcast(email, event, data) {
        const job = this.jobs.get(email);
        if (!job) return;

        // Filter out closed responses
        job.listeners = job.listeners.filter(res => !res.writableEnded);

        job.listeners.forEach(res => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
