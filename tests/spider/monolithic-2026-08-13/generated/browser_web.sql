CREATE TABLE browsers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    market_share DECIMAL(5, 2) NOT NULL CHECK (market_share >= 0)
);