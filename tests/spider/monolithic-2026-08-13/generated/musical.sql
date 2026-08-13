CREATE TABLE actors (
    actor_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    gender CHAR(1)
);

CREATE TABLE characters (
    character_id SERIAL PRIMARY KEY,
    actor_id INT REFERENCES actors(actor_id),
    character_name VARCHAR(100) NOT NULL,
    duration INTERVAL
);