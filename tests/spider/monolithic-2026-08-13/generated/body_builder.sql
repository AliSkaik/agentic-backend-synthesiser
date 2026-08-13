CREATE TABLE body_builders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    snatch_score INT NOT NULL,
    clean_jerk_score INT NOT NULL,
    total_score INT NOT NULL
);