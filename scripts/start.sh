#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Band Rang — Production Startup Script
# Usage: ./scripts/start.sh [--dev]
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[band-rang]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
error()   { echo -e "${RED}[error]${NC} $*"; exit 1; }

DEV=false
if [[ "${1:-}" == "--dev" ]]; then DEV=true; fi

# ── 1. Check prerequisites ───────────────────────────────────────────────────

command -v docker  >/dev/null 2>&1 || error "Docker not found. Install Docker first."
command -v docker compose >/dev/null 2>&1 || \
  command -v docker-compose >/dev/null 2>&1 || \
  error "docker compose not found."

COMPOSE_CMD="docker compose"
command -v docker compose >/dev/null 2>&1 || COMPOSE_CMD="docker-compose"

# ── 2. Check .env file ───────────────────────────────────────────────────────

if [[ ! -f "$ROOT/.env" ]]; then
  warn ".env not found — copying from .env.example"
  cp "$ROOT/.env.example" "$ROOT/.env"
  error "Please edit .env and set all required secrets, then re-run this script."
fi

# Required variables
REQUIRED_VARS=(
  JWT_SECRET
  REFRESH_TOKEN_SECRET
  ADMIN_JWT_SECRET
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  val=$(grep -E "^${var}=" "$ROOT/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [[ -z "$val" || "$val" == "changeme"* || "$val" == "CHANGE_ME"* ]]; then
    warn "  ✗ $var is not set or still has placeholder value"
    MISSING=$((MISSING + 1))
  fi
done

if [[ $MISSING -gt 0 ]]; then
  error "$MISSING required variable(s) missing or unset in .env. Fix them and retry."
fi

info "✓ .env validated"

# ── 3. Pull / build images ───────────────────────────────────────────────────

if [[ "$DEV" == "true" ]]; then
  info "Building dev images (hot-reload)…"
  $COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml build
else
  info "Building production images…"
  $COMPOSE_CMD build
fi

# ── 4. Start services ────────────────────────────────────────────────────────

if [[ "$DEV" == "true" ]]; then
  info "Starting in DEV mode (Mailpit on :8025, DB on :5432)…"
  $COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml up -d
else
  info "Starting in PRODUCTION mode…"
  $COMPOSE_CMD up -d
fi

# ── 5. Wait for core services to be healthy ──────────────────────────────────

info "Waiting for PostgreSQL…"
for i in $(seq 1 30); do
  if $COMPOSE_CMD exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
    info "✓ PostgreSQL ready"
    break
  fi
  if [[ $i -eq 30 ]]; then error "PostgreSQL did not become ready in time."; fi
  sleep 2
done

info "Waiting for Redis…"
for i in $(seq 1 20); do
  if $COMPOSE_CMD exec -T redis redis-cli ping | grep -q PONG; then
    info "✓ Redis ready"
    break
  fi
  if [[ $i -eq 20 ]]; then error "Redis did not become ready in time."; fi
  sleep 1
done

info "Waiting for API…"
for i in $(seq 1 30); do
  if curl -sf http://localhost/health >/dev/null 2>&1 || \
     $COMPOSE_CMD exec -T api curl -sf http://localhost:${API_PORT:-3001}/health >/dev/null 2>&1; then
    info "✓ API ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    warn "API health check not yet responding — check logs: docker compose logs api"
  fi
  sleep 2
done

# ── 6. Summary ───────────────────────────────────────────────────────────────

echo ""
info "═══════════════════════════════════════════════════"
info "  Band Rang is running!"
echo ""
if [[ "$DEV" == "true" ]]; then
  info "  Frontend:   http://localhost:3000"
  info "  API:        http://localhost:3001"
  info "  Game WS:    http://localhost:3002"
  info "  Mailpit UI: http://localhost:8025"
  info "  Postgres:   localhost:5432"
  info "  Redis:      localhost:6379"
else
  info "  App:        http://localhost  (or your domain)"
  info "  Admin:      http://localhost/admin"
  info "              Default: admin / Admin@1234"
  warn "  Change the admin password on first login!"
fi
info "═══════════════════════════════════════════════════"
echo ""
info "Logs:  docker compose logs -f"
info "Stop:  docker compose down"
