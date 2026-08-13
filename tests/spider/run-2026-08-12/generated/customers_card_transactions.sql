CREATE TYPE account_type AS ENUM ('savings', 'checking');

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL
);

CREATE TABLE accounts (
    account_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id),
    account_type account_type NOT NULL,
    account_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    account_id INT REFERENCES accounts(account_id),
    amount NUMERIC(15, 2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- How many accounts do we have?
SELECT COUNT(*) FROM accounts;

-- Show ids, customer ids, names for all accounts.
SELECT account_id, customer_id, account_name FROM accounts;

-- What are the account ids, customer ids, and account names for all the accounts?
SELECT account_id, customer_id, account_name FROM accounts;

-- Show other account details for account with name '338'.
SELECT * FROM accounts WHERE account_name = '338';