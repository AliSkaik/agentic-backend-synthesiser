CREATE TABLE dorm (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    capacity INT NOT NULL CHECK (capacity > 0)
);

CREATE TABLE student (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sex CHAR(1) CHECK (sex IN ('M', 'F')),
    age INT CHECK (age >= 0),
    dorm_id INT REFERENCES dorm(id)
);

-- View to find the names of all-female dorms
CREATE VIEW all_female_dorms AS
SELECT d.name
FROM dorm d
JOIN student s ON d.id = s.dorm_id
WHERE s.sex = 'F'
GROUP BY d.id, d.name
HAVING COUNT(DISTINCT s.sex) = 1;

-- View to find the names of dorms that can accommodate more than 300 students
CREATE VIEW large_dorms AS
SELECT name
FROM dorm
WHERE capacity > 300;

-- Query to count female students below 25 years old
SELECT COUNT(*)
FROM student
WHERE sex = 'F' AND age < 25;