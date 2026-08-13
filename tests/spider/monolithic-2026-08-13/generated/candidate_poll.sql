CREATE TABLE polls (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidates (
    id SERIAL PRIMARY KEY,
    poll_id INT REFERENCES polls(id),
    name VARCHAR(255) NOT NULL,
    support_rate NUMERIC(5, 2) CHECK (support_rate BETWEEN 0 AND 100)
);