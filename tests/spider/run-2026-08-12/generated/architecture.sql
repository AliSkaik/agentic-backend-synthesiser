CREATE TABLE architect (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nationality VARCHAR(50),
    gender CHAR(1) CHECK (gender IN ('M', 'F'))
);

CREATE TABLE bridge (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    length_meters NUMERIC(10, 2) NOT NULL
);

CREATE TABLE mill (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    year_of_construction INT,
    type VARCHAR(50)
);

CREATE TABLE architect_bridge (
    architect_id INT REFERENCES architect(id),
    bridge_id INT REFERENCES bridge(id),
    PRIMARY KEY (architect_id, bridge_id)
);

CREATE TABLE architect_mill (
    architect_id INT REFERENCES architect(id),
    mill_id INT REFERENCES mill(id),
    PRIMARY KEY (architect_id, mill_id)
);

-- Queries
SELECT COUNT(*) FROM architect WHERE gender = 'F';

SELECT name, nationality, id FROM architect WHERE gender = 'M' ORDER BY name;

SELECT MAX(length_meters) AS max_length_meters, ARRAY_AGG(architect.name) AS architect_names 
FROM bridge 
JOIN architect_bridge ON bridge.id = architect_bridge.bridge_id
JOIN architect ON architect_bridge.architect_id = architect.id;

SELECT AVG(length_meters * 3.28084) AS avg_length_feet FROM bridge;

SELECT name, year_of_construction FROM mill WHERE type = 'Grondzeiler';