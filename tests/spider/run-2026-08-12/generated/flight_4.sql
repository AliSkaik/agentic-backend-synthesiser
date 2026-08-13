CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE airports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city_id INT REFERENCES cities(id),
    country_id INT REFERENCES countries(id),
    elevation_meters NUMERIC(5, 2)
);

CREATE TABLE airlines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE airport_airline (
    airport_id INT REFERENCES airports(id),
    airline_id INT REFERENCES airlines(id),
    PRIMARY KEY (airport_id, airline_id)
);