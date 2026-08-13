CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255),
    year INT
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    city_id INT REFERENCES cities(id),
    event_name VARCHAR(255),
    date DATE
);