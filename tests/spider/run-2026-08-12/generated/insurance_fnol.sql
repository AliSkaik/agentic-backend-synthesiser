CREATE TYPE policy_type AS ENUM ('Life', 'Health', 'Auto');

CREATE TABLE policies (
    policy_id SERIAL PRIMARY KEY,
    policy_code VARCHAR(50) NOT NULL UNIQUE,
    policy_type policy_type NOT NULL
);

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    phone_number VARCHAR(15) NOT NULL UNIQUE
);

CREATE TABLE policy_customers (
    policy_customer_id SERIAL PRIMARY KEY,
    policy_id INT REFERENCES policies(policy_id),
    customer_id INT REFERENCES customers(customer_id)
);

-- To find all the phone numbers
SELECT phone_number FROM customers;

-- What are all the phone numbers under the policy "Life Insurance"
SELECT c.phone_number 
FROM customers c
JOIN policy_customers pc ON c.customer_id = pc.customer_id
JOIN policies p ON pc.policy_id = p.policy_id
WHERE p.policy_code = 'Life Insurance';

-- Which policy type has the most records in the database
SELECT policy_type, COUNT(*) AS record_count
FROM policies
GROUP BY policy_type
ORDER BY record_count DESC
LIMIT 1;