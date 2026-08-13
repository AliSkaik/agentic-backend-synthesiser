CREATE TYPE country_code AS ENUM ('US', 'CA', 'MX');

CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code COUNTRY_CODE NOT NULL
);

CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    country_id INT NOT NULL REFERENCES countries(id)
);

CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    street VARCHAR(255) NOT NULL,
    city_id INT NOT NULL REFERENCES cities(id),
    zip_code VARCHAR(10) NOT NULL
);