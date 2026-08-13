CREATE TABLE departments (
    dept_no SERIAL PRIMARY KEY,
    dept_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE employees (
    emp_no SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    salary NUMERIC(10, 2) NOT NULL,
    dept_no INT REFERENCES departments(dept_no)
);