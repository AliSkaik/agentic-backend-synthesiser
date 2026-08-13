CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL
);

CREATE TABLE customer_type (
    type_code CHAR(3) PRIMARY KEY,
    description TEXT
);

CREATE TABLE customer_type_assignment (
    customer_id INT REFERENCES customer(customer_id),
    type_code CHAR(3) REFERENCES customer_type(type_code),
    PRIMARY KEY (customer_id, type_code)
);