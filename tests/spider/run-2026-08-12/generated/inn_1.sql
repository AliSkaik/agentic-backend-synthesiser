CREATE TYPE RoomType AS ENUM ('modern', 'deluxe', 'suite');

CREATE TABLE Rooms (
    room_id SERIAL PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    room_type RoomType NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    max_occupancy INT NOT NULL
);

CREATE TABLE Reservations (
    reservation_id SERIAL PRIMARY KEY,
    room_id INT REFERENCES Rooms(room_id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    FOREIGN KEY (room_id) REFERENCES Rooms(room_id)
);

-- Find the names of all modern rooms with a base price below $160 and two beds
SELECT room_name FROM Rooms WHERE room_type = 'modern' AND base_price < 160 AND max_occupancy = 2;

-- Find all the rooms that have a price higher than 160 and can accommodate more than 2 people. Report room names and ids.
SELECT room_id, room_name FROM Rooms WHERE base_price > 160 AND max_occupancy > 2;

-- Find the most popular room in the hotel. The most popular room is the room that had seen the largest number of reservations.
SELECT r.room_id, r.room_name
FROM Rooms r
JOIN Reservations res ON r.room_id = res.room_id
GROUP BY r.room_id, r.room_name
ORDER BY COUNT(res.reservation_id) DESC
LIMIT 1;