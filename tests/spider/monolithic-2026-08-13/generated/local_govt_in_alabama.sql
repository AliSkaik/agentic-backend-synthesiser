CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    details JSONB
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL,
    details JSONB
);

CREATE TABLE event_participants (
    event_id INT REFERENCES events(id),
    participant_id INT REFERENCES participants(id),
    PRIMARY KEY (event_id, participant_id)
);