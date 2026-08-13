CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE policies (
    policy_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id),
    policy_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

CREATE TABLE claims (
    claim_id SERIAL PRIMARY KEY,
    policy_id INT REFERENCES policies(policy_id),
    claim_date DATE NOT NULL,
    claim_value NUMERIC(10, 2) NOT NULL
);

CREATE TABLE settlements (
    settlement_id SERIAL PRIMARY KEY,
    claim_id INT REFERENCES claims(claim_id),
    settlement_date DATE NOT NULL,
    settlement_amount NUMERIC(10, 2) NOT NULL
);

CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    method VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL
);