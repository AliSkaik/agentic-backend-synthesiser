CREATE TABLE member (
    member_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL
);

-- To answer: How many members are there?
SELECT COUNT(*) FROM member;

-- To list the names of members in ascending alphabetical order
SELECT name FROM member ORDER BY name ASC;

-- To show the names and countries of members
SELECT name, country FROM member;

-- To show the names of members whose country is "United States" or "Canada"
SELECT name FROM member WHERE country IN ('United States', 'Canada');

-- To show the different countries and the number of members from each
SELECT country, COUNT(*) AS member_count FROM member GROUP BY country;