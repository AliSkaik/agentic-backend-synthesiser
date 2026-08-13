CREATE TYPE allergy_type AS ENUM ('food', 'drug', 'environmental', 'medication');

CREATE TABLE allergies (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    type allergy_type NOT NULL,
    description TEXT NOT NULL,
    UNIQUE (patient_id, type, description)
);

CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL
);

ALTER TABLE allergies ADD CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES patients(id);