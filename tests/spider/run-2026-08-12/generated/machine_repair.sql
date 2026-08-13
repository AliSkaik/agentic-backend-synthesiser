CREATE TABLE technicians (
    technician_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    team VARCHAR(50),
    start_year INT
);

-- To answer: How many technicians are there?
SELECT COUNT(*) FROM technicians;

-- To list the names of technicians in ascending order of age
SELECT name FROM technicians ORDER BY age ASC;