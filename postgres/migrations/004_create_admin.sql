-- Admin users table
CREATE TABLE admin_users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username            VARCHAR(50) UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin audit log — every admin action is recorded
CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES admin_users(id),
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),           -- 'user' | 'room' | 'system'
  target_id   TEXT,                  -- id of affected entity
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User suspension table
CREATE TABLE user_suspensions (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT,
  suspended_by UUID NOT NULL REFERENCES admin_users(id),
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at   TIMESTAMPTZ
);

CREATE INDEX idx_admin_audit_admin   ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at DESC);

-- Default admin account
-- Username: admin
-- Password: Admin@1234  (bcrypt hash — MUST be changed on first login)
INSERT INTO admin_users (username, password_hash, must_change_password)
VALUES (
  'admin',
  '$2b$12$LQv3c1yqBwEHXp.O8GJpkuRGVt3q6Y1e0pS4HxWzN8UMkJvRmQZ2e',
  TRUE
);
