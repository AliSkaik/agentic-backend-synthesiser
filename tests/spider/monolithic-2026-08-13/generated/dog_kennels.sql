CREATE TABLE states (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE owners (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    state_id INT REFERENCES states(id)
);

CREATE TABLE professionals (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    cell_phone VARCHAR(15),
    state_id INT REFERENCES states(id)
);

CREATE TABLE dogs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL
);

CREATE TABLE treatments (
    id SERIAL PRIMARY KEY,
    dog_id INT REFERENCES dogs(id),
    professional_id INT REFERENCES professionals(id),
    treatment_date DATE NOT NULL
);