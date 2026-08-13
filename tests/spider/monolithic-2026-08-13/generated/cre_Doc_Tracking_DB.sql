CREATE TABLE calendar_items (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    day_number INT NOT NULL,
    document_type VARCHAR(255) NOT NULL
);

CREATE TABLE document_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL UNIQUE
);