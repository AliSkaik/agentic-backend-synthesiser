CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE apartments (
    apartment_id SERIAL PRIMARY KEY,
    building_id INT REFERENCES buildings(building_id),
    room_count INT NOT NULL CHECK (room_count > 0)
);

CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    apartment_id INT REFERENCES apartments(apartment_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- View to count total number of apartment bookings
CREATE VIEW total_bookings AS
SELECT COUNT(*) FROM bookings;

-- View to show all distinct building descriptions
CREATE VIEW distinct_building_descriptions AS
SELECT DISTINCT description FROM buildings;