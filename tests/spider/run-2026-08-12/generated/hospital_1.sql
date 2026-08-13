CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    position VARCHAR(50),
    head_of_department BOOLEAN DEFAULT FALSE,
    department_id INT REFERENCES departments(department_id)
);

-- To find the department with the largest number of employees
SELECT d.department_name, COUNT(e.employee_id) AS employee_count
FROM departments d
JOIN employees e ON d.department_id = e.department_id
GROUP BY d.department_id
ORDER BY employee_count DESC
LIMIT 1;

-- To find the department with the most employees
SELECT d.department_name, COUNT(e.employee_id) AS employee_count
FROM departments d
JOIN employees e ON d.department_id = e.department_id
GROUP BY d.department_id
ORDER BY employee_count DESC
LIMIT 1;

-- To find the employee id of the head whose department has the least number of employees
SELECT e.employee_id
FROM employees e
WHERE e.head_of_department = TRUE
AND e.department_id IN (
    SELECT d.department_id
    FROM departments d
    JOIN employees e ON d.department_id = e.department_id
    GROUP BY d.department_id
    ORDER BY COUNT(e.employee_id) ASC
    LIMIT 1
);

-- To find the name and position of the head whose department has least number of employees
SELECT e.first_name, e.last_name, e.position
FROM employees e
WHERE e.head_of_department = TRUE
AND e.department_id IN (
    SELECT d.department_id
    FROM departments d
    JOIN employees e ON d.department_id = e.department_id
    GROUP BY d.department_id
    ORDER BY COUNT(e.employee_id) ASC
    LIMIT 1
);