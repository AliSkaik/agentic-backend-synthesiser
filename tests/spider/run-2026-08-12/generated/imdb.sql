CREATE TYPE genre AS ENUM ('Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Musical', 'Mystery', 'News', 'Reality TV', 'Sci-Fi', 'Short', 'Sport', 'Talk-Show', 'Thriller', 'War', 'Western');

CREATE TABLE directors (
    director_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE actors (
    actor_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE movies (
    movie_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_date DATE NOT NULL,
    rating DECIMAL(3, 1),
    director_id INT REFERENCES directors(director_id)
);

CREATE TABLE genres (
    genre_id SERIAL PRIMARY KEY,
    name genre
);

CREATE TABLE movie_genres (
    movie_id INT REFERENCES movies(movie_id),
    genre_id INT REFERENCES genres(genre_id),
    PRIMARY KEY (movie_id, genre_id)
);

CREATE TABLE movie_actors (
    movie_id INT REFERENCES movies(movie_id),
    actor_id INT REFERENCES actors(actor_id),
    role VARCHAR(100),
    PRIMARY KEY (movie_id, actor_id)
);