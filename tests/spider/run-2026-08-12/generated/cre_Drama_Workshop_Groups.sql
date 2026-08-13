CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    order_date DATE NOT NULL,
    planned_delivery_date DATE,
    actual_delivery_date DATE
);

CREATE TABLE drama_workshop_groups (
    group_id SERIAL PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255)
);

ALTER TABLE bookings ADD COLUMN group_id INT;
ALTER TABLE bookings ADD CONSTRAINT fk_group_id FOREIGN KEY (group_id) REFERENCES drama_workshop_groups(group_id);