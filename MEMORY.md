# Band Rang — Project Memory File
> Read this file at the start of every session to restore full context.
> Update this file whenever significant changes are made.
> Last updated: 2026-06-06

---

## Project Identity

- **Name:** Band Rang (Closed Rung) — a 4-player, 2-team trick-taking card game
- **Root folder:** `C:\02- Claude Coding\01-Card Game\band-rang\`
- **Phase:** Phase 1 (Web App) — COMPLETE
- **Phase 2 (future):** React Native mobile app using the same backend

---

## Architecture

```
Browser
  │
  ▼
Nginx :80/:443  (reverse proxy + static files)
  ├── /          → frontend (Next.js 14, App Router, TypeScript, Tailwind)
  ├── /api/*     → api (Express, REST, JWT auth)
  └── /ws/       → game-engine (Socket.io WebSocket)
         │
    ┌────┴────┐
 PostgreSQL  Redis
  :5432       :6379
```

**8 Docker containers:** nginx, frontend, api, game-engine, postgres, redis, postfix, mailpit (dev only)

**No cloud vendor lock-in.** Runs on any Linux host with Docker.

---

## Key Technical Decisions

| Concern | Choice |
|---------|--------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| State | Zustand (auth, game, room stores) |
| HTTP client | Axios + auto-refresh interceptor on 401 |
| WebSocket | Socket.io (client + server) |
| Backend | Express.js + Zod validation |
| Database | PostgreSQL 16 |
| Cache/PubSub | Redis 7 |
| Auth | JWT access (15m) + refresh tokens; bcryptjs 12 rounds |
| Admin auth | Separate JWT secret (`ADMIN_JWT_SECRET`) |
| Email | Nodemailer + Postfix (prod) / Mailpit (dev) |
| AI | Rule-based only (no ML): EasyBrain, MediumBrain, HardBrain |
| Auto-fill | In-memory setTimeout + Redis pub/sub |
| Play direction | Counter-clockwise |
| Rate limiting | 10 auth/15min, 120 API/min |

---

## Game Rules (Critical — do not get wrong)

### Core
- 4 players, 2 teams: Team A (positions 0,2) vs Team B (positions 1,3)
- 52-card deck, deal **5 + 4 + 4** counter-clockwise
- Position 0 wins toss → becomes **Rung Holder** (selects Hidden Rung from first 5 cards)

### Scenario A — Hidden Rung
- Rung Holder places one card face-down as trump (removed from play)
- Trump revealed only when a player **cannot follow suit**
- **Rung Holder team wins:** 2 consecutive tricks starting from trick 8+ (index 7+)
- **Opponent team wins:** 2 consecutive tricks from the trick trump was revealed onward

### Scenario B — Open Rung
- Rung Holder leads and announces trump suit openly
- **Non-calling team wins:** 2 consecutive tricks from trick 2+ (index 1+)
- **Calling team wins:** opponents never achieve their condition after 13 tricks

### Special Rules
- **Ace Exception:** If an Ace wins the trick that would end the game, the game does NOT end. The same team must win the VERY NEXT trick with a non-Ace card.
- **Kothi counter:** Tracks wins/losses across rounds (±4 = Kothi shame marker, resets to 0)
- **Revoke:** Playing off-suit when you can follow = foul; other team wins immediately
- **Trick 13 fallback:** If no win condition met after all 13 tricks, last trick winner wins

### AI Difficulty — IMPORTANT CORRECTIONS
- **Easy:** Random rung card, never calls color, 20% random suboptimal play
- **Medium:** Mid-value card of best suit as rung, calls color with 4+ cards, tracks current trick only
- **Hard:** **STRONGEST (highest rank) card of best suit as Hidden Rung** (sacrificed but establishes best trump), full card memory by elimination, partner-aware, minimum trump to win

### Auto-fill
- Wait: **3 seconds** (ROOM_AUTOFILL_WAIT_SECONDS=3)
- Only fills VACANT slots; never touches slots with real players
- Difficulty: medium by default

---

## Auth System

- **Guest:** UUID, display name "Player#XXXX", 24hr token, no email
- **Email user:** register → email verify (15min token) → login → play
- **No SMS/phone auth** (explicit requirement)
- **Forgot password:** always returns same 200 response (anti-enumeration)
- **Guest upgrade:** can convert to email account, preserves history
- **Admin:** separate table, separate JWT, forced password change on first login

### Default Admin Credentials
- Username: `admin`
- Password: `Admin@1234`
- Must change on first login (enforced server-side)

---

## Complete File Map

### Root
```
band-rang/
├── .env.example
├── .gitignore
├── docker-compose.yml         ← 8 containers with healthchecks
├── docker-compose.dev.yml     ← Mailpit, hot-reload, exposed DB ports
├── STARTUP_GUIDE.md
├── MEMORY.md                  ← THIS FILE
└── scripts/
    ├── start.sh               ← Start + .env validation
    └── validate.sh            ← Container + DB health checks
```

### Nginx
```
nginx/
├── Dockerfile
└── nginx.conf                 ← /api/* → api, /ws/ → game-engine WS
```

### Frontend (`frontend/src/`)
```
app/
├── layout.tsx
├── page.tsx                   ← Landing (Guest / Login / Register)
├── login/page.tsx
├── register/page.tsx
├── verify-email/page.tsx
├── forgot-password/page.tsx
├── reset-password/page.tsx
├── lobby/page.tsx             ← Public rooms, 5s refresh, nav links
├── room/[id]/page.tsx         ← Waiting room, 3s countdown
├── game/[roomId]/page.tsx     ← Full felt table game UI
├── stats/page.tsx             ← My Stats (win rate, streak, scenarios)
├── stats/history/page.tsx     ← Paginated match history
├── leaderboard/page.tsx       ← Public ranked leaderboard
└── admin/
    ├── layout.tsx
    ├── login/page.tsx
    ├── dashboard/page.tsx
    ├── users/page.tsx
    ├── rooms/page.tsx
    ├── history/page.tsx
    └── health/page.tsx

components/
├── ui/Spinner.tsx, Modal.tsx, Alert.tsx
├── lobby/CreateRoomModal.tsx, JoinPrivateModal.tsx
└── game/
    ├── PlayingCard.tsx        ← CSS card, 3 sizes, selected/disabled/faceDown
    ├── ScoreBoard.tsx         ← Trump indicator, trick#, kothi counter
    ├── ColorCallOverlay.tsx   ← Suit picker or "waiting" for Rung Holder
    ├── HiddenRungPicker.tsx   ← Select from hand, confirm
    └── RoundOverlay.tsx       ← Win/loss, kothi award, play again

services/api.service.ts        ← Axios + auto-refresh on 401
services/socket.service.ts     ← Socket.io singleton
store/auth.store.ts            ← Zustand persisted (user, tokens)
store/game.store.ts            ← Game state, hand, selectedCard
store/room.store.ts            ← currentRoom, publicRooms
hooks/useAuth.ts               ← playAsGuest, login, register, logout
hooks/useGameSocket.ts         ← All WS event listeners + emit helpers
types/user.types.ts, room.types.ts, game.types.ts
tailwind.config.ts             ← Custom: felt, gold, trump colors; animations
app/globals.css                ← Custom classes: .playing-card, .felt-table, etc.
```

### API (`api/src/`)
```
index.ts                       ← Express app; /health endpoint
db/postgres.ts                 ← pg.Pool
db/redis.ts                    ← ioredis
middleware/
├── auth.middleware.ts         ← JWT verify → req.user
├── admin.middleware.ts        ← Admin JWT verify + role check
└── rate-limit.ts              ← authLimiter, apiLimiter
services/
├── auth.service.ts            ← createGuest, register, verify, login, refresh, forgot/reset, upgradeGuest
├── email.service.ts           ← Nodemailer verify + reset templates
├── room.service.ts            ← Room CRUD + scheduleAutoFill integration
├── room-watcher.service.ts    ← setTimeout auto-fill (3s), Redis pub room:ready
└── stats.service.ts           ← getMyStats, getLeaderboard, getMatchHistory
controllers/
├── auth.controller.ts
├── room.controller.ts
├── stats.controller.ts
└── admin/
    ├── admin-auth.controller.ts
    ├── admin-dashboard.controller.ts
    ├── admin-users.controller.ts
    ├── admin-rooms.controller.ts
    ├── admin-history.controller.ts
    └── admin-health.controller.ts
routes/auth.routes.ts, room.routes.ts, stats.routes.ts, admin.routes.ts
```

### Game Engine (`game-engine/src/`)
```
index.ts                       ← Socket.io server; /health HTTP; Redis subscriber
game/
├── Deck.ts                    ← buildDeck, shuffle, dealBatches(5+4+4), rankValue, SUITS, RANK_ORDER
├── Trick.ts                   ← evaluateTrick, canFollowSuit, TrickCard
├── WinCondition.ts            ← checkWinScenarioA, checkWinScenarioB
├── AceException.ts            ← isAceException, resolveAceException
├── GameStateMachine.ts        ← Phases: toss→dealing_batch1→rung_selection→dealing_batch2→dealing_batch3→color_call→playing→round_over
└── GameRoom.ts                ← WS event router; per-player hand dispatch (privacy)
ai/
├── AIPlayer.ts                ← AIContext interface, difficulty router
├── EasyBrain.ts
├── MediumBrain.ts
└── HardBrain.ts
__tests__/
├── Deck.test.ts               ← 52 cards, shuffle, deal batches, rankValue
├── Trick.test.ts              ← Trump logic, canFollowSuit
├── WinCondition.test.ts       ← Scenario A + B all paths
├── AceException.test.ts       ← Block, resolve, reset
└── AIBrains.test.ts           ← All 3 brains, chooseCard, chooseHiddenRung, shouldCallColor
```

### Database (`postgres/migrations/`)
```
001_create_users.sql           ← identity_type enum (guest/email), users table
002_create_rooms.sql           ← rooms, room_slots (slot_type, difficulty enums)
003_create_game_rounds.sql     ← game_rounds, kothi_counters
004_create_admin.sql           ← admin_users, admin_audit_log, user_suspensions; seeds admin
```

---

## API Endpoints

### Auth (`/api/v1/auth`)
| Method | Path | Auth |
|--------|------|------|
| POST | `/guest` | — |
| POST | `/register` | — |
| GET | `/verify-email?token=` | — |
| POST | `/login` | — |
| POST | `/refresh` | — |
| POST | `/forgot-password` | — |
| POST | `/reset-password` | — |
| POST | `/upgrade-guest` | JWT |

### Rooms (`/api/v1/rooms`)
| Method | Path | Auth |
|--------|------|------|
| GET | `/public` | JWT |
| POST | `/` | JWT |
| POST | `/:id/join` | JWT |
| POST | `/join-private` | JWT |
| POST | `/:id/add-computer` | JWT |
| DELETE | `/:id` | JWT |
| POST | `/:id/start` | JWT |

### Stats (`/api/v1/stats`)
| Method | Path | Auth |
|--------|------|------|
| GET | `/leaderboard?page=&limit=` | — |
| GET | `/my-stats` | JWT |
| GET | `/history?page=&limit=` | JWT |

### Admin (`/api/v1/admin`)
| Method | Path |
|--------|------|
| POST | `/auth/login` |
| POST | `/auth/change-password` |
| GET | `/dashboard` |
| GET/PUT | `/users`, `/users/:id/suspend`, `/users/:id/unsuspend`, `/users/:id` (delete guest) |
| GET/DELETE | `/rooms`, `/rooms/:id` |
| GET | `/history`, `/leaderboard`, `/shame-board` |
| GET | `/health` |

### WebSocket Events (game-engine)
**Client → Server:** `play_card`, `select_hidden_rung`, `call_color`, `pass_color_call`
**Server → Client:** `game_state`, `hand_update`, `card_played`, `trick_complete`, `rung_revealed`, `color_called`, `round_over`, `game_error`

---

## Task Status (All Complete)

| # | Task | Status |
|---|------|--------|
| 1 | Scaffold project folder structure | ✅ completed |
| 2 | Implement Auth Controllers | ✅ completed |
| 3 | Implement Room Controllers | ✅ completed |
| 4 | Implement GameStateMachine | ✅ completed |
| 5 | Auto-fill vacant slots with computers | ✅ completed |
| 6 | Build Admin Panel | ✅ completed |
| 7 | Build Frontend — Foundation & Auth | ✅ completed |
| 8 | Build Frontend — Lobby & Room Screens | ✅ completed |
| 9 | Build Frontend — Game Table | ✅ completed |
| 10 | Implement Player Stats API | ✅ completed |
| 11 | Write Unit Tests for Game Logic | ✅ completed |
| 12 | Docker Validation & Startup Script | ✅ completed |

---

## How to Launch

```bash
cd "C:\02- Claude Coding\01-Card Game\band-rang"

# First time only:
cp .env.example .env
# Edit .env — set JWT_SECRET, REFRESH_TOKEN_SECRET, ADMIN_JWT_SECRET, POSTGRES_PASSWORD

# Dev (hot-reload, Mailpit):
bash scripts/start.sh --dev

# Production:
bash scripts/start.sh

# Validate health:
bash scripts/validate.sh

# Run unit tests:
docker compose exec game-engine npm test
```

---

## Known Gaps / Future Work (Phase 2+)

- **Mobile app:** React Native — same backend, just point at API/WS URLs
- **Multi-instance scaling:** room-watcher uses in-memory timers; for multi-node, switch to Redis keyspace events (comment in room-watcher.service.ts)
- **Stats routes:** leaderboard is currently unauthenticated; add optional JWT for personalized rank highlight
- **In-game chat:** not implemented
- **Spectator mode:** not implemented
- **Tournament bracket:** not implemented
- **Push notifications:** not implemented
