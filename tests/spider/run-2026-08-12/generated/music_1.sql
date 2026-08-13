CREATE TYPE language AS ENUM ('English', 'Spanish', 'French');

CREATE TABLE artists (
    artist_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE albums (
    album_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_year INT NOT NULL,
    artist_id INT REFERENCES artists(artist_id)
);

CREATE TABLE songs (
    song_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    duration INT NOT NULL,
    language language NOT NULL,
    album_id INT REFERENCES albums(album_id)
);

CREATE OR REPLACE FUNCTION get_most_recent_song() RETURNS VARCHAR AS $$
SELECT title FROM songs ORDER BY release_year DESC, id DESC LIMIT 1;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION get_longest_song_id() RETURNS INT AS $$
SELECT song_id FROM songs ORDER BY duration DESC LIMIT 1;
$$ LANGUAGE SQL;