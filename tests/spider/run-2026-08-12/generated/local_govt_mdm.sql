CREATE TYPE cmi_master_type AS ENUM ('Tax', 'BusinessRates', 'ParkingFine');

CREATE TABLE cmi_masters (
    cmi_cross_reference_id SERIAL PRIMARY KEY,
    master_customer_id INT NOT NULL,
    cross_reference_code CMI_MASTER_TYPE NOT NULL,
    source_system_code VARCHAR(50) NOT NULL
);

CREATE TABLE council_tax_entries (
    council_tax_entry_id SERIAL PRIMARY KEY,
    cmi_cross_reference_id INT REFERENCES cmi_masters(cmi_cross_reference_id)
);

CREATE TABLE business_rates (
    business_rate_id SERIAL PRIMARY KEY,
    cmi_cross_reference_id INT REFERENCES cmi_masters(cmi_cross_reference_id),
    master_customer_id INT NOT NULL
);

CREATE TABLE parking_fines (
    parking_fine_id SERIAL PRIMARY KEY,
    cmi_cross_reference_id INT REFERENCES cmi_masters(cmi_cross_reference_id)
);

CREATE TABLE tax_source_systems (
    tax_source_system_code VARCHAR(50) PRIMARY KEY,
    benefit_id INT UNIQUE
);

CREATE TABLE benefits_overpayments (
    benefit_id INT PRIMARY KEY,
    tax_source_system_code VARCHAR(50) REFERENCES tax_source_systems(tax_source_system_code)
);