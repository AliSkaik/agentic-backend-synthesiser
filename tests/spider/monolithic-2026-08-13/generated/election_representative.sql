CREATE TABLE elections (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    vote_percent NUMERIC(5, 2) NOT NULL
);

CREATE TABLE representatives (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    party VARCHAR(100) NOT NULL
);