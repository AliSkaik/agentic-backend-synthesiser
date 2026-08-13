CREATE TABLE founders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    founder_id INT REFERENCES founders(id),
    headquarters VARCHAR(255)
);

CREATE TABLE revenues (
    company_id INT REFERENCES companies(id),
    year INT,
    amount NUMERIC(15, 2),
    PRIMARY KEY (company_id, year)
);

INSERT INTO founders (name) VALUES ('James');
INSERT INTO founders (name) VALUES ('Sony');

INSERT INTO companies (name, founder_id, headquarters) VALUES
('Company A', 1, 'New York'),
('Sony', 2, 'Tokyo');

INSERT INTO revenues (company_id, year, amount) VALUES
(1, 2020, 1000000),
(2, 2020, 500000);

-- Who is the founder of Sony?
SELECT f.name FROM founders f JOIN companies c ON f.id = c.founder_id WHERE c.name = 'Sony';

-- Where is the headquarter of the company founded by James?
SELECT c.headquarters FROM companies c JOIN founders f ON c.founder_id = f.id WHERE f.name = 'James';

-- Find all manufacturers' names and their headquarters, sorted by the ones with highest revenue first.
SELECT c.name, c.headquarters
FROM companies c
JOIN (
    SELECT company_id, AVG(amount) AS avg_revenue
    FROM revenues
    GROUP BY company_id
) r ON c.id = r.company_id
ORDER BY r.avg_revenue DESC;