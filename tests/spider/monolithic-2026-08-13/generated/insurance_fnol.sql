CREATE TABLE policies (
    policy_id SERIAL PRIMARY KEY,
    policy_code VARCHAR(50) NOT NULL,
    policy_type VARCHAR(50) NOT NULL,
    customer_id INT NOT NULL
);

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone_number VARCHAR(15)
);