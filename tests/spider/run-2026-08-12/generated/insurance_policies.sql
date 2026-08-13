CREATE TYPE claim_status AS ENUM ('pending', 'settled');

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
    claim_value NUMERIC(10, 2) NOT NULL,
    status claim_status DEFAULT 'pending'
);

CREATE TABLE settlements (
    settlement_id SERIAL PRIMARY KEY,
    claim_id INT REFERENCES claims(claim_id),
    payment_method VARCHAR(50) NOT NULL,
    payment_date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL
);

-- Query to find claims that caused more than 2 settlements or have the maximum claim value
SELECT c.claim_id, c.claim_date
FROM claims c
JOIN (
    SELECT claim_id
    FROM settlements
    GROUP BY claim_id
    HAVING COUNT(*) > 2
) s ON c.claim_id = s.claim_id
UNION
SELECT c.claim_id, c.claim_date
FROM claims c
WHERE c.claim_value = (
    SELECT MAX(claim_value)
    FROM claims
);

-- Query to find customers who had at least 2 policies but did not file any claims
SELECT c.customer_id, c.first_name, c.last_name
FROM customers c
JOIN policies p ON c.customer_id = p.customer_id
LEFT JOIN claims cl ON p.policy_id = cl.policy_id
WHERE p.policy_id IN (
    SELECT policy_id
    FROM policies
    GROUP BY customer_id
    HAVING COUNT(*) >= 2
)
AND cl.claim_id IS NULL;

-- Query to list the method, date and amount of all the payments in ascending order of date
SELECT payment_method, payment_date, amount
FROM settlements
ORDER BY payment_date ASC;