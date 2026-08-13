CREATE TABLE Courses (
    course_id SERIAL PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL UNIQUE,
    credits INT NOT NULL CHECK (credits > 0)
);

-- To count the total number of courses
SELECT COUNT(*) FROM Courses;

-- To count the number of courses with more than 2 credits
SELECT COUNT(*) FROM Courses WHERE credits > 2;

-- To list all names of courses with 1 credit
SELECT course_name FROM Courses WHERE credits = 1;