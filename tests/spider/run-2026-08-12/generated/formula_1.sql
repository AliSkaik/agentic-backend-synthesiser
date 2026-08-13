CREATE TABLE races (
    race_id SERIAL PRIMARY KEY,
    race_name VARCHAR(255) NOT NULL,
    race_date DATE NOT NULL
);

CREATE OR REPLACE FUNCTION get_most_recent_race() RETURNS races AS $$
BEGIN
    RETURN QUERY SELECT * FROM races ORDER BY race_date DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_races_in_year(year INT) RETURNS TABLE(race_name VARCHAR(255), race_date DATE) AS $$
BEGIN
    RETURN QUERY SELECT race_name, race_date FROM races WHERE EXTRACT(YEAR FROM race_date) = year;
END;
$$ LANGUAGE plpgsql;