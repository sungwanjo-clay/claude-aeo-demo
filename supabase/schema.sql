-- ============================================================
-- AI Visibility Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS prompts (
  prompt_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text             TEXT UNIQUE NOT NULL,
  prompt_type             TEXT,                     -- 'benchmark' or null
  tags                    TEXT,                     -- free-form tag e.g. 'sculptor cup event'
  topic                   TEXT,
  intent                  TEXT,
  pmm_use_case            TEXT,
  pmm_classification      TEXT,
  branded_or_non_branded  TEXT,
  parent_brand            TEXT,
  verb_modifier           TEXT,
  noun_modifier           TEXT,
  verb_noun               TEXT,
  is_active               BOOLEAN DEFAULT true,     -- false when prompt is deleted from Clay
  last_seen_at            TIMESTAMPTZ,              -- updated each time Clay fires for this prompt
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS responses (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date                    TIMESTAMPTZ DEFAULT now(),
  prompt_id                   UUID REFERENCES prompts(prompt_id),
  platform                    TEXT NOT NULL,          -- 'ChatGPT', 'Claude'
  ai_model_version            TEXT,
  response_text               TEXT,
  cited_urls                  JSONB,
  cited_domains               JSONB,
  cited_titles                JSONB,
  clay_mentioned              TEXT,                   -- 'Yes' or 'No'
  clay_mention_position       INTEGER,
  clay_mention_snippet        TEXT,
  brand_sentiment             TEXT,                   -- 'Positive', 'Neutral', 'Negative', 'Not Mentioned'
  brand_sentiment_score       INTEGER,                -- 0-100
  clay_recommended_followup   TEXT,                   -- 'Yes' or 'No'
  clay_followup_snippet       TEXT,
  claygent_or_mcp_mentioned   TEXT,                   -- 'Yes' or 'No'
  number_of_tools_recommended INTEGER,
  sentiment_score             INTEGER,                -- 1-10 response quality score
  citation_type               TEXT,
  citations                   JSONB,
  competitors_mentioned       JSONB,                  -- array of strings
  themes                      JSONB,                  -- [{theme, sentiment, snippet}]
  primary_use_case_attributed TEXT,
  positioning_vs_competitors  TEXT,
  total_credits_charged       FLOAT,
  -- denormalized from prompts for query performance
  prompt_type                 TEXT,
  tags                        TEXT,
  topic                       TEXT,
  intent                      TEXT,
  pmm_use_case                TEXT,
  pmm_classification          TEXT,
  branded_or_non_branded      TEXT,
  run_day                     DATE NOT NULL DEFAULT CURRENT_DATE  -- date-only for unique index (TIMESTAMPTZ cast is not immutable)
);

CREATE TABLE IF NOT EXISTS response_competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id     UUID REFERENCES responses(id) ON DELETE CASCADE,
  run_date        TIMESTAMPTZ,
  prompt_id       UUID REFERENCES prompts(prompt_id),
  platform        TEXT,
  competitor_name TEXT
);

CREATE TABLE IF NOT EXISTS citation_domains (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   UUID REFERENCES responses(id) ON DELETE CASCADE,
  run_date      TIMESTAMPTZ,
  prompt_id     UUID REFERENCES prompts(prompt_id),
  platform      TEXT,
  domain        TEXT,
  url           TEXT,
  title         TEXT,
  citation_type TEXT,
  url_type      TEXT
);

CREATE TABLE IF NOT EXISTS anomalies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at    TIMESTAMPTZ DEFAULT now(),
  run_date       DATE,
  metric         TEXT,
  platform       TEXT,
  topic          TEXT,
  current_value  FLOAT,
  previous_value FLOAT,
  delta          FLOAT,
  direction      TEXT,
  severity       TEXT,
  message        TEXT,
  dismissed      BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS insights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date       DATE UNIQUE,
  insight_text   TEXT,
  insight_type   TEXT,
  supporting_data JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── Unique index on responses (expression-based constraints not supported inline) ──
CREATE UNIQUE INDEX IF NOT EXISTS responses_prompt_platform_date_uniq
  ON responses (prompt_id, platform, run_day);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_responses_run_date      ON responses (run_date);
CREATE INDEX IF NOT EXISTS idx_responses_run_day       ON responses (run_day);
CREATE INDEX IF NOT EXISTS idx_responses_platform      ON responses (platform);
CREATE INDEX IF NOT EXISTS idx_responses_prompt_id     ON responses (prompt_id);
CREATE INDEX IF NOT EXISTS idx_responses_clay_mentioned ON responses (clay_mentioned);
CREATE INDEX IF NOT EXISTS idx_response_competitors_run_date ON response_competitors (run_date);
CREATE INDEX IF NOT EXISTS idx_citation_domains_run_date     ON citation_domains (run_date);
CREATE INDEX IF NOT EXISTS idx_prompts_is_active        ON prompts (is_active);

-- ── Scheduled job: mark inactive prompts (run daily via pg_cron) ──────────────
-- SELECT cron.schedule('mark-inactive-prompts', '0 3 * * *', $$
--   UPDATE prompts
--   SET is_active = false
--   WHERE last_seen_at < NOW() - INTERVAL '7 days'
--     AND is_active = true;
-- $$);
