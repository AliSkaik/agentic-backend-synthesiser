CREATE TABLE authors (
    id SERIAL PRIMARY KEY,
    personal_name VARCHAR(255) NOT NULL,
    address TEXT
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    author_id INT REFERENCES authors(id)
);