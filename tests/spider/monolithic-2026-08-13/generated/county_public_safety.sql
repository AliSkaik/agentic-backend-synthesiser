CREATE TABLE counties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    population INT NOT NULL,
    location VARCHAR(255)
);

CREATE TABLE police_forces (
    id SERIAL PRIMARY KEY,
    county_id INT REFERENCES counties(id),
    force_name VARCHAR(255) NOT NULL
);