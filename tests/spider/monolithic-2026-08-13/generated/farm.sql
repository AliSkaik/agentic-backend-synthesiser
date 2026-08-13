CREATE TABLE farms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    total_horses INT DEFAULT 0
);

CREATE TABLE horses (
    id SERIAL PRIMARY KEY,
    farm_id INT REFERENCES farms(id),
    name VARCHAR(255) NOT NULL,
    age INT
);

CREATE TABLE competitions (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL,
    theme VARCHAR(255)
);