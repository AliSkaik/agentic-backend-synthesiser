CREATE TABLE cities (
    city_id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    age INT NOT NULL CHECK (age >= 18),
    city_id INT REFERENCES cities(city_id)
);

-- Indexes for performance
CREATE INDEX idx_employee_age ON employees(age);
CREATE INDEX idx_employee_city ON employees(city_id);