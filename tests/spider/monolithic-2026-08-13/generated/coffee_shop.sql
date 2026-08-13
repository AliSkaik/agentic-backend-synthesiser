CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    membership_card VARCHAR(50)
);

CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    member_id INT REFERENCES members(id),
    purchase_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);