CREATE TYPE room_type   AS ENUM ('public', 'private');
CREATE TYPE room_status AS ENUM ('waiting', 'ready', 'in_progress', 'completed');
CREATE TYPE slot_type   AS ENUM ('human', 'computer');
CREATE TYPE difficulty  AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE rooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         room_type NOT NULL,
  status       room_status NOT NULL DEFAULT 'waiting',
  access_code  CHAR(6),
  creator_id   UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_slots (
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  position    SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 3),
  slot_type   slot_type NOT NULL,
  player_id   UUID REFERENCES users(id),
  difficulty  difficulty,
  PRIMARY KEY (room_id, position)
);

CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_access_code ON rooms(access_code) WHERE access_code IS NOT NULL;
