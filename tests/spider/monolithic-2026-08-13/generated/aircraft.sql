CREATE TABLE aircraft (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    international_passengers INT NOT NULL DEFAULT 0
);