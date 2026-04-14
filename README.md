# EconTrack — Global Economic Intelligence Platform

> A startup-grade real-time economic dashboard. Live WebSocket ticker, interactive world map, 10 countries, 5 indicators, 24 years of data, PostgreSQL backend, Chart.js visualisations.

---

## Architecture

```
econtrack/
├── frontend/
│   └── index.html          ← Single-file SPA (zero build step)
└── backend/
    ├── server.js           ← Express REST API + WebSocket server
    ├── schema.sql          ← PostgreSQL tables
    ├── seed.js             ← Populates database
    ├── package.json
    └── .env.example        ← Copy to .env and fill in credentials
```

---

## Option A — Run without a backend (instant, no setup)

Just open `frontend/index.html` in any browser.

The app runs fully offline using embedded mock data and simulates
real-time WebSocket ticks every 3 seconds. **All charts, map, filters,
forecast, and data table work immediately.**

---

## Option B — Full PostgreSQL + Node.js backend

### 1. Install PostgreSQL

**Windows:** https://www.postgresql.org/download/windows/
**Mac:**     `brew install postgresql@16 && brew services start postgresql@16`
**Linux:**   `sudo apt install postgresql postgresql-contrib`

### 2. Create the database

```bash
psql -U postgres
CREATE DATABASE econtrack;
\q
```

### 3. Run the schema

```bash
psql -U postgres -d econtrack -f backend/schema.sql
```

### 4. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit .env with your DB credentials
```

### 5. Install Node dependencies and seed data

```bash
cd backend
npm install
node seed.js
# Output: ✅ Seeding complete! 240 indicator rows inserted.
```

### 6. Start the server

```bash
node server.js
# Output:
# 🚀 EconTrack API running on http://localhost:3001
# 📡 WebSocket on ws://localhost:3001/ws
```

### 7. Open the frontend

Open `frontend/index.html` in your browser.
It auto-detects the backend at `localhost:3001` and switches from mock data
to real PostgreSQL data + live WebSocket updates.

---

## Option C — Cloud database (Neon / Supabase / Railway)

These are free-tier PostgreSQL providers — no local installation needed.

### Neon (recommended — free, serverless)

1. Sign up at https://neon.tech
2. Create a project called `econtrack`
3. Copy the connection string from the dashboard
4. In `backend/.env`:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/econtrack?sslmode=require
   ```
5. Run: `node seed.js` then `node server.js`

### Supabase

1. Sign up at https://supabase.com
2. Create project → Settings → Database → Connection String
3. Use the URI in `DATABASE_URL` (add `?sslmode=require`)

### Railway

1. Sign up at https://railway.app
2. New project → Add PostgreSQL
3. Copy `DATABASE_URL` from Variables tab

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/countries` | All 10 countries with metadata |
| GET | `/api/indicators?countries=USA,IND&yearFrom=2010&yearTo=2023` | Historical data |
| GET | `/api/summary?countries=USA,IND&yearFrom=2010&yearTo=2023` | Aggregated averages |
| GET | `/api/ticker` | Latest live values for all countries |
| GET | `/api/correlation?countries=USA,IND,DEU` | Pearson correlation matrix |
| GET | `/api/forecast/USA` | 3-year linear trend projection |
| WS  | `ws://localhost:3001/ws` | Real-time ticker (3s interval) |

---

## Features

| Feature | Details |
|---------|---------|
| **Real-time ticker** | WebSocket updates every 3s with micro-fluctuations |
| **World map** | Leaflet.js + OpenStreetMap, colour-coded by any indicator |
| **5 chart types** | Line, bar, scatter, radar, heatmap |
| **Correlation matrix** | Pearson r computed live across selected countries/years |
| **Decade heatmap** | 2000s / 2010s / 2020s performance comparison |
| **3-year forecast** | Linear regression projection with confidence bands |
| **Data table** | Sortable, searchable, CSV export, 2400 rows |
| **Responsive** | Works on mobile, tablet, desktop |

---

## GitHub Push

```bash
cd econtrack
git init
git add .
git commit -m "feat: EconTrack — startup-grade economic intelligence dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/econtrack.git
git push -u origin main
```

---

## Deploy Frontend (free)

**Netlify:** Drag `frontend/` folder to https://app.netlify.com/drop

**GitHub Pages:**
```bash
# In repo Settings → Pages → Source: Deploy from branch → /frontend
```

## Deploy Backend (free)

**Railway:**
1. Connect GitHub repo
2. Set root directory to `backend/`
3. Add environment variables from `.env`
4. Railway auto-deploys on push

**Render:**
1. New Web Service → connect repo
2. Root directory: `backend`
3. Start command: `node server.js`

---

## Bullet Points This Project Demonstrates

- **"Real-time WebSocket feed"** → `server.js` broadcasts live ticker every 3s to all connected clients
- **"PostgreSQL with parameterised queries"** → all SQL in `server.js` uses `$1, $2, ...` params
- **"REST API design"** → 7 endpoints with proper HTTP status codes and error handling
- **"Interactive data visualisations"** → Chart.js line, bar, scatter, radar, heatmap
- **"Geospatial integration"** → Leaflet.js world map with live data markers and popups
- **"Correlation analysis"** → Pearson r matrix computed server-side and client-side
- **"Forecast modelling"** → Linear regression with 3-year projection
- **"Full-stack single-page application"** → No framework, pure HTML/CSS/JS frontend + Node backend

*Built by **Zaheer***
