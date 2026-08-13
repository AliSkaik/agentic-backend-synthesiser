CREATE TABLE dorms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL,
    gender CHAR(1) CHECK (gender IN ('M', 'F'))
);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sex CHAR(1) CHECK (sex IN ('M', 'F')),
    age INT,
    dorm_id INT REFERENCES dorms(id)
);