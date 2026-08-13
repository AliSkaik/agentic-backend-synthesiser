CREATE TYPE Country AS (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Airlines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation CHAR(3) NOT NULL UNIQUE,
    country_id INT REFERENCES Country(id)
);

CREATE TABLE Affiliations (
    airline_id INT REFERENCES Airlines(id),
    affiliated_airline_id INT REFERENCES Airlines(id),
    PRIMARY KEY (airline_id, affiliated_airline_id)
);

-- Queries
SELECT c.name AS country_name FROM Country c JOIN Airlines a ON c.id = a.country_id WHERE a.name = 'JetBlue Airways';
SELECT a2.name AS affiliated_airline_name FROM Affiliations af JOIN Airlines a1 ON af.airline_id = a1.id JOIN Airlines a2 ON af.affiliated_airline_id = a2.id WHERE a1.name = 'JetBlue Airways';
SELECT abbreviation FROM Airlines WHERE name = 'JetBlue Airways';
SELECT name, abbreviation FROM Airlines WHERE country_id IN (SELECT id FROM Country WHERE name = 'USA');