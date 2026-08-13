CREATE TABLE Writers (
    WriterID SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Books (
    BookID SERIAL PRIMARY KEY,
    Title VARCHAR(255) NOT NULL UNIQUE,
    Issues INT NOT NULL,
    WriterID INT REFERENCES Writers(WriterID)
);

-- How many books are there?
SELECT COUNT(*) FROM Books;

-- List the writers of the books in ascending alphabetical order.
SELECT W.Name FROM Writers W JOIN Books B ON W.WriterID = B.WriterID ORDER BY W.Name ASC;

-- List the titles of the books in ascending order of issues.
SELECT Title FROM Books ORDER BY Issues ASC;

-- What are the titles of the books whose writer is not "Elaine Lee"?
SELECT Title FROM Books WHERE WriterID NOT IN (SELECT WriterID FROM Writers WHERE Name = 'Elaine Lee');

-- What are the title and issues of the books?
SELECT Title, Issues FROM Books;