CREATE TYPE membership_card AS ENUM ('black', 'silver', 'gold');

CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    membership_card membership_card DEFAULT 'silver'
);

CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    member_id INT REFERENCES members(id),
    purchase_time TIMESTAMP NOT NULL
);

-- How many members have the black membership card?
SELECT COUNT(*) FROM members WHERE membership_card = 'black';

-- Find the number of members living in each address.
SELECT address, COUNT(*) FROM members GROUP BY address;

-- Give me the names of members whose address is in Harford or Waterbury.
SELECT name FROM members WHERE address IN ('Harford', 'Waterbury');

-- Find the ids and names of members who are under age 30 or with black membership card.
SELECT id, name FROM members WHERE age < 30 OR membership_card = 'black';

-- Find the purchase time, age and address of each member, and show the results in the order of purchase time.
SELECT p.purchase_time, m.age, m.address
FROM purchases p
JOIN members m ON p.member_id = m.id
ORDER BY p.purchase_time;