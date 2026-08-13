CREATE TABLE songs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    release_year INT,
    duration_seconds INT,
    language VARCHAR(50)
);