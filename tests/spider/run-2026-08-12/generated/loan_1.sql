CREATE TABLE bank_branch (
    branch_id SERIAL PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL
);

CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE branch_customer (
    branch_id INT REFERENCES bank_branch(branch_id),
    customer_id INT REFERENCES customer(customer_id),
    PRIMARY KEY (branch_id, customer_id)
);

-- How many bank branches are there?
SELECT COUNT(*) FROM bank_branch;

-- Count the number of bank branches.
SELECT COUNT(*) FROM bank_branch;

-- How many customers are there?
SELECT COUNT(*) FROM customer;

-- What is the total number of customers across banks?
SELECT SUM(COUNT(*)) AS total_customers FROM branch_customer GROUP BY branch_id;

-- Find the number of customers in the banks at New York City.
SELECT COUNT(*) FROM branch_customer WHERE branch_id IN (SELECT branch_id FROM bank_branch WHERE city = 'New York City');