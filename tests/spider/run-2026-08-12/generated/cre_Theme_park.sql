CREATE TABLE Hotel (
    hotel_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    price_range VARCHAR(50) NOT NULL
);

-- To find the total number of available hotels
SELECT COUNT(*) FROM Hotel;

-- To find the price ranges of all the hotels
SELECT DISTINCT price_range FROM Hotel;

-- To show all distinct location names
SELECT DISTINCT location FROM Hotel;