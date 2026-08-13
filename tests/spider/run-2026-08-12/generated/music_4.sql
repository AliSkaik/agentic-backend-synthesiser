CREATE TABLE artist (
    artist_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    birth_date DATE NOT NULL
);

CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INT AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(NOW(), birth_date));
END;
$$ LANGUAGE plpgsql;

-- How many artists are there?
SELECT COUNT(*) FROM artist;

-- List the age of all music artists.
SELECT calculate_age(birth_date) AS age FROM artist;

-- What is the average age of all artists?
SELECT AVG(calculate_age(birth_date)) AS average_age FROM artist;