CREATE TABLE premises (
    id SERIAL PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    details JSONB
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE mailshots (
    id SERIAL PRIMARY KEY,
    premise_id INT REFERENCES premises(id),
    product_id INT REFERENCES products(id)
);