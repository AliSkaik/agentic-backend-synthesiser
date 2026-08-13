CREATE TYPE ship_status AS ENUM ('Sunk', 'Captured', 'Damaged');

CREATE TABLE ships (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    tonnage INT NOT NULL
);

CREATE TABLE battles (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    result VARCHAR(255)
);

CREATE TABLE battle_ships (
    battle_id INT REFERENCES battles(id),
    ship_id INT REFERENCES ships(id),
    status ship_status NOT NULL,
    death_toll INT,
    injuries INT,
    PRIMARY KEY (battle_id, ship_id)
);

-- How many ships ended up being 'Captured'?
SELECT COUNT(*) FROM battle_ships WHERE status = 'Captured';

-- List the name and tonnage ordered by in descending alphabetical order for the names.
SELECT s.name, s.tonnage FROM ships s ORDER BY s.name DESC;

-- List the name, date and result of each battle.
SELECT b.date, b.result FROM battles b;

-- What is maximum and minimum death toll caused each time?
SELECT MAX(bs.death_toll), MIN(bs.death_toll) FROM battle_ships bs;

-- What is the average number of injuries caused each time?
SELECT AVG(bs.injuries) FROM battle_ships bs;