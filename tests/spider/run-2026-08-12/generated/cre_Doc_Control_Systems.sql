CREATE TYPE DocumentStatus AS ENUM ('Draft', 'Working', 'Approved', 'Rejected');

CREATE TABLE DocumentTypes (
    doc_type_code VARCHAR(10) PRIMARY KEY,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE ShippingAgents (
    agent_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Documents (
    document_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    doc_type_code VARCHAR(10),
    status DocumentStatus,
    shipping_agent_id INT,
    FOREIGN KEY (doc_type_code) REFERENCES DocumentTypes(doc_type_code),
    FOREIGN KEY (shipping_agent_id) REFERENCES ShippingAgents(agent_id)
);

CREATE TABLE DocumentStatusCodes (
    code DocumentStatus PRIMARY KEY,
    description VARCHAR(255) NOT NULL
);