CREATE TABLE Farms (
    farm_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Horses (
    horse_id SERIAL PRIMARY KEY,
    farm_id INT REFERENCES Farms(farm_id),
    name VARCHAR(255) NOT NULL,
    age INT
);

CREATE TABLE Competitions (
    competition_id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL,
    theme VARCHAR(255)
);

CREATE TABLE Competition_Horses (
    competition_id INT REFERENCES Competitions(competition_id),
    horse_id INT REFERENCES Horses(horse_id),
    PRIMARY KEY (competition_id, horse_id)
);