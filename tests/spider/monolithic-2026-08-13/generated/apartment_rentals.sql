CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE apartments (
    id SERIAL PRIMARY KEY,
    building_id INT REFERENCES buildings(id),
    room_number VARCHAR(50) NOT NULL,
    capacity INT NOT NULL
);

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    apartment_id INT REFERENCES apartments(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);