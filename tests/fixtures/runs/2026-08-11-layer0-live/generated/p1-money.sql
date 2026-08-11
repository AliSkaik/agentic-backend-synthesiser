CREATE TYPE currency AS (
    amount NUMERIC(19, 4),
    currency_code CHAR(3)
);

CREATE TABLE accounts (
    account_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    balance currency DEFAULT (0::NUMERIC, 'USD'::CHAR(3))
);

CREATE TABLE journal_entries (
    entry_id SERIAL PRIMARY KEY,
    description TEXT
);

CREATE TABLE postings (
    posting_id SERIAL PRIMARY KEY,
    entry_id INT REFERENCES journal_entries(entry_id),
    account_id INT REFERENCES accounts(account_id),
    amount currency NOT NULL,
    CONSTRAINT check_amount CHECK (amount.amount >= 0)
);