-- Create the events table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create the counters table
CREATE TABLE IF NOT EXISTS counters (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE, -- Delete counters when event is deleted
    name VARCHAR(255) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Add indexes for performance on foreign keys
CREATE INDEX IF NOT EXISTS idx_counters_event_id ON counters(event_id);

-- You might want to add some initial test data (optional)
-- INSERT INTO events (name) VALUES ('Sample Event');
-- INSERT INTO counters (event_id, name, count) VALUES (1, 'Main Gate', 5);
-- INSERT INTO counters (event_id, name, count) VALUES (1, 'Side Door', 2);