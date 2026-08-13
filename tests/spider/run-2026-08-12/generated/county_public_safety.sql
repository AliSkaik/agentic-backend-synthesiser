CREATE TABLE counties (
    county_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    population INT NOT NULL,
    location VARCHAR(50)
);

CREATE TABLE police_forces (
    force_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE county_police_force (
    county_id INT REFERENCES counties(county_id),
    force_id INT REFERENCES police_forces(force_id),
    PRIMARY KEY (county_id, force_id)
);

-- How many counties are there?
SELECT COUNT(*) FROM counties;

-- Count the number of countries.
SELECT COUNT(*) FROM counties;

-- List the names of counties in descending order of population.
SELECT name FROM counties ORDER BY population DESC;

-- What are the names of the counties of public safety, ordered by population descending?
SELECT c.name
FROM counties c
JOIN county_police_force cpf ON c.county_id = cpf.county_id
WHERE NOT EXISTS (
    SELECT 1
    FROM police_forces pf
    WHERE pf.force_id = cpf.force_id AND pf.name LIKE '%east side%'
)
ORDER BY c.population DESC;

-- List the distinct police forces of counties whose location is not on east side.
SELECT DISTINCT p.name
FROM police_forces p
JOIN county_police_force cpf ON p.force_id = cpf.force_id
JOIN counties c ON cpf.county_id = c.county_id
WHERE c.location NOT LIKE '%east side%';