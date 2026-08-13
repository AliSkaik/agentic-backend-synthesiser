CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    position VARCHAR(50),
    head BOOLEAN DEFAULT FALSE,
    department_id INT,
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);