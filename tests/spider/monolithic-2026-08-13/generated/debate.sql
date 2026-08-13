CREATE TABLE people (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL
);

CREATE TABLE debates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    venue VARCHAR(100) NOT NULL,
    audience_count INT NOT NULL
);