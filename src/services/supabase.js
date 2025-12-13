import { createClient } from '@supabase/supabase-js';

// Hardcoded for MVP speed, ideally should be in .env but user provided them directly.
// We use the ANON KEY because RLS policies allow public INSERT/SELECT.
const SUPABASE_URL = 'https://pjykvhnsrejttxqsxjee.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWt2aG5zcmVqdHR4cXN4amVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NzU0MjEsImV4cCI6MjA4MTE1MTQyMX0.ZCWu19DexbZc6eipg-4vCSUgVY6egmAUQ0c4bQg8pk8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Saves or retrieves a lead by email.
 * @param {string} email 
 * @returns {Promise<string|null>} The UUID of the lead
 */
export async function saveLead(email) {
    if (!email) return null;

    try {
        // First try to find existing
        const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('email', email)
            .single();

        if (existing) {
            return existing.id;
        }

        // Create new
        const { data: created, error } = await supabase
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
        const { error } = await supabase
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
        const { data: lead } = await supabase
            .from('leads')
            .select('id')
            .eq('email', email)
            .single();

        if (!lead) return null;

        // 2. Get Latest Report
        const { data: report } = await supabase
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
        const { data: lead } = await supabase
            .from('leads')
            .select('id')
            .eq('email', email)
            .single();

        if (!lead) return [];

        // 2. Get All Reports
        const { data: reports } = await supabase
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
