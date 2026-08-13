CREATE TABLE Company (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    headquarters VARCHAR(255),
    market_value NUMERIC(18, 2)
);

-- To count the number of companies
SELECT COUNT(*) FROM Company;

-- To list the names of companies in descending order of market value
SELECT name FROM Company ORDER BY market_value DESC;

-- To get the names of companies whose headquarters are not "USA"
SELECT name FROM Company WHERE headquarters != 'USA';