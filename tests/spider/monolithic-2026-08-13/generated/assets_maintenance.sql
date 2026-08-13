CREATE TABLE assets (
    asset_id SERIAL PRIMARY KEY,
    detail TEXT NOT NULL
);

CREATE TABLE parts (
    part_id SERIAL PRIMARY KEY,
    asset_id INT REFERENCES assets(asset_id),
    name TEXT NOT NULL
);

CREATE TABLE fault_logs (
    log_id SERIAL PRIMARY KEY,
    asset_id INT REFERENCES assets(asset_id),
    staff_id INT,
    description TEXT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE maintenance_contracts (
    contract_id SERIAL PRIMARY KEY,
    asset_id INT REFERENCES assets(asset_id)
);

CREATE TABLE third_party_companies (
    company_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE company_suppliers (
    supplier_id SERIAL PRIMARY KEY,
    company_id INT REFERENCES third_party_companies(company_id),
    asset_id INT REFERENCES assets(asset_id)
);

CREATE TABLE maintenance_engineers (
    engineer_id SERIAL PRIMARY KEY,
    company_id INT REFERENCES third_party_companies(company_id)
);