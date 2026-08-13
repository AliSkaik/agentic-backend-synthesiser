CREATE TYPE enzyme_type AS ENUM ('Proteinase', 'Lipase', 'Nuclease');

CREATE TABLE enzymes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type enzyme_type NOT NULL,
    location VARCHAR(255)
);

CREATE OR REPLACE FUNCTION count_enzymes() RETURNS INTEGER AS $$
BEGIN
    RETURN COUNT(*) FROM enzymes;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION list_enzyme_names_desc() RETURNS SETOF VARCHAR(255) AS $$
BEGIN
    RETURN QUERY SELECT name FROM enzymes ORDER BY name DESC;
END;
$$ LANGUAGE plpgsql;