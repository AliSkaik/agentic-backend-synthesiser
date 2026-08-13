CREATE TYPE GameType AS ENUM ('Action', 'Adventure', 'Role-Playing', 'Strategy');

CREATE TABLE VideoGames (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    type GameType NOT NULL
);

CREATE TABLE UserVideoGames (
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(id),
    FOREIGN KEY (game_id) REFERENCES VideoGames(id),
    PRIMARY KEY (user_id, game_id)
);

CREATE TABLE Users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE
);