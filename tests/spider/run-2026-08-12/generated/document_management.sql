CREATE TABLE Document (
    document_id SERIAL PRIMARY KEY,
    document_name VARCHAR(255) NOT NULL UNIQUE,
    access_count INT DEFAULT 0
);

CREATE OR REPLACE FUNCTION update_access_count(document_id INT)
RETURNS VOID AS $$
BEGIN
    UPDATE Document SET access_count = access_count + 1 WHERE document_id = document_id;
END;
$$ LANGUAGE plpgsql;

-- Find the name and access counts of all documents, in alphabetic order of the document name.
SELECT document_name, access_count FROM Document ORDER BY document_name;

-- What are the names of all the documents, as well as the access counts of each, ordered alphabetically?
SELECT document_name, access_count FROM Document ORDER BY document_name;

-- Find the name of the document that has been accessed the greatest number of times, as well as the count of how many times it has been accessed.
SELECT document_name, access_count FROM Document WHERE access_count = (SELECT MAX(access_count) FROM Document);

-- What is the name of the document which has been accessed the most times, as well as the number of times it has been accessed?
SELECT document_name, access_count FROM Document ORDER BY access_count DESC LIMIT 1;

-- Find the types of documents with more than 4 documents.
-- Assuming there's a table `DocumentType` with columns `document_type_id` and `type_name`
CREATE TABLE DocumentType (
    document_type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL UNIQUE
);

ALTER TABLE Document ADD COLUMN document_type_id INT;
ALTER TABLE Document ADD CONSTRAINT fk_document_type FOREIGN KEY (document_type_id) REFERENCES DocumentType(document_type_id);

SELECT type_name FROM DocumentType WHERE document_type_id IN (
    SELECT document_type_id FROM Document GROUP BY document_type_id HAVING COUNT(*) > 4
);