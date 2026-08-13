CREATE TABLE editor (
    editor_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    age INT NOT NULL CHECK (age >= 18)
);

-- How many editors are there?
SELECT COUNT(*) FROM editor;

-- List the names of editors in ascending order of age.
SELECT name FROM editor ORDER BY age ASC;

-- What are the names and ages of editors?
SELECT name, age FROM editor;

-- List the names of editors who are older than 25.
SELECT name FROM editor WHERE age > 25;

-- Show the names of editors of age either 24 or 25.
SELECT name FROM editor WHERE age IN (24, 25);