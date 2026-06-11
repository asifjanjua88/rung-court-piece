# Band Rang — Startup Guide

> Phase 1 Web App · Docker-first · No cloud vendor lock-in

---

## Prerequisites

| Tool | Min Version | Install |
|------|------------|---------|
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2 (plugin) | bundled with Docker Desktop |
| Git | any | https://git-scm.com |

> **No Node.js required on the host.** Everything runs inside containers.

---

## Quick Start (Development)

```bash
# 1. Clone / enter the project
cd "C:\02- Claude Coding\01-Card Game\band-rang"

# 2. Create your .env
cp .env.example .env
# Edit .env — set the secrets (see "Required Secrets" below)

# 3. Start in dev mode (hot-reload + Mailpit email UI)
bash scripts/start.sh --dev

# 4. Validate everything is healthy
bash scripts/validate.sh
```

**Dev URLs**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Game Engine (WS) | http://localhost:3002 |
| Mailpit (Email UI) | http://localhost:8025 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Quick Start (Production)

```bash
# 1. Edit .env — set your real domain, SMTP, strong secrets
nano .env

# 2. Start
bash scripts/start.sh

# 3. Validate
bash scripts/validate.sh
```

**Prod URL:** `http://your-server-ip` or `https://yourdomain.com` (after TLS setup)

---

## Required Secrets (.env)

Open `.env` and fill in these values before first run:

```
JWT_SECRET=<random 64-char string>
REFRESH_TOKEN_SECRET=<different random 64-char string>
ADMIN_JWT_SECRET=<another random 64-char string>
POSTGRES_PASSWORD=<strong db password>
```

Generate secrets quickly:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

---

## 8 Containers

| Container | Image / Build | Purpose |
|-----------|--------------|---------|
| `nginx` | `./nginx` | Reverse proxy, TLS termination, static files |
| `frontend` | `./frontend` | Next.js 14 App Router |
| `api` | `./api` | Express REST API |
| `game-engine` | `./game-engine` | Socket.io WebSocket server |
| `postgres` | `postgres:16-alpine` | Persistent game data |
| `redis` | `redis:7-alpine` | Sessions, pub/sub, cache |
| `postfix` | `boky/postfix` | Production SMTP (replaced by Mailpit in dev) |
| `mailpit` | `axllent/mailpit` | Dev email UI (dev only) |

---

## Database Migrations

Migrations run **automatically** on first `docker compose up` via the PostgreSQL `docker-entrypoint-initdb.d` mechanism.

| File | Creates |
|------|---------|
| `001_create_users.sql` | `users` table |
| `002_create_rooms.sql` | `rooms`, `room_slots` |
| `003_create_game_rounds.sql` | `game_rounds`, `kothi_counters` |
| `004_create_admin.sql` | `admin_users`, `admin_audit_log`, seeds admin account |

> **Note:** The init scripts only run when the PostgreSQL data volume is **empty** (new install). To re-run on an existing volume, drop the volume first: `docker compose down -v`.

---

## Admin Panel

| Field | Value |
|-------|-------|
| URL | http://localhost/admin |
| Username | `admin` |
| Default password | `Admin@1234` |

**You will be forced to change the password on first login.**

The admin panel provides:
- 📊 Dashboard — live game stats
- 👥 Users — list, suspend, delete guests
- 🏠 Rooms — active rooms, force-delete
- 📜 History — game history, leaderboard, shame board
- 💓 Health — DB/Redis ping, memory, uptime

---

## Common Commands

```bash
# Start (prod)
docker compose up -d

# Start (dev with hot-reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f game-engine

# Stop everything
docker compose down

# Stop and delete ALL data (⚠️ destructive)
docker compose down -v

# Rebuild after code changes
docker compose build api
docker compose up -d api

# Run unit tests (game logic)
docker compose exec game-engine npm test

# Open a PostgreSQL shell
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Open a Redis shell
docker compose exec redis redis-cli
```

---

## TLS / HTTPS (Production)

Option A — **Certbot + Let's Encrypt** (recommended for public servers):

```bash
# Install Certbot on the host
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certs into Nginx volume
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   nginx/ssl/key.pem

# Uncomment the HTTPS server block in nginx/nginx.conf, then reload:
docker compose exec nginx nginx -s reload
```

Option B — **Self-signed** (local/dev HTTPS testing):

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem \
  -subj "/CN=localhost"
```

---

## Environment Variables Reference

See `.env.example` for all variables with descriptions. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `ROOM_AUTOFILL_WAIT_SECONDS` | `3` | Seconds before vacant public room slots filled with AI |
| `ROOM_AUTOFILL_DIFFICULTY` | `medium` | AI difficulty for auto-filled slots |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `APP_URL` | `http://localhost` | Base URL for email links |
| `DOMAIN` | `localhost` | Used by Postfix for allowed sender domains |

---

## Architecture Overview

```
Browser / Mobile App
        │
        ▼
    [Nginx :80/443]
    ┌───┴──────────┐
    │              │
    ▼              ▼
[Frontend]    [/api/*] ──► [API :3001]
(Next.js)     [/ws/]  ──► [Game Engine :3002]
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              [PostgreSQL :5432]    [Redis :6379]
                                         │
                                   pub/sub (room:ready)
```

**Real-time flow:**
1. Player creates room via REST API
2. Auto-fill watcher fires after 3 s if slots are open → publishes `room:ready` to Redis
3. Game Engine subscribes to `room:ready` → starts game
4. All in-game events flow over WebSocket (Socket.io)
5. Each player only receives their own cards (hand privacy enforced server-side)

---

## Deploying to Any Linux Host

```bash
# On your server (Ubuntu/Debian):
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git

# Clone
git clone <your-repo> band-rang && cd band-rang

# Configure
cp .env.example .env && nano .env

# Start
bash scripts/start.sh
```

Works on: AWS EC2, GCP Compute Engine, Azure VM, DigitalOcean Droplet, on-premises, Raspberry Pi 4+.

---

## Phase 2 — Mobile App

The backend is **API-first**. React Native mobile apps connect to the same:
- REST API: `https://yourdomain.com/api/v1/*`
- WebSocket: `wss://yourdomain.com/ws/`

No backend changes needed for Phase 2. Just point the mobile app at your server URL.
