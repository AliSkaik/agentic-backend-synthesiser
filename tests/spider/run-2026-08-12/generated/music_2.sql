CREATE TYPE genre AS ENUM ('Rock', 'Pop', 'Jazz', 'Hip hop');

CREATE TABLE band (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE label (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE album (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_year INT NOT NULL CHECK (release_year >= 1900),
    band_id INT REFERENCES band(id) ON DELETE CASCADE,
    label_id INT REFERENCES label(id) ON DELETE SET NULL,
    genre genre
);

CREATE TABLE track (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    album_id INT REFERENCES album(id) ON DELETE CASCADE,
    duration INTERVAL NOT NULL CHECK (duration > '0 seconds')
);