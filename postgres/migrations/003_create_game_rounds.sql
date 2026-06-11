CREATE TABLE game_rounds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID NOT NULL REFERENCES rooms(id),
  round_number    SMALLINT NOT NULL,
  winning_team    CHAR(1) NOT NULL CHECK (winning_team IN ('A', 'B')),
  scenario        CHAR(1) NOT NULL CHECK (scenario IN ('A', 'B')),
  trump_suit      VARCHAR(10) NOT NULL,
  kothi_counter   SMALLINT NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kothi_counters (
  room_id       UUID PRIMARY KEY REFERENCES rooms(id),
  counter       SMALLINT NOT NULL DEFAULT 0,
  team_a_kothi  SMALLINT NOT NULL DEFAULT 0,
  team_b_kothi  SMALLINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_rounds_room ON game_rounds(room_id);
