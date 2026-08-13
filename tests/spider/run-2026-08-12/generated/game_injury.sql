CREATE TABLE seasons (
    season_id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    stadium_id INT,
    FOREIGN KEY (stadium_id) REFERENCES stadiums(stadium_id)
);

CREATE TABLE stadiums (
    stadium_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    capacity INT NOT NULL,
    capacity_percentage DECIMAL(5, 2) NOT NULL
);

CREATE TABLE games (
    game_id SERIAL PRIMARY KEY,
    season_id INT,
    home_team_id INT,
    away_team_id INT,
    date DATE NOT NULL,
    attendance INT NOT NULL,
    FOREIGN KEY (season_id) REFERENCES seasons(season_id),
    FOREIGN KEY (home_team_id) REFERENCES teams(team_id),
    FOREIGN KEY (away_team_id) REFERENCES teams(team_id)
);

CREATE VIEW home_games AS
SELECT g.game_id, s.season_id, t.name AS home_team, g.date, g.attendance
FROM games g
JOIN teams t ON g.home_team_id = t.team_id;

CREATE VIEW away_games AS
SELECT g.game_id, s.season_id, t.name AS away_team, g.date, g.attendance
FROM games g
JOIN teams t ON g.away_team_id = t.team_id;

-- How many games are held after season 2007?
SELECT COUNT(*) FROM games WHERE date > (SELECT end_date FROM seasons WHERE start_date <= '2007-12-31');

-- List the dates of games by the home team name in descending order.
SELECT h.home_team, g.date
FROM home_games h
ORDER BY h.home_team DESC;

-- List the season, home team, away team of all the games.
SELECT s.season_id, h.home_team, a.away_team
FROM home_games h
JOIN away_games a ON h.game_id = a.game_id;

-- What are the maximum, minimum and average home games each stadium held?
SELECT s.name, COUNT(*) AS game_count
FROM stadiums s
JOIN teams t ON s.stadium_id = t.stadium_id
JOIN home_games hg ON t.team_id = hg.home_team_id
GROUP BY s.name;

-- What is the average attendance of stadiums with capacity percentage higher than 100%?
SELECT AVG(g.attendance) AS avg_attendance
FROM games g
JOIN teams t ON g.home_team_id = t.team_id
JOIN stadiums s ON t.stadium_id = s.stadium_id
WHERE s.capacity_percentage > 100;