CREATE TABLE cmi_masters (
    id SERIAL PRIMARY KEY,
    cross_reference_code VARCHAR(50) NOT NULL,
    details TEXT
);

CREATE TABLE cmi_cross_references (
    id SERIAL PRIMARY KEY,
    source_system_code VARCHAR(50) NOT NULL,
    cmi_master_id INT REFERENCES cmi_masters(id)
);

CREATE TABLE business_rates (
    id SERIAL PRIMARY KEY,
    cmi_cross_reference_id INT REFERENCES cmi_cross_references(id),
    master_customer_id INT
);

CREATE TABLE taxes (
    id SERIAL PRIMARY KEY,
    source_system_code VARCHAR(50) NOT NULL,
    master_customer_id INT,
    parking_fine_id INT
);

CREATE TABLE benefits_and_overpayments (
    id SERIAL PRIMARY KEY,
    tax_source_system_code VARCHAR(50) NOT NULL,
    benefit_id INT
);