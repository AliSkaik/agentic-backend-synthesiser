CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    detail TEXT
);

CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    organization_id INT REFERENCES organizations(id),
    address VARCHAR(255) NOT NULL
);

CREATE TABLE residents (
    id SERIAL PRIMARY KEY,
    property_id INT REFERENCES properties(id),
    name VARCHAR(255) NOT NULL
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    service_type VARCHAR(255) NOT NULL,
    details TEXT
);

CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    resident_id INT REFERENCES residents(id),
    service_id INT REFERENCES services(id)
);