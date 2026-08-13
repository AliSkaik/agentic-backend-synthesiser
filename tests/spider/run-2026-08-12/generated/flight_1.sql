CREATE TABLE Aircraft (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    distance INT NOT NULL
);

-- To answer: How many aircrafts do we have?
SELECT COUNT(*) FROM Aircraft;

-- To answer: Show name and distance for all aircrafts.
SELECT name, distance FROM Aircraft;

-- To answer: What are the names and distances for all airplanes?
SELECT name, distance FROM Aircraft WHERE id > 1000;