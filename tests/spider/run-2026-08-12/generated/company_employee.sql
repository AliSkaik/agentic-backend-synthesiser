CREATE TYPE Industry AS ENUM ('Banking', 'Retailing', 'Technology', 'Healthcare');

CREATE TABLE Company (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    headquarters VARCHAR(255),
    industry Industry NOT NULL,
    market_value NUMERIC(15, 2)
);

-- To answer: How many companies are headquartered in the US?
SELECT COUNT(*) FROM Company WHERE headquarters = 'US';

-- To list the names of companies by ascending number of sales
SELECT name FROM Company ORDER BY market_value ASC;

-- To show the headquarters and industries of all companies
SELECT headquarters, industry FROM Company;

-- To show the names of companies in the banking or retailing industry
SELECT name FROM Company WHERE industry IN ('Banking', 'Retailing');

-- To find the maximum and minimum market value of companies
SELECT MAX(market_value), MIN(market_value) FROM Company;