CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    room_type VARCHAR(100),
    base_price NUMERIC(10, 2) NOT NULL,
    beds INTEGER NOT NULL,
    capacity INTEGER NOT NULL
);

CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);