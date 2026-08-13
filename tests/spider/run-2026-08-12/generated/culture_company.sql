CREATE TABLE Publishers (
    publisher_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Authors (
    author_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100)
);

CREATE TABLE Books (
    book_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    publication_year INT NOT NULL,
    publisher_id INT REFERENCES Publishers(publisher_id),
    author_ids TEXT[] REFERENCES Authors(author_id)
);

CREATE TABLE Book_Clubs (
    club_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Club_Membership (
    membership_id SERIAL PRIMARY KEY,
    book_club_id INT REFERENCES Book_Clubs(club_id),
    member_id INT NOT NULL
);