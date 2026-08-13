CREATE TABLE entrepreneurs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    entrepreneur_id INT REFERENCES entrepreneurs(id),
    name VARCHAR(255) NOT NULL,
    money_requested NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE investors (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id),
    investor_name VARCHAR(255) NOT NULL,
    investment_amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);