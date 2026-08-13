CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE cinemas (
    id SERIAL PRIMARY KEY,
    location_id INT REFERENCES locations(id),
    name VARCHAR(255) NOT NULL,
    opening_year INT NOT NULL,
    capacity INT NOT NULL
);