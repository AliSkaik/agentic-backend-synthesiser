CREATE TABLE ships (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tonnage INT NOT NULL
);

CREATE TABLE battles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    result VARCHAR(255)
);

CREATE TABLE battle_deaths (
    id SERIAL PRIMARY KEY,
    ship_id INT REFERENCES ships(id),
    battle_id INT REFERENCES battles(id),
    death_count INT NOT NULL,
    injury_count INT
);