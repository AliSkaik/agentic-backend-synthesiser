CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    abbreviation CHAR(2) UNIQUE NOT NULL
);

CREATE TABLE airlines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    abbreviation CHAR(3) UNIQUE NOT NULL,
    country_id INT REFERENCES countries(id)
);