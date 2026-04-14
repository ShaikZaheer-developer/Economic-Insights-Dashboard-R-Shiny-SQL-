-- =============================================================================
-- EconTrack Database Schema
-- Run this once: psql -U postgres -d econtrack -f schema.sql
-- =============================================================================

-- Drop & recreate for clean slate
DROP TABLE IF EXISTS price_alerts CASCADE;
DROP TABLE IF EXISTS live_ticker   CASCADE;
DROP TABLE IF EXISTS indicators    CASCADE;
DROP TABLE IF EXISTS countries     CASCADE;

-- ── Countries ──────────────────────────────────────────────────────────────
CREATE TABLE countries (
  code         CHAR(3)      PRIMARY KEY,
  name         VARCHAR(80)  NOT NULL,
  region       VARCHAR(50)  NOT NULL,
  income_group VARCHAR(30)  NOT NULL,
  currency     CHAR(3)      NOT NULL,
  flag_emoji   CHAR(4)      NOT NULL,
  lat          NUMERIC(8,4) NOT NULL,
  lng          NUMERIC(8,4) NOT NULL,
  population   BIGINT,
  gdp_usd_bn   NUMERIC(10,2)
);

INSERT INTO countries VALUES
  ('USA','United States',  'North America', 'High',         'USD','🇺🇸',  38.9, -77.0,  335000000, 25463.0),
  ('IND','India',          'Asia',          'Lower-Middle', 'INR','🇮🇳',  20.6,  78.9, 1400000000,  3730.0),
  ('DEU','Germany',        'Europe',        'High',         'EUR','🇩🇪',  51.2,  10.4,   84000000,  4072.0),
  ('CHN','China',          'Asia',          'Upper-Middle', 'CNY','🇨🇳',  35.9, 104.2, 1412000000, 17963.0),
  ('BRA','Brazil',         'South America', 'Upper-Middle', 'BRL','🇧🇷', -10.0, -53.0,  215000000,  1920.0),
  ('GBR','United Kingdom', 'Europe',        'High',         'GBP','🇬🇧',  55.4,  -3.4,   67000000,  3070.0),
  ('JPN','Japan',          'Asia',          'High',         'JPY','🇯🇵',  36.2, 138.3,  125000000,  4231.0),
  ('ZAF','South Africa',   'Africa',        'Upper-Middle', 'ZAR','🇿🇦', -28.5,  24.7,   60000000,   405.0),
  ('AUS','Australia',      'Oceania',       'High',         'AUD','🇦🇺', -25.3, 133.8,   26000000,  1693.0),
  ('CAN','Canada',         'North America', 'High',         'CAD','🇨🇦',  56.1, -106.3,  39000000,  2140.0);

-- ── Historical Indicators ──────────────────────────────────────────────────
CREATE TABLE indicators (
  id                  SERIAL       PRIMARY KEY,
  country_code        CHAR(3)      NOT NULL REFERENCES countries(code),
  year                SMALLINT     NOT NULL,
  quarter             SMALLINT,                       -- NULL = annual data
  gdp_growth          NUMERIC(6,2),
  inflation_rate      NUMERIC(6,2),
  consumer_spending   NUMERIC(6,2),
  unemployment_rate   NUMERIC(6,2),
  interest_rate       NUMERIC(6,2),
  current_account_pct NUMERIC(6,2),                  -- % of GDP
  debt_to_gdp         NUMERIC(6,2),
  fx_usd              NUMERIC(10,4),                  -- local per USD
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (country_code, year, quarter)
);

CREATE INDEX idx_indicators_country  ON indicators(country_code);
CREATE INDEX idx_indicators_year     ON indicators(year);

-- ── Live Ticker (updated by the Node server every few seconds) ────────────
CREATE TABLE live_ticker (
  country_code   CHAR(3)      PRIMARY KEY REFERENCES countries(code),
  gdp_growth     NUMERIC(6,2),
  inflation_rate NUMERIC(6,2),
  unemployment   NUMERIC(6,2),
  interest_rate  NUMERIC(6,2),
  fx_usd         NUMERIC(10,4),
  sentiment      NUMERIC(4,2),  -- -1.0 to +1.0 (mock market sentiment)
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Price Alerts (user-defined) ───────────────────────────────────────────
CREATE TABLE price_alerts (
  id           SERIAL       PRIMARY KEY,
  country_code CHAR(3)      REFERENCES countries(code),
  indicator    VARCHAR(30)  NOT NULL,
  threshold    NUMERIC(8,2) NOT NULL,
  direction    CHAR(5)      NOT NULL CHECK (direction IN ('above','below')),
  triggered    BOOLEAN      DEFAULT FALSE,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);
