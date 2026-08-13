CREATE TYPE asset_type AS ENUM ('machine', 'equipment', 'tool');

CREATE TABLE assets (
    asset_id SERIAL PRIMARY KEY,
    detail TEXT NOT NULL,
    type asset_type NOT NULL,
    contract_id INT REFERENCES maintenance_contracts(contract_id),
    supplier_id INT REFERENCES third_party_companies(company_id)
);

CREATE TABLE parts (
    part_id SERIAL PRIMARY KEY,
    asset_id INT REFERENCES assets(asset_id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

CREATE TABLE fault_logs (
    log_id SERIAL PRIMARY KEY,
    asset_id INT REFERENCES assets(asset_id),
    staff_id INT REFERENCES staff(staff_id),
    description TEXT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE maintenance_contracts (
    contract_id SERIAL PRIMARY KEY,
    company_id INT REFERENCES third_party_companies(company_id)
);

CREATE TABLE third_party_companies (
    company_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE staff (
    staff_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role VARCHAR(50) NOT NULL
);

CREATE TABLE visiting_engineers (
    engineer_id SERIAL PRIMARY KEY,
    company_id INT REFERENCES third_party_companies(company_id)
);

-- Queries based on the requirements

-- Which assets have 2 parts and have less than 2 fault logs?
SELECT a.asset_id, a.detail FROM assets a JOIN parts p ON a.asset_id = p.asset_id WHERE p.asset_id IN (SELECT asset_id FROM parts GROUP BY asset_id HAVING COUNT(*) = 2) AND a.asset_id NOT IN (SELECT asset_id FROM fault_logs GROUP BY asset_id HAVING COUNT(*) >= 2);

-- List the asset id and detail
SELECT asset_id, detail FROM assets;

-- How many assets does each maintenance contract contain?
SELECT contract_id, COUNT(asset_id) AS num_assets FROM assets GROUP BY contract_id;

-- How many assets does each third party company supply?
SELECT supplier_id, COUNT(asset_id) AS num_assets FROM assets GROUP BY supplier_id;

-- Which third party companies have at least 2 maintenance engineers or have at least 2 maintenance contracts?
SELECT company_id, name FROM third_party_companies WHERE company_id IN (SELECT company_id FROM visiting_engineers GROUP BY company_id HAVING COUNT(*) >= 2) OR company_id IN (SELECT company_id FROM maintenance_contracts GROUP BY company_id HAVING COUNT(*) >= 2);

-- What is the name and id of the staff who recorded the fault log but has not contacted any visiting engineers?
SELECT s.staff_id, s.name FROM staff s JOIN fault_logs f ON s.staff_id = f.staff_id WHERE s.staff_id NOT IN (SELECT DISTINCT engineer_id FROM visiting_engineers);