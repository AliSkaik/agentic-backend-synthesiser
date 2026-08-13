CREATE TABLE cities (
    city_id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    year INT NOT NULL
);

CREATE TABLE city_events (
    city_id INT REFERENCES cities(city_id),
    event_id INT REFERENCES events(event_id),
    PRIMARY KEY (city_id, event_id)
);

CREATE TABLE competitions (
    competition_id SERIAL PRIMARY KEY,
    competition_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE match_competitions (
    match_id SERIAL PRIMARY KEY,
    competition_id INT REFERENCES competitions(competition_id),
    city_id INT REFERENCES cities(city_id),
    year INT NOT NULL
);