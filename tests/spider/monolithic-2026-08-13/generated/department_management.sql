CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    creation_year INT NOT NULL,
    budget DECIMAL(10, 2) NOT NULL
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    department_id INT REFERENCES departments(id),
    name VARCHAR(255) NOT NULL,
    born_state VARCHAR(255),
    age INT,
    rank INT
);