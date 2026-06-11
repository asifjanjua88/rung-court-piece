#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Band Rang — Container Health Validation Script
# Run after `start.sh` to confirm all 8 containers are healthy.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
COMPOSE_CMD="docker compose"
command -v docker compose >/dev/null 2>&1 || COMPOSE_CMD="docker-compose"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; FAILED=$((FAILED+1)); }
warn() { echo -e "${YELLOW}  ~${NC} $*"; }

FAILED=0

echo ""
echo "Band Rang — Container Validation"
echo "═══════════════════════════════════════"

# ── Container status ──────────────────────────────────────────────────────────
CONTAINERS=(nginx frontend api game-engine postgres redis postfix)
for svc in "${CONTAINERS[@]}"; do
  STATUS=$($COMPOSE_CMD ps --status running --services 2>/dev/null | grep -c "^${svc}$" || true)
  if [[ "$STATUS" -ge 1 ]]; then
    ok "$svc is running"
  else
    fail "$svc is NOT running"
  fi
done

echo ""
echo "Service Healthchecks"
echo "─────────────────────"

# ── PostgreSQL ────────────────────────────────────────────────────────────────
if $COMPOSE_CMD exec -T postgres pg_isready -U "${POSTGRES_USER:-bandrang}" >/dev/null 2>&1; then
  ok "PostgreSQL accepting connections"
else
  fail "PostgreSQL not ready"
fi

# ── Redis ─────────────────────────────────────────────────────────────────────
if $COMPOSE_CMD exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "Redis responding to PING"
else
  fail "Redis not responding"
fi

# ── API ───────────────────────────────────────────────────────────────────────
API_PORT="${API_PORT:-3001}"
if $COMPOSE_CMD exec -T api curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
  ok "API /health OK (port $API_PORT)"
else
  fail "API /health not responding"
fi

# ── Game Engine ───────────────────────────────────────────────────────────────
GE_PORT="${GAME_ENGINE_PORT:-3002}"
if $COMPOSE_CMD exec -T game-engine curl -sf "http://localhost:${GE_PORT}/health" >/dev/null 2>&1; then
  ok "Game Engine /health OK (port $GE_PORT)"
else
  fail "Game Engine /health not responding"
fi

# ── Nginx public check ────────────────────────────────────────────────────────
if curl -sf "http://localhost/" >/dev/null 2>&1; then
  ok "Nginx serving frontend on :80"
else
  warn "Nginx not responding on :80 (may need port-forward or domain)"
fi

# ── Database migrations ───────────────────────────────────────────────────────
echo ""
echo "Database Migrations"
echo "─────────────────────"
TABLES=(users rooms room_slots game_rounds admin_users admin_audit_log)
for tbl in "${TABLES[@]}"; do
  EXISTS=$($COMPOSE_CMD exec -T postgres psql -U "${POSTGRES_USER:-bandrang}" -d "${POSTGRES_DB:-bandrang}" \
    -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='${tbl}');" 2>/dev/null || echo "f")
  if echo "$EXISTS" | grep -q "t"; then
    ok "Table '$tbl' exists"
  else
    fail "Table '$tbl' MISSING — migrations may not have run"
  fi
done

# ── Admin seed ────────────────────────────────────────────────────────────────
echo ""
echo "Admin Account"
echo "─────────────────────"
ADMIN_EXISTS=$($COMPOSE_CMD exec -T postgres psql -U "${POSTGRES_USER:-bandrang}" -d "${POSTGRES_DB:-bandrang}" \
  -tAc "SELECT COUNT(*) FROM admin_users WHERE username='admin';" 2>/dev/null || echo "0")
if [[ "${ADMIN_EXISTS// /}" -ge 1 ]]; then
  ok "Admin user 'admin' seeded"
else
  fail "Admin user not found — check migration 004"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}All checks passed!${NC} Band Rang is healthy."
else
  echo -e "${RED}$FAILED check(s) failed.${NC}"
  echo "Run: docker compose logs <service-name> to investigate."
  exit 1
fi
echo ""
