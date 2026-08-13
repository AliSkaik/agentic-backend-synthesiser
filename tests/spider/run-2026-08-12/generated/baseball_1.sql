CREATE TYPE gender AS ENUM ('Male', 'Female');

CREATE TABLE college (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE player (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    gender gender NOT NULL,
    birth_date DATE NOT NULL,
    college_id INT REFERENCES college(id)
);

CREATE TABLE team (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE player_team (
    player_id INT REFERENCES player(id),
    team_id INT REFERENCES team(id),
    start_date DATE NOT NULL,
    end_date DATE,
    PRIMARY KEY (player_id, team_id)
);

CREATE TABLE salary (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES player(id),
    amount NUMERIC(10, 2) NOT NULL,
    year INT NOT NULL
);

CREATE TABLE all_star_game (
    id SERIAL PRIMARY KEY,
    game_date DATE NOT NULL,
    player_id INT REFERENCES player(id)
);

-- View to find the college with the largest number of baseball players
CREATE VIEW college_player_count AS
SELECT c.id, c.name, COUNT(p.id) AS player_count
FROM college c
JOIN player p ON c.id = p.college_id
GROUP BY c.id, c.name;

-- View to compute the average salary of players in a specific team
CREATE OR REPLACE FUNCTION avg_salary_by_team(team_name VARCHAR)
RETURNS NUMERIC(10, 2) AS $$
DECLARE
    avg_sal NUMERIC(10, 2);
BEGIN
    SELECT AVG(s.amount)
    INTO avg_sal
    FROM player p
    JOIN salary s ON p.id = s.player_id
    JOIN player_team pt ON p.id = pt.player_id
    JOIN team t ON pt.team_id = t.id
    WHERE t.name = team_name;
    RETURN avg_sal;
END;
$$ LANGUAGE plpgsql;

-- View to find the first and last names of players participating in all-star game in 1998
CREATE VIEW all_star_game_1998 AS
SELECT p.first_name, p.last_name
FROM player p
JOIN all_star_game ag ON p.id = ag.player_id
WHERE EXTRACT(YEAR FROM ag.game_date) = 1998;