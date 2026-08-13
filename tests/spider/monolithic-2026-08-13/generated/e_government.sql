CREATE TABLE individuals (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL
);

CREATE TABLE forms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100)
);

CREATE TABLE party_forms (
    id SERIAL PRIMARY KEY,
    form_id INT REFERENCES forms(id),
    party_name VARCHAR(255) NOT NULL
);