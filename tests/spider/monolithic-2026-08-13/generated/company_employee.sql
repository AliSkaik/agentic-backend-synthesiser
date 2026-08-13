CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    headquarters VARCHAR(255),
    industry VARCHAR(100),
    sales NUMERIC,
    market_value NUMERIC
);