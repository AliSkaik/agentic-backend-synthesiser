CREATE TYPE artwork_type AS ENUM ('Painting', 'Sculpture', 'Photography', 'Program Talent Show');

CREATE TABLE artworks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type artwork_type NOT NULL
);

CREATE TABLE festivals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255) NOT NULL
);

CREATE TABLE festival_chairs (
    id SERIAL PRIMARY KEY,
    festival_id INT REFERENCES festivals(id),
    chair_name VARCHAR(255) NOT NULL,
    year_held INT NOT NULL,
    FOREIGN KEY (festival_id) REFERENCES festivals(id)
);

-- How many artworks are there?
SELECT COUNT(*) FROM artworks;

-- List the name of artworks in ascending alphabetical order.
SELECT name FROM artworks ORDER BY name ASC;

-- List the name of artworks whose type is not "Program Talent Show".
SELECT name FROM artworks WHERE type != 'Program Talent Show';

-- What are the names and locations of festivals?
SELECT name, location FROM festivals;

-- What are the names of the chairs of festivals, sorted in ascending order of the year held?
SELECT chair_name FROM festival_chairs ORDER BY year_held ASC;