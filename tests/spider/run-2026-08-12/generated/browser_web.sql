CREATE TABLE browsers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    market_share DECIMAL(5, 2) NOT NULL CHECK (market_share >= 0)
);

-- Example data insertion
INSERT INTO browsers (name, market_share) VALUES ('Chrome', 38.91);
INSERT INTO browsers (name, market_share) VALUES ('Firefox', 24.67);
INSERT INTO browsers (name, market_share) VALUES ('Safari', 15.07);
INSERT INTO browsers (name, market_share) VALUES ('Edge', 11.34);
INSERT INTO browsers (name, market_share) VALUES ('Opera', 8.95);

-- Queries
SELECT COUNT(*) FROM browsers WHERE market_share >= 5;
SELECT name FROM browsers ORDER BY market_share DESC;
SELECT id, name, market_share FROM browsers;
SELECT MAX(market_share), MIN(market_share), AVG(market_share) FROM browsers;
SELECT id, market_share FROM browsers WHERE name = 'Safari';