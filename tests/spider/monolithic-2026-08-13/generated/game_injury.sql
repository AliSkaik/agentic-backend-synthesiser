CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    season INT NOT NULL,
    date DATE NOT NULL,
    home_team VARCHAR(255) NOT NULL,
    away_team VARCHAR(255) NOT NULL,
    stadium_name VARCHAR(255) NOT NULL,
    attendance INT NOT NULL,
    capacity INT NOT NULL
);

CREATE TABLE stadiums (
    name VARCHAR(255) PRIMARY KEY,
    capacity INT NOT NULL,
    capacity_percentage DECIMAL(5, 2) NOT NULL
);