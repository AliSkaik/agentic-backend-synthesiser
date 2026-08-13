CREATE TABLE directors (
    director_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE movies (
    movie_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    release_year INT NOT NULL,
    director_id INT REFERENCES directors(director_id)
);

INSERT INTO directors (name) VALUES ('Steven Spielberg'), ('James Cameron');

INSERT INTO movies (title, release_year, director_id) VALUES
('Jaws', 1975, 1),
('The Terminator', 1984, 2),
('Avatar', 2009, 2);

-- Find the titles of all movies directed by Steven Spielberg.
SELECT title FROM movies WHERE director_id = (SELECT director_id FROM directors WHERE name = 'Steven Spielberg');

-- What are the names of all movies directed by Steven Spielberg?
SELECT name FROM directors WHERE director_id IN (SELECT director_id FROM movies);

-- What is the name of the movie produced after 2000 and directed by James Cameron?
SELECT title FROM movies WHERE release_year > 2000 AND director_id = (SELECT director_id FROM directors WHERE name = 'James Cameron');

-- What are the titles of all movies that James Cameron directed after 2000?
SELECT title FROM movies WHERE release_year > 2000 AND director_id = (SELECT director_id FROM directors WHERE name = 'James Cameron');

-- How many movies were made before 2000?
SELECT COUNT(*) FROM movies WHERE release_year < 2000;