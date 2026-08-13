CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE furniture_components (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    market_rate NUMERIC(10, 2) NOT NULL,
    manufacturer_id INT REFERENCES manufacturers(id)
);