-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id), -- Optional link to lead
    email TEXT NOT NULL,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    step TEXT DEFAULT 'start', -- current execution step name
    state JSONB DEFAULT '{}'::jsonb, -- Store full context (keywords, competitors, etc)
    result JSONB, -- Final result (pdf paths, etc)
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Index for fast queue polling
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs(status, created_at);

-- Function to safely pick the next job (Concurrency Locking)
-- This atomic function ensures 4 workers won't pick the same job
CREATE OR REPLACE FUNCTION public.get_next_job()
RETURNS TABLE(id UUID, prompt TEXT, email TEXT, state JSONB, lead_id UUID) AS $$
DECLARE
    selected_job_id UUID;
BEGIN
    -- Select the oldest 'queued' job and lock it
    SELECT j.id INTO selected_job_id
    FROM public.jobs j
    WHERE j.status = 'queued'
    ORDER BY j.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED; -- Skip if another worker is already locking it

    -- If found, mark it as processing and return it
    IF selected_job_id IS NOT NULL THEN
        UPDATE public.jobs
        SET 
            status = 'processing',
            started_at = NOW(),
            updated_at = NOW()
        WHERE public.jobs.id = selected_job_id;

        RETURN QUERY SELECT j.id, j.prompt, j.email, j.state, j.lead_id FROM public.jobs j WHERE j.id = selected_job_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
