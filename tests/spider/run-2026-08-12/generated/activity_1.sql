CREATE TABLE Faculty (
    faculty_id SERIAL PRIMARY KEY,
    rank VARCHAR(50) NOT NULL,
    building VARCHAR(100)
);

-- To find the total number of faculty members
SELECT COUNT(*) FROM Faculty;

-- To find the list of distinct ranks for faculty
SELECT DISTINCT rank FROM Faculty;

-- To show all the distinct buildings that have faculty rooms
SELECT DISTINCT building FROM Faculty WHERE building IS NOT NULL;