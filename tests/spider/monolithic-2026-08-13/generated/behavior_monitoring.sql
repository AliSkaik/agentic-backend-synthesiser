CREATE TABLE assessment_notes (
    id SERIAL PRIMARY KEY,
    note TEXT NOT NULL,
    date DATE NOT NULL,
    address_id INT NOT NULL,
    FOREIGN KEY (address_id) REFERENCES addresses(id)
);

CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    street VARCHAR(255),
    city VARCHAR(100),
    state CHAR(2),
    zip_code CHAR(5)
);

CREATE TABLE incidents (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL,
    detention_type_code VARCHAR(50),
    address_id INT NOT NULL,
    FOREIGN KEY (address_id) REFERENCES addresses(id)
);