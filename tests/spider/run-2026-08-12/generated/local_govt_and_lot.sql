CREATE TYPE service_type AS ENUM ('Electricity', 'Water', 'Gas');

CREATE TABLE organizations (
    org_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    detail TEXT
);

CREATE TABLE properties (
    prop_id SERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    owner_org_id INT REFERENCES organizations(org_id)
);

CREATE TABLE residents (
    res_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    property_id INT REFERENCES properties(prop_id)
);

CREATE TABLE services (
    service_id SERIAL PRIMARY KEY,
    type service_type NOT NULL,
    details TEXT
);

CREATE TABLE requests (
    request_id SERIAL PRIMARY KEY,
    resident_id INT REFERENCES residents(res_id),
    service_id INT REFERENCES services(service_id),
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- How many residents does each property have? List property id and resident count.
SELECT p.prop_id, COUNT(r.res_id) AS resident_count FROM properties p LEFT JOIN residents r ON p.prop_id = r.property_id GROUP BY p.prop_id;

-- What is the distinct service types that are provided by the organization which has detail 'Denesik and Sons Party'?
SELECT DISTINCT s.type FROM services s JOIN requests req ON s.service_id = req.service_id JOIN residents res ON req.resident_id = res.res_id JOIN properties prop ON res.property_id = prop.prop_id JOIN organizations org ON prop.owner_org_id = org.org_id WHERE org.detail = 'Denesik and Sons Party';

-- What is the maximum number that a certain service is provided? List the service id, details and number.
SELECT s.service_id, s.details, COUNT(req.request_id) AS count FROM services s JOIN requests req ON s.service_id = req.service_id GROUP BY s.service_id, s.details ORDER BY count DESC LIMIT 1;

-- List the id and type of each thing, and the details of the organization that owns it.
SELECT t.thing_id, t.type, o.detail FROM (SELECT prop.prop_id AS thing_id, 'Property' AS type FROM properties prop UNION ALL SELECT res.res_id AS thing_id, 'Resident' AS type FROM residents res) t JOIN organizations o ON t.thing_id = o.org_id;