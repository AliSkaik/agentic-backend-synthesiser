CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE policies (
    policy_id SERIAL PRIMARY KEY,
    policy_type_code VARCHAR(20) NOT NULL,
    customer_id INT REFERENCES customers(customer_id)
);