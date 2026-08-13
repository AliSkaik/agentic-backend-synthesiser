CREATE TABLE visitors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    membership_level INT NOT NULL
);

CREATE TABLE museums (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    staff_count INT NOT NULL
);