CREATE TABLE architects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nationality VARCHAR(50),
    gender CHAR(1)
);

CREATE TABLE bridges (
    id SERIAL PRIMARY KEY,
    architect_id INT REFERENCES architects(id),
    length_meters DECIMAL(10, 2) NOT NULL
);

CREATE TABLE mills (
    id SERIAL PRIMARY KEY,
    architect_id INT REFERENCES architects(id),
    name VARCHAR(100) NOT NULL,
    year_of_construction INT,
    type VARCHAR(50)
);