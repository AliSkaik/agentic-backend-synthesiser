CREATE TABLE Document (
    document_id SERIAL PRIMARY KEY,
    document_name VARCHAR(255) NOT NULL,
    document_description TEXT NOT NULL
);

CREATE TABLE Template (
    template_id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL
);

CREATE TABLE Document_Template (
    document_id INT REFERENCES Document(document_id),
    template_id INT REFERENCES Template(template_id),
    PRIMARY KEY (document_id, template_id)
);