CREATE TABLE stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    city VARCHAR(255) NOT NULL
);

CREATE TABLE weather_data (
    id SERIAL PRIMARY KEY,
    station_id INT REFERENCES stations(id),
    date DATE NOT NULL,
    max_temperature DECIMAL(5, 2) NOT NULL
);