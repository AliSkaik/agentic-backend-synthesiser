CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE accounts (
    account_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id),
    account_open_date DATE NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_details TEXT
);

-- To show the number of accounts
SELECT COUNT(*) FROM accounts;

-- To count the number of customers who have an account
SELECT COUNT(DISTINCT customer_id) FROM accounts;