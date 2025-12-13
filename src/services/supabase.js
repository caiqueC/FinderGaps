import { createClient } from '@supabase/supabase-js';

// Hardcoded keys moved to .env for security.
// Ensure verify-db.js or server.js calls loadEnv() before importing this service if running standalone.

let supabaseInstance = null;

function getSupabase() {
    if (supabaseInstance) return supabaseInstance;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("[SUPABASE] Missing Environment Variables! Check .env");
    }
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseInstance;
}

/**
 * Saves or retrieves a lead by email.
 * @param {string} email 
 * @returns {Promise<string|null>} The UUID of the lead
 */
export async function saveLead(email) {
    if (!email) return null;

    try {
        // First try to find existing
        const { data: existing } = await getSupabase()
            .from('leads')
            .select('id')
            .eq('email', email)
            .single();

        if (existing) {
            return existing.id;
        }

        // Create new
        const { data: created, error } = await getSupabase()
            .from('leads')
            .insert([{ email }])
            .select('id')
            .single();

        if (error) {
            console.error('[SUPABASE] Failed to save lead:', error.message);
            return null;
        }
        return created.id;
    } catch (err) {
        console.error('[SUPABASE] Unexpected error saving lead:', err);
        return null;
    }
}

/**
 * Saves the full report metadata.
 * @param {string} leadId - UUID from leads table
 * @param {object} params - { prompt, reportData, zipPath }
 */
export async function saveReport(leadId, { prompt, reportData, zipPath }) {
    if (!leadId) {
        console.warn('[SUPABASE] No leadId provided, skipping report save.');
        return;
    }

    try {
        const { error } = await getSupabase()
            .from('reports')
            .insert([{
                lead_id: leadId,
                prompt,
                report_json: reportData, // Full JSON for history
                zip_path: zipPath
            }]);

        if (error) {
            console.error('[SUPABASE] Failed to save report:', error.message);
        } else {
            console.log('[SUPABASE] Report saved successfully.');
        }
    } catch (err) {
        console.error('[SUPABASE] Unexpected error saving report:', err);
    }
}

/**
 * Finds the latest report for a given email.
 * @param {string} email
 * @returns {Promise<{id: string, zip_path: string, prompt: string}|null>}
 */
export async function findLatestReportByEmail(email) {
    if (!email) return null;

    try {
        // 1. Get Lead ID
        const { data: lead } = await getSupabase()
            .from('leads')
            .select('id')
            .eq('email', email)
            .single();

        if (!lead) return null;

        // 2. Get Latest Report
        const { data: report } = await getSupabase()
            .from('reports')
            .select('id, zip_path, prompt, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        return report;
    } catch (err) {
        console.error('[SUPABASE] Error finding latest report:', err);
        return null;
    }
}
/**
 * Finds all reports for a given email.
 * @param {string} email
 * @returns {Promise<Array<{id: string, zip_path: string, prompt: string, created_at: string}>>}
 */
export async function findAllReportsByEmail(email) {
    if (!email) return [];

    try {
        // 1. Get Lead ID
        const { data: lead } = await getSupabase()
            .from('leads')
            .select('id')
            .eq('email', email)
            .single();

        if (!lead) return [];

        // 2. Get All Reports
        const { data: reports } = await getSupabase()
            .from('reports')
            .select('id, zip_path, prompt, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false });

        return reports || [];
    } catch (err) {
        console.error('[SUPABASE] Error finding all reports:', err);
        return [];
    }
}
/**
 * Creates a new job in the queue.
 * @param {string} email 
 * @param {string} prompt 
 * @returns {Promise<string|null>} Job ID
 */
export async function createJob(email, prompt) {
    try {
        const leadId = await saveLead(email); // Ensure lead exists

        const { data, error } = await getSupabase()
            .from('jobs')
            .insert([{
                email,
                prompt,
                lead_id: leadId,
                status: 'queued',
                step: 'start',
                state: {}
            }])
            .select('id')
            .single();

        if (error) {
            console.error('[SUPABASE] Failed to create job:', error.message);
            return null;
        }
        return data.id;
    } catch (err) {
        console.error('[SUPABASE] Unexpected error creating job:', err);
        return null;
    }
}

/**
 * atomic function to get next queued job
 * @returns {Promise<{id, prompt, email, state, lead_id}|null>}
 */
export async function getNextJob() {
    try {
        const { data, error } = await getSupabase()
            .rpc('get_next_job');

        if (error) {
            console.error('[SUPABASE] Error getting next job:', error.message);
            return null;
        }

        // RPC returns an array of rows (or empty array)
        if (data && data.length > 0) {
            return data[0];
        }
        return null;
    } catch (err) {
        console.error('[SUPABASE] Unexpected error in getNextJob:', err);
        return null;
    }
}

/**
 * Updates the job status and state (Checkpoint).
 * @param {string} jobId 
 * @param {string} step 
 * @param {object} partialState 
 */
export async function updateJobStep(jobId, step, partialState = {}) {
    try {
        // We merge new state with existing state using postgres jsonb_concat or just fetch-update-save.
        // For simplicity and atomic safety in simple steps, let's assume we pass the FULL state accumulator from conductor,
        // or we trust the partial update.
        // Actually, conductor usually accumulates state. Let's assume partialState is the NEW accumulation.
        // But to be safe, let's just update what we get.

        // Note: Supabase JS update merges top-level columns, but for JSONB columns it replaces the value unless we use a transformed query.
        // Ideally we pass the full `state` object here.

        const { error } = await getSupabase()
            .from('jobs')
            .update({
                step,
                state: partialState,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (error) console.error(`[SUPABASE] Failed to update job ${jobId}:`, error.message);
    } catch (err) {
        console.error(`[SUPABASE] Error updating job ${jobId}:`, err);
    }
}

/**
 * Marks job as completed.
 * @param {string} jobId 
 * @param {object} result 
 */
export async function completeJob(jobId, result) {
    try {
        await getSupabase()
            .from('jobs')
            .update({
                status: 'completed',
                result,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
    } catch (err) {
        console.error(`[SUPABASE] Error completing job ${jobId}:`, err);
    }
}

/**
 * Marks job as failed.
 * @param {string} jobId 
 * @param {string} errorMessage 
 */
export async function failJob(jobId, errorMessage) {
    try {
        await getSupabase()
            .from('jobs')
            .update({
                status: 'failed',
                error: errorMessage,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
    } catch (err) {
        console.error(`[SUPABASE] Error failing job ${jobId}:`, err);
    }
}

/**
 * Finds an active job (queued or processing) for an email.
 * Used for recovery / duplicate prevention.
 */
export async function findActiveJobByEmail(email) {
    try {
        const { data } = await getSupabase()
            .from('jobs')
            .select('id, status, step, prompt, created_at')
            .eq('email', email)
            .in('status', ['queued', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        return data;
    } catch (err) {
        return null;
    }
}

/**
 * Resets 'processing' jobs to 'queued' on server restart.
 * This handles crash recovery.
 */
export async function recoverStalledJobs() {
    try {
        const { error } = await getSupabase()
            .from('jobs')
            .update({ status: 'queued', updated_at: new Date().toISOString() })
            .eq('status', 'processing');

        if (error) {
            console.error('[SUPABASE] Failed to recover stalled jobs:', error.message);
        } else {
            console.log('[SUPABASE] recovered stalled jobs (reset to queued).');
        }
    } catch (err) {
        console.error('[SUPABASE] Error recovering stalled jobs:', err);
    }
}
