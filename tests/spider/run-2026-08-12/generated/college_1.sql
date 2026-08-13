CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE professors (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    department_id INT REFERENCES departments(id)
);

CREATE TABLE courses (
    code VARCHAR(20) PRIMARY KEY,
    title VARCHAR(100) NOT NULL
);

CREATE TABLE professor_course_assignments (
    professor_id INT REFERENCES professors(id),
    course_code VARCHAR(20) REFERENCES courses(code),
    PRIMARY KEY (professor_id, course_code)
);

-- Example data insertion for demonstration purposes
INSERT INTO departments (name) VALUES ('Accounting'), ('Biology');
INSERT INTO professors (first_name, last_name, department_id) VALUES 
('John', 'Doe', 1), ('Jane', 'Smith', 2);
INSERT INTO courses (code, title) VALUES ('ACCT-211', 'Financial Accounting');
INSERT INTO professor_course_assignments (professor_id, course_code) VALUES 
(1, 'ACCT-211'), (2, 'ACCT-211');

-- Queries based on the requirements
SELECT COUNT(*) FROM professors WHERE department_id = 1; -- Number of professors in accounting department

SELECT COUNT(*) FROM professor_course_assignments WHERE course_code = 'ACCT-211'; -- Number of professors teaching class with code ACCT-211

SELECT first_name, last_name FROM professors WHERE department_id = 2; -- First and last name of the professor in biology department