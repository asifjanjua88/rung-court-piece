CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE identity_type AS ENUM ('guest', 'email');

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_type     identity_type NOT NULL,
  display_name      VARCHAR(50) NOT NULL,
  email             VARCHAR(255) UNIQUE,
  password_hash     TEXT,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  guest_expires_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
