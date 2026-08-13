CREATE TABLE counties (
    county_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE campuses (
    campus_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    county_id INT REFERENCES counties(county_id)
);

CREATE TABLE opening_years (
    campus_id INT REFERENCES campuses(campus_id),
    year INT NOT NULL,
    PRIMARY KEY (campus_id, year)
);

INSERT INTO counties (name) VALUES ('Los Angeles'), ('Chico');

INSERT INTO campuses (name, county_id) VALUES
('Campus A', 1),
('Campus B', 1),
('Campus C', 2),
('Campus D', 2);

INSERT INTO opening_years (campus_id, year) VALUES
(1, 1958),
(2, 1960),
(3, 1958),
(4, 1970);