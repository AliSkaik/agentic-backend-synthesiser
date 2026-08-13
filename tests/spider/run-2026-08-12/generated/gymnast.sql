CREATE TABLE gymnast (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    age INT CHECK (age >= 18),
    gender CHAR(1) CHECK (gender IN ('M', 'F'))
);

CREATE TABLE score (
    id SERIAL PRIMARY KEY,
    gymnast_id INT REFERENCES gymnast(id) ON DELETE CASCADE,
    floor DECIMAL(5,2) NOT NULL,
    vault DECIMAL(5,2) NOT NULL,
    bars DECIMAL(5,2) NOT NULL,
    beam DECIMAL(5,2) NOT NULL,
    total DECIMAL(5,2) AS (floor + vault + bars + beam) STORED
);

CREATE OR REPLACE FUNCTION calculate_total_points() RETURNS VOID AS $$
BEGIN
    UPDATE score SET total = floor + vault + bars + beam;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_total_points
AFTER INSERT OR UPDATE ON score FOR EACH ROW
EXECUTE FUNCTION calculate_total_points();

-- Example queries:
-- How many gymnasts are there?
SELECT COUNT(*) FROM gymnast;

-- List the total points of gymnasts in descending order.
SELECT s.total, g.name FROM score s JOIN gymnast g ON s.gymnast_id = g.id ORDER BY s.total DESC;

-- What are the total points for all gymnasts, ordered by total points descending?
SELECT SUM(total) AS total_points FROM score ORDER BY total DESC;

-- List the total points of gymnasts in descending order of floor exercise points.
SELECT s.floor, s.total, g.name FROM score s JOIN gymnast g ON s.gymnast_id = g.id ORDER BY s.floor DESC;