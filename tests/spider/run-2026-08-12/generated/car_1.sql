CREATE TABLE Continents (
    ContinentID SERIAL PRIMARY KEY,
    ContinentName VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Countries (
    CountryID SERIAL PRIMARY KEY,
    CountryName VARCHAR(100) NOT NULL UNIQUE,
    ContinentID INT REFERENCES Continents(ContinentID)
);

-- How many continents are there?
SELECT COUNT(*) FROM Continents;

-- What is the number of continents?
SELECT COUNT(*) FROM Continents;

-- How many countries does each continent have? List the continent id, continent name and the number of countries.
SELECT C.ContinentID, C.ContinentName, COUNT(CO.CountryID) AS CountryCount
FROM Continents C
LEFT JOIN Countries CO ON C.ContinentID = CO.ContinentID
GROUP BY C.ContinentID, C.ContinentName;

-- For each continent, list its id, name, and how many countries it has?
SELECT C.ContinentID, C.ContinentName, COUNT(CO.CountryID) AS CountryCount
FROM Continents C
LEFT JOIN Countries CO ON C.ContinentID = CO.ContinentID
GROUP BY C.ContinentID, C.ContinentName;

-- How many countries are listed?
SELECT COUNT(*) FROM Countries;