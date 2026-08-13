CREATE TABLE gymnasts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    floor_exercise_points NUMERIC(5, 2),
    vault_points NUMERIC(5, 2),
    bars_points NUMERIC(5, 2),
    beam_points NUMERIC(5, 2)
);