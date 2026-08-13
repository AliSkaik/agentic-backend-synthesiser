CREATE TABLE body_builders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    body_builder_id INT REFERENCES body_builders(id),
    snatch_score INT NOT NULL,
    clean_jerk_score INT NOT NULL,
    total_score INT AS (snatch_score + clean_jerk_score) STORED,
    CONSTRAINT unique_body_builder_score UNIQUE (body_builder_id)
);

CREATE OR REPLACE FUNCTION calculate_average_snatch_score() RETURNS FLOAT AS $$
BEGIN
    RETURN AVG(snatch_score) FROM scores;
END;
$$ LANGUAGE plpgsql;