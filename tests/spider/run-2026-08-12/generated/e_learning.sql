CREATE TYPE tutor_type AS ENUM ('author', 'tutor');

CREATE TABLE tutors (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    address VARCHAR(255),
    type tutor_type NOT NULL
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    author_id INT REFERENCES tutors(id)
);

CREATE TABLE course_authors (
    course_id INT REFERENCES courses(id),
    tutor_id INT REFERENCES tutors(id),
    PRIMARY KEY (course_id, tutor_id)
);

-- How many courses are there in total?
SELECT COUNT(*) FROM courses;

-- Find the total number of courses offered.
SELECT COUNT(*) FROM courses WHERE name = 'database';

-- What are the descriptions of the courses with name "database"?
SELECT description FROM courses WHERE name = 'database';

-- What are the addresses of the course authors or tutors with personal name "Cathrine"?
SELECT address FROM tutors WHERE first_name = 'Cathrine';