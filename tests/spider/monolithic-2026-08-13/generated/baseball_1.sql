CREATE TABLE colleges (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL
);

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    college_id INT REFERENCES colleges(id)
);

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    salary NUMERIC(10, 2),
    team_id INT REFERENCES teams(id)
);

CREATE TABLE all_star_games (
    id SERIAL PRIMARY KEY,
    year INT NOT NULL,
    player_id INT REFERENCES players(id)
);