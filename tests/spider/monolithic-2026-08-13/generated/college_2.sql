CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    building_id INT REFERENCES buildings(id),
    capacity INT NOT NULL,
    room_type VARCHAR(255)
);

CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    budget DECIMAL(10, 2) NOT NULL
);