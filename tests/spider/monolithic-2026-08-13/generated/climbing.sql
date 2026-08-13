CREATE TABLE climbers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50),
    points INTEGER DEFAULT 0
);