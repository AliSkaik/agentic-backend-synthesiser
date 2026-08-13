CREATE TABLE Singer (
    SingerID SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Country VARCHAR(50) NOT NULL,
    Age INT CHECK (Age >= 0)
);

-- To answer: How many singers do we have?
SELECT COUNT(*) FROM Singer;

-- To answer: What is the total number of singers?
SELECT SUM(CASE WHEN Country = 'France' THEN 1 ELSE 0 END) AS TotalFrenchSingers FROM Singer;

-- To answer: Show name, country, age for all singers ordered by age from the oldest to the youngest.
SELECT Name, Country, Age FROM Singer ORDER BY Age DESC;

-- To answer: What are the names, countries, and ages for every singer in descending order of age?
SELECT Name, Country, Age FROM Singer ORDER BY Age DESC;

-- To answer: What is the average, minimum, and maximum age of all singers from France?
SELECT AVG(Age) AS AverageAge, MIN(Age) AS MinAge, MAX(Age) AS MaxAge FROM Singer WHERE Country = 'France';