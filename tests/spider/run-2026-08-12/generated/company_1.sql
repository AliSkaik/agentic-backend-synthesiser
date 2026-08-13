CREATE TYPE gender AS ENUM ('Male', 'Female');

CREATE TABLE department (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(100),
    start_date DATE NOT NULL
);

CREATE TABLE employee (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    department_id INT REFERENCES department(id),
    salary NUMERIC(10, 2) NOT NULL,
    gender gender
);

CREATE TABLE dependent (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employee(id),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    gender gender
);

CREATE TABLE spouse_relation (
    id SERIAL PRIMARY KEY,
    dependent_id INT REFERENCES dependent(id),
    employee_id INT REFERENCES employee(id)
);