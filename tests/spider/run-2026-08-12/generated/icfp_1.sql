CREATE TABLE authors (
    author_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE institutions (
    institution_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE papers (
    paper_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    abstract TEXT,
    publication_year INT
);

CREATE TABLE author_papers (
    author_id INT REFERENCES authors(author_id),
    paper_id INT REFERENCES papers(paper_id),
    PRIMARY KEY (author_id, paper_id)
);

CREATE TABLE institution_papers (
    institution_id INT REFERENCES institutions(institution_id),
    paper_id INT REFERENCES papers(paper_id),
    PRIMARY KEY (institution_id, paper_id)
);

-- Views to answer specific questions
CREATE VIEW author_count AS SELECT COUNT(*) FROM authors;

CREATE VIEW institution_count AS SELECT COUNT(*) FROM institutions;

CREATE VIEW total_papers_published AS SELECT COUNT(*) FROM papers;