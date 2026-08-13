CREATE TABLE Visitors (
    visitor_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    membership_level INT NOT NULL
);

CREATE TABLE Museums (
    museum_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE Staff (
    staff_id SERIAL PRIMARY KEY,
    visitor_id INT REFERENCES Visitors(visitor_id),
    museum_id INT REFERENCES Museums(museum_id)
);

-- How many visitors below age 30 are there?
SELECT COUNT(*) FROM Visitors WHERE age < 30;

-- Find the names of the visitors whose membership level is higher than 4, and order the results by the level from high to low.
SELECT name FROM Visitors WHERE membership_level > 4 ORDER BY membership_level DESC;

-- What is the average age of the visitors whose membership level is not higher than 4?
SELECT AVG(age) FROM Visitors WHERE membership_level <= 4;

-- Find the name and membership level of the visitors whose membership level is higher than 4, and sort by their age from old to young.
SELECT name, membership_level FROM Visitors WHERE membership_level > 4 ORDER BY age DESC;

-- Find the id and name of the museum that has the most staff members?
SELECT m.museum_id, m.name
FROM Museums m
JOIN Staff s ON m.museum_id = s.museum_id
GROUP BY m.museum_id, m.name
ORDER BY COUNT(s.staff_id) DESC
LIMIT 1;