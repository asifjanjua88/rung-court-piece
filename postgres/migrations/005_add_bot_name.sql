-- Add bot_name to room_slots for computer player display names
ALTER TABLE room_slots ADD COLUMN IF NOT EXISTS bot_name VARCHAR(30);
