CREATE TABLE actors (
    actor_id SERIAL PRIMARY KEY,
    actor_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE characters (
    character_id SERIAL PRIMARY KEY,
    character_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE actor_character (
    actor_id INT REFERENCES actors(actor_id),
    character_id INT REFERENCES characters(character_id),
    duration INTERVAL NOT NULL,
    PRIMARY KEY (actor_id, character_id)
);