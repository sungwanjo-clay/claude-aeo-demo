-- ============================================================
-- Utility: backfill_prompt_metadata
--
-- Use this when you need a metadata change (topic, intent,
-- tags, prompt_type, classification) to propagate backward
-- to all historical response rows for a given prompt.
--
-- By default, historical rows are NOT updated — they keep the
-- metadata in effect at ingest time. Only call this function
-- deliberately when you need a full retroactive reclassification.
--
-- Usage:
--   SELECT backfill_prompt_metadata('b2b how to generate leads');
-- ============================================================

CREATE OR REPLACE FUNCTION backfill_prompt_metadata(p_prompt_text TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE responses r
  SET
    topic                  = p.topic,
    intent                 = p.intent,
    pmm_use_case           = p.pmm_use_case,
    pmm_classification     = p.pmm_classification,
    branded_or_non_branded = p.branded_or_non_branded,
    prompt_type            = p.prompt_type,
    tags                   = p.tags
  FROM prompts p
  WHERE r.prompt_id = p.prompt_id
    AND p.prompt_text = p_prompt_text;
END;
$$;


-- ============================================================
-- Utility: mark_inactive_prompts (run daily via pg_cron)
--
-- Marks prompts as inactive if Clay hasn't fired them in 7+
-- days — indicating the row was deleted from the Clay table.
-- Active prompts continue to receive data and reset is_active
-- to true on each fire.
-- ============================================================

CREATE OR REPLACE FUNCTION mark_inactive_prompts()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE prompts
  SET is_active = false
  WHERE last_seen_at < NOW() - INTERVAL '7 days'
    AND is_active = true;
END;
$$;

-- Schedule daily at 03:00 UTC (requires pg_cron extension):
-- SELECT cron.schedule('mark-inactive-prompts', '0 3 * * *', 'SELECT mark_inactive_prompts()');
