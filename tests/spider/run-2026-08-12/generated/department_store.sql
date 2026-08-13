CREATE TABLE Product (
    product_id SERIAL PRIMARY KEY,
    product_type VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE Purchase (
    purchase_id SERIAL PRIMARY KEY,
    product_id INT REFERENCES Product(product_id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

-- View to find the top three products purchased in the largest amount
CREATE VIEW TopPurchases AS
SELECT p.product_id, SUM(p.quantity) as total_quantity
FROM Purchase p
GROUP BY p.product_id
ORDER BY total_quantity DESC
LIMIT 3;

-- View to find the cheapest product
CREATE VIEW CheapestProduct AS
SELECT product_id, product_type, price
FROM Product
ORDER BY price ASC
LIMIT 1;

-- Function to count distinct product types
CREATE OR REPLACE FUNCTION CountDistinctProductTypes() RETURNS INT AS $$
BEGIN
    RETURN (SELECT COUNT(DISTINCT product_type) FROM Product);
END;
$$ LANGUAGE plpgsql;