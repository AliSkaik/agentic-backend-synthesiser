CREATE TABLE Companies (
    CompanyID SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL UNIQUE,
    HeadquartersCountry VARCHAR(50),
    MainIndustry VARCHAR(50)
);

CREATE TABLE Sales (
    SaleID SERIAL PRIMARY KEY,
    CompanyID INT REFERENCES Companies(CompanyID),
    Amount DECIMAL(15, 2) NOT NULL
);

-- How many gas companies are there?
SELECT COUNT(*) FROM Companies;

-- What is the total number of companies?
SELECT COUNT(*) FROM Companies;

-- List the company name and rank for all companies in the decreasing order of their sales.
WITH RankedSales AS (
    SELECT C.Name, RANK() OVER (ORDER BY SUM(S.Amount) DESC) AS Rank
    FROM Companies C
    JOIN Sales S ON C.CompanyID = S.CompanyID
    GROUP BY C.Name
)
SELECT Name, Rank FROM RankedSales;

-- What is the name and rank of every company ordered by descending number of sales?
WITH RankedSales AS (
    SELECT C.Name, RANK() OVER (ORDER BY SUM(S.Amount) DESC) AS Rank
    FROM Companies C
    JOIN Sales S ON C.CompanyID = S.CompanyID
    GROUP BY C.Name
)
SELECT Name, Rank FROM RankedSales;

-- Show the company name and the main industry for all companies whose headquarters are not from USA.
SELECT Name, MainIndustry FROM Companies WHERE HeadquartersCountry != 'USA';