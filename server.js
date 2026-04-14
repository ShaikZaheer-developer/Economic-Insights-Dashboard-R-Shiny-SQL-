// server.js — EconTrack API Server
// Express REST API + WebSocket for real-time ticker updates

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const compression = require('compression');
const http       = require('http');
const { WebSocketServer } = require('ws');
const { Pool }   = require('pg');

// ── Database Pool ─────────────────────────────────────────────────────────
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'econtrack',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      }
);

pool.on('error', err => console.error('DB pool error:', err.message));

// ── Express App ───────────────────────────────────────────────────────────
const app = express();
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── GET /api/countries ─────────────────────────────────────────────────────
app.get('/api/countries', async (_, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM countries ORDER BY name'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/indicators?countries=USA,IND&yearFrom=2010&yearTo=2023 ────────
app.get('/api/indicators', async (req, res) => {
  try {
    const countries = req.query.countries
      ? req.query.countries.split(',').map(c => c.trim().toUpperCase())
      : null;
    const yearFrom = parseInt(req.query.yearFrom) || 2000;
    const yearTo   = parseInt(req.query.yearTo)   || 2023;

    let sql = `
      SELECT i.*, c.name as country_name, c.flag_emoji, c.region
      FROM indicators i
      JOIN countries c ON c.code = i.country_code
      WHERE i.year >= $1 AND i.year <= $2
    `;
    const params = [yearFrom, yearTo];

    if (countries && countries.length) {
      sql += ` AND i.country_code = ANY($3)`;
      params.push(countries);
    }
    sql += ' ORDER BY i.country_code, i.year';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/summary?countries=USA,IND&yearFrom=2010&yearTo=2023 ───────────
app.get('/api/summary', async (req, res) => {
  try {
    const countries = req.query.countries
      ? req.query.countries.split(',').map(c => c.trim().toUpperCase())
      : null;
    const yearFrom = parseInt(req.query.yearFrom) || 2000;
    const yearTo   = parseInt(req.query.yearTo)   || 2023;

    let sql = `
      SELECT
        i.country_code,
        c.name         AS country_name,
        c.flag_emoji,
        c.region,
        ROUND(AVG(i.gdp_growth)::numeric,        2) AS avg_gdp,
        ROUND(AVG(i.inflation_rate)::numeric,     2) AS avg_inflation,
        ROUND(AVG(i.consumer_spending)::numeric,  2) AS avg_spending,
        ROUND(AVG(i.unemployment_rate)::numeric,  2) AS avg_unemployment,
        ROUND(AVG(i.interest_rate)::numeric,      2) AS avg_interest,
        ROUND(AVG(i.debt_to_gdp)::numeric,        2) AS avg_debt,
        MIN(i.year) AS from_year,
        MAX(i.year) AS to_year,
        COUNT(*)    AS data_points
      FROM indicators i
      JOIN countries c ON c.code = i.country_code
      WHERE i.year >= $1 AND i.year <= $2
    `;
    const params = [yearFrom, yearTo];
    if (countries && countries.length) {
      sql += ' AND i.country_code = ANY($3)';
      params.push(countries);
    }
    sql += ' GROUP BY i.country_code, c.name, c.flag_emoji, c.region ORDER BY avg_gdp DESC';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/ticker — latest live values ───────────────────────────────────
app.get('/api/ticker', async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, c.name, c.flag_emoji, c.region, c.lat, c.lng
      FROM live_ticker t
      JOIN countries c ON c.code = t.country_code
      ORDER BY t.country_code
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/correlation?countries=USA,IND,DEU&yearFrom=2010&yearTo=2023 ──
app.get('/api/correlation', async (req, res) => {
  try {
    const countries = req.query.countries
      ? req.query.countries.split(',').map(c => c.trim().toUpperCase())
      : ['USA','IND','DEU','CHN'];
    const yearFrom = parseInt(req.query.yearFrom) || 2000;
    const yearTo   = parseInt(req.query.yearTo)   || 2023;

    const { rows } = await pool.query(`
      SELECT gdp_growth, inflation_rate, consumer_spending, unemployment_rate, interest_rate
      FROM indicators
      WHERE country_code = ANY($1) AND year BETWEEN $2 AND $3
      AND gdp_growth IS NOT NULL
    `, [countries, yearFrom, yearTo]);

    // Compute correlation matrix in JS
    const fields = ['gdp_growth','inflation_rate','consumer_spending','unemployment_rate','interest_rate'];
    const matrix = {};
    for (const fx of fields) {
      matrix[fx] = {};
      for (const fy of fields) {
        const xs = rows.map(r => parseFloat(r[fx]));
        const ys = rows.map(r => parseFloat(r[fy]));
        matrix[fx][fy] = pearson(xs, ys);
      }
    }
    res.json(matrix);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function pearson(xs, ys) {
  const n = xs.length;
  if (n === 0) return 0;
  const mx = xs.reduce((a,b)=>a+b,0)/n;
  const my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for (let i=0;i<n;i++) {
    num += (xs[i]-mx)*(ys[i]-my);
    dx  += (xs[i]-mx)**2;
    dy  += (ys[i]-my)**2;
  }
  const denom = Math.sqrt(dx*dy);
  return denom===0 ? 0 : parseFloat((num/denom).toFixed(4));
}

// ── GET /api/forecast/:code — simple linear forecast ──────────────────────
app.get('/api/forecast/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { rows } = await pool.query(`
      SELECT year, gdp_growth, inflation_rate, unemployment_rate
      FROM indicators WHERE country_code=$1 ORDER BY year
    `, [code]);
    if (!rows.length) return res.status(404).json({ error: 'Country not found' });

    const forecast = {};
    ['gdp_growth','inflation_rate','unemployment_rate'].forEach(field => {
      const vals = rows.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
      const n = vals.length;
      const xs = Array.from({length:n},(_,i)=>i);
      const mx = (n-1)/2;
      const my = vals.reduce((a,b)=>a+b,0)/n;
      let num=0,den=0;
      for (let i=0;i<n;i++){num+=(xs[i]-mx)*(vals[i]-my);den+=(xs[i]-mx)**2;}
      const slope = den===0?0:num/den;
      const intercept = my - slope*mx;
      // Forecast next 3 years
      forecast[field] = [1,2,3].map(d => ({
        year: 2024+d-1,
        value: parseFloat((intercept+slope*(n+d-1)).toFixed(2))
      }));
    });
    res.json({ country: code, forecast });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── WebSocket — Real-time ticker ───────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });
const WS_TICK = parseInt(process.env.WS_TICK_MS) || 3000;

// Simulate micro-fluctuations in live data
async function broadcastTick() {
  try {
    // Add tiny random noise to simulate live market data
    await pool.query(`
      UPDATE live_ticker SET
        gdp_growth     = ROUND((gdp_growth     + (RANDOM()-0.5)*0.05)::numeric, 2),
        inflation_rate = ROUND((inflation_rate + (RANDOM()-0.5)*0.03)::numeric, 2),
        unemployment   = ROUND((unemployment   + (RANDOM()-0.5)*0.02)::numeric, 2),
        fx_usd         = ROUND((fx_usd         + (RANDOM()-0.5)*0.01)::numeric, 4),
        sentiment      = ROUND(LEAST(1, GREATEST(-1, sentiment + (RANDOM()-0.5)*0.1))::numeric, 3),
        updated_at     = NOW()
    `);
    const { rows } = await pool.query(`
      SELECT t.*, c.name, c.flag_emoji
      FROM live_ticker t JOIN countries c ON c.code=t.country_code
    `);
    const payload = JSON.stringify({ type: 'TICKER_UPDATE', data: rows, ts: Date.now() });
    wss.clients.forEach(ws => {
      if (ws.readyState === 1) ws.send(payload);
    });
  } catch(e) { /* ignore during reconnect */ }
}

wss.on('connection', async (ws) => {
  console.log(`WS client connected (total: ${wss.clients.size})`);
  // Send current data immediately on connect
  try {
    const { rows } = await pool.query(`
      SELECT t.*, c.name, c.flag_emoji
      FROM live_ticker t JOIN countries c ON c.code=t.country_code
    `);
    ws.send(JSON.stringify({ type: 'TICKER_INIT', data: rows, ts: Date.now() }));
  } catch(e) {}
  ws.on('close', () => console.log(`WS client disconnected (total: ${wss.clients.size})`));
  ws.on('error', () => {});
});

setInterval(broadcastTick, WS_TICK);

const PORT = parseInt(process.env.PORT) || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 EconTrack API running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}/ws`);
  console.log(`🗄️  PostgreSQL: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'econtrack'}\n`);
});
