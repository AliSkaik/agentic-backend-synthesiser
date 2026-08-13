CREATE TYPE degree_level AS ENUM ('bachelor', 'master', 'doctorate');

CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    date_of_birth DATE NOT NULL
);

CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    course_title VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL CHECK (credits > 0)
);

CREATE TABLE enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    course_id INT REFERENCES courses(course_id),
    semester VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    grade CHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    UNIQUE (student_id, course_id)
);

CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE professors (
    professor_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    date_of_birth DATE NOT NULL,
    department_id INT REFERENCES departments(department_id)
);

CREATE TABLE course_professors (
    course_id INT REFERENCES courses(course_id),
    professor_id INT REFERENCES professors(professor_id),
    PRIMARY KEY (course_id, professor_id)
);

CREATE TABLE degrees (
    degree_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    degree_level degree_level NOT NULL,
    graduation_date DATE
);