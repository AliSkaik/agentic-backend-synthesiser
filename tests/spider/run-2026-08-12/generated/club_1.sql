CREATE TABLE Club (
    club_id SERIAL PRIMARY KEY,
    club_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Student (
    student_id SERIAL PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL
);

CREATE TABLE ClubMembership (
    membership_id SERIAL PRIMARY KEY,
    club_id INT REFERENCES Club(club_id),
    student_id INT REFERENCES Student(student_id),
    UNIQUE (club_id, student_id)
);