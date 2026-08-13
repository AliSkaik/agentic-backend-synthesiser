CREATE TABLE concert_singers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL,
    age INT NOT NULL CHECK (age >= 0)
);