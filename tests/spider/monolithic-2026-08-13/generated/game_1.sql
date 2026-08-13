CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type_id INT REFERENCES game_types(id),
    user_id INT -- Assuming you have a users table with an ID column
);

CREATE TABLE game_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);