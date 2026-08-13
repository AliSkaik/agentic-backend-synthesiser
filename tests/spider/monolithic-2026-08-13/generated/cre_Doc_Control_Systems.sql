CREATE TABLE document_status (
    status_code VARCHAR(10) PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE document_type (
    type_code VARCHAR(10) PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE shipping_agent (
    agent_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);