CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    keywords TEXT[] NOT NULL
);

CREATE INDEX idx_documents_body ON documents USING GIN (to_tsvector('english', body));
CREATE INDEX idx_documents_keywords ON documents USING GIN (keywords);