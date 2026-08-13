CREATE TABLE Locations (
    location_id SERIAL PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Cinemas (
    cinema_id SERIAL PRIMARY KEY,
    location_id INT REFERENCES Locations(location_id),
    cinema_name VARCHAR(100) NOT NULL,
    opening_year INT NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0)
);

-- Show all the locations where no cinema has capacity over 800
SELECT location_name FROM Locations WHERE location_id NOT IN (
    SELECT location_id FROM Cinemas WHERE capacity > 800
);

-- Show all the locations where some cinemas were opened in both year 2010 and year 2011
SELECT location_name FROM Locations WHERE location_id IN (
    SELECT location_id FROM Cinemas WHERE opening_year = 2010 INTERSECT
    SELECT location_id FROM Cinemas WHERE opening_year = 2011
);

-- How many cinemas do we have?
SELECT COUNT(*) AS total_cinemas FROM Cinemas;

-- Count the number of cinemas
SELECT COUNT(*) AS total_cinemas FROM Cinemas;

-- Show name, opening year, and capacity for each cinema
SELECT cinema_name, opening_year, capacity FROM Cinemas;