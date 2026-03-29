-- ============================================================
-- RPC: upsert_visibility_response
--
-- Called by Clay HTTP API columns (one per platform) after all
-- enrichment columns complete. Handles all multi-table logic
-- atomically: prompts → responses → citation_domains →
-- response_competitors.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_visibility_response(payload JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_prompt_id   UUID;
  v_response_id UUID;
BEGIN
  -- ── Upsert prompt ───────────────────────────────────────────
  INSERT INTO prompts (
    prompt_text, prompt_type, tags, topic, intent, pmm_use_case,
    pmm_classification, branded_or_non_branded, parent_brand,
    verb_modifier, noun_modifier, verb_noun, is_active, last_seen_at
  )
  VALUES (
    payload->>'prompt_text',
    payload->>'prompt_type',
    payload->>'tags',
    payload->>'topic',
    payload->>'intent',
    payload->>'pmm_use_case',
    payload->>'pmm_classification',
    payload->>'branded_or_non_branded',
    payload->>'parent_brand',
    payload->>'verb_modifier',
    payload->>'noun_modifier',
    payload->>'verb_noun',
    true,
    NOW()
  )
  ON CONFLICT (prompt_text) DO UPDATE SET
    prompt_type            = EXCLUDED.prompt_type,
    tags                   = EXCLUDED.tags,
    topic                  = EXCLUDED.topic,
    intent                 = EXCLUDED.intent,
    pmm_use_case           = EXCLUDED.pmm_use_case,
    pmm_classification     = EXCLUDED.pmm_classification,
    branded_or_non_branded = EXCLUDED.branded_or_non_branded,
    is_active              = true,
    last_seen_at           = NOW()
  RETURNING prompt_id INTO v_prompt_id;

  -- ── Upsert response ─────────────────────────────────────────
  -- run_date is stamped by Supabase (NOW()), not sent by Clay.
  -- run_day is the DATE-only column used for the unique index
  -- (prompt_id, platform, run_day) — same-day re-runs overwrite.
  INSERT INTO responses (
    run_date, run_day, prompt_id, platform,
    response_text, cited_urls, cited_domains, cited_titles,
    clay_mentioned, clay_mention_position, clay_mention_snippet,
    brand_sentiment, brand_sentiment_score,
    clay_recommended_followup, clay_followup_snippet,
    claygent_or_mcp_mentioned, number_of_tools_recommended,
    sentiment_score, citation_type, citations,
    competitors_mentioned, themes,
    primary_use_case_attributed, positioning_vs_competitors,
    total_credits_charged,
    prompt_type, tags, topic, intent,
    pmm_use_case, pmm_classification, branded_or_non_branded
  )
  VALUES (
    NOW(),
    CURRENT_DATE,
    v_prompt_id,
    payload->>'platform',
    payload->>'response_text',
    payload->'cited_urls',
    payload->'cited_domains',
    payload->'cited_titles',
    payload->>'clay_mentioned',
    (payload->>'clay_mention_position')::int,
    payload->>'clay_mention_snippet',
    payload->>'brand_sentiment',
    (payload->>'brand_sentiment_score')::int,
    payload->>'clay_recommended_followup',
    payload->>'clay_followup_snippet',
    payload->>'claygent_or_mcp_mentioned',
    (payload->>'number_of_tools_recommended')::int,
    (payload->>'sentiment_score')::int,
    payload->>'citation_type',
    payload->'citations',
    payload->'competitors_mentioned',
    payload->'themes',
    payload->>'primary_use_case_attributed',
    payload->>'positioning_vs_competitors',
    (payload->>'total_credits_charged')::float,
    payload->>'prompt_type',
    payload->>'tags',
    payload->>'topic',
    payload->>'intent',
    payload->>'pmm_use_case',
    payload->>'pmm_classification',
    payload->>'branded_or_non_branded'
  )
  ON CONFLICT (prompt_id, platform, run_day) DO UPDATE SET
    response_text               = EXCLUDED.response_text,
    clay_mentioned              = EXCLUDED.clay_mentioned,
    clay_mention_position       = EXCLUDED.clay_mention_position,
    clay_mention_snippet        = EXCLUDED.clay_mention_snippet,
    brand_sentiment             = EXCLUDED.brand_sentiment,
    brand_sentiment_score       = EXCLUDED.brand_sentiment_score,
    clay_recommended_followup   = EXCLUDED.clay_recommended_followup,
    clay_followup_snippet       = EXCLUDED.clay_followup_snippet,
    claygent_or_mcp_mentioned   = EXCLUDED.claygent_or_mcp_mentioned,
    number_of_tools_recommended = EXCLUDED.number_of_tools_recommended,
    sentiment_score             = EXCLUDED.sentiment_score,
    citation_type               = EXCLUDED.citation_type,
    citations                   = EXCLUDED.citations,
    cited_urls                  = EXCLUDED.cited_urls,
    cited_domains               = EXCLUDED.cited_domains,
    cited_titles                = EXCLUDED.cited_titles,
    competitors_mentioned       = EXCLUDED.competitors_mentioned,
    themes                      = EXCLUDED.themes,
    primary_use_case_attributed = EXCLUDED.primary_use_case_attributed,
    positioning_vs_competitors  = EXCLUDED.positioning_vs_competitors,
    total_credits_charged       = EXCLUDED.total_credits_charged,
    prompt_type                 = EXCLUDED.prompt_type,
    tags                        = EXCLUDED.tags,
    topic                       = EXCLUDED.topic,
    intent                      = EXCLUDED.intent,
    pmm_use_case                = EXCLUDED.pmm_use_case,
    pmm_classification          = EXCLUDED.pmm_classification,
    branded_or_non_branded      = EXCLUDED.branded_or_non_branded
  RETURNING id INTO v_response_id;

  -- ── Replace citation_domains for this response ──────────────
  DELETE FROM citation_domains WHERE response_id = v_response_id;

  INSERT INTO citation_domains (
    response_id, run_date, prompt_id, platform,
    domain, url, title, citation_type, url_type
  )
  SELECT
    v_response_id, NOW(), v_prompt_id, payload->>'platform',
    c->>'domain', c->>'url', c->>'title', c->>'type', c->>'urlType'
  FROM jsonb_array_elements(
    COALESCE(payload->'citations', '[]'::jsonb)
  ) AS c
  WHERE c->>'url' IS NOT NULL;

  -- ── Replace response_competitors for this response ──────────
  DELETE FROM response_competitors WHERE response_id = v_response_id;

  INSERT INTO response_competitors (
    response_id, run_date, prompt_id, platform, competitor_name
  )
  SELECT
    v_response_id, NOW(), v_prompt_id, payload->>'platform',
    comp.value
  FROM jsonb_array_elements_text(
    COALESCE(payload->'competitors_mentioned', '[]'::jsonb)
  ) AS comp(value)
  WHERE comp.value IS NOT NULL AND comp.value <> '';

END;
$$;

-- ── Grant execute to anon + authenticated (required for Clay HTTP API) ────────
GRANT EXECUTE ON FUNCTION upsert_visibility_response(JSONB) TO anon, authenticated;
