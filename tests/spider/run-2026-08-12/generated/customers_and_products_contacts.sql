CREATE TYPE contact_type AS ENUM ('customer', 'product');

CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    type contact_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address_id INT,
    CONSTRAINT fk_address FOREIGN KEY (address_id) REFERENCES addresses(id)
);

CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    street VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    country VARCHAR(50)
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES contacts(id, type = 'customer'),
    CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES contacts(id, type = 'product')
);

-- How many addresses are there in country USA?
SELECT COUNT(*) FROM addresses WHERE country = 'USA';

-- Show all distinct cities in the address record.
SELECT DISTINCT city FROM addresses;

-- Show each state and the number of addresses in each state.
SELECT state, COUNT(*) AS num_addresses FROM addresses GROUP BY state;

-- Show names and phones of customers who do not have address information.
SELECT name, phone FROM contacts WHERE type = 'customer' AND address_id IS NULL;

-- Show the name of the customer who has the most orders.
SELECT c.name
FROM contacts c
JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name
ORDER BY COUNT(o.id) DESC
LIMIT 1;