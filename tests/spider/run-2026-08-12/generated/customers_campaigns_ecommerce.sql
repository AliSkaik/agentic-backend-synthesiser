CREATE TYPE premise_type AS ENUM ('residential', 'commercial', 'industrial');

CREATE TABLE premises (
    id SERIAL PRIMARY KEY,
    type premise_type NOT NULL,
    details TEXT NOT NULL
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL
);

CREATE TABLE mailshots (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id),
    premise_id INT REFERENCES premises(id)
);

-- How many premises are there?
SELECT COUNT(*) FROM premises;

-- What are all the distinct premise types?
SELECT DISTINCT type FROM premises;

-- Find the types and details for all premises and order by the premise type.
SELECT type, details FROM premises ORDER BY type;

-- Show each premise type and the number of premises in that type.
SELECT type, COUNT(*) AS count FROM premises GROUP BY type;

-- Show all distinct product categories along with the number of mailshots in each category.
SELECT p.category, COUNT(m.id) AS mailshot_count
FROM products p
JOIN mailshots m ON p.id = m.product_id
GROUP BY p.category;