CREATE TABLE entrepreneur (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE company (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    money_requested NUMERIC(15, 2) NOT NULL
);

CREATE TABLE investor (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE entrepreneur_company (
    entrepreneur_id INT REFERENCES entrepreneur(id),
    company_id INT REFERENCES company(id),
    PRIMARY KEY (entrepreneur_id, company_id)
);

CREATE TABLE entrepreneur_investor (
    entrepreneur_id INT REFERENCES entrepreneur(id),
    investor_id INT REFERENCES investor(id),
    PRIMARY KEY (entrepreneur_id, investor_id)
);