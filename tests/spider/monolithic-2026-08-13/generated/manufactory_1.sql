CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    founder VARCHAR(255),
    headquarters VARCHAR(255),
    revenue NUMERIC(15, 2)
);