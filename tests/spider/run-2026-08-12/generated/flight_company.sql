CREATE TABLE Aircraft (
    aircraft_id SERIAL PRIMARY KEY,
    model VARCHAR(100) NOT NULL,
    velocity INT NOT NULL
);

CREATE TABLE Flight (
    flight_id SERIAL PRIMARY KEY,
    vehicle_flight_number VARCHAR(50) NOT NULL UNIQUE,
    date DATE NOT NULL,
    pilot_id INT NOT NULL,
    aircraft_id INT NOT NULL,
    altitude INT NOT NULL,
    FOREIGN KEY (pilot_id) REFERENCES Pilot(pilot_id),
    FOREIGN KEY (aircraft_id) REFERENCES Aircraft(aircraft_id)
);

CREATE TABLE Airport (
    airport_id SERIAL PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE Pilot (
    pilot_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE Flight_Airport (
    flight_id INT NOT NULL,
    airport_id INT NOT NULL,
    arrival BOOLEAN NOT NULL,
    PRIMARY KEY (flight_id, airport_id),
    FOREIGN KEY (flight_id) REFERENCES Flight(flight_id),
    FOREIGN KEY (airport_id) REFERENCES Airport(airport_id)
);

-- How many flights have a velocity larger than 200?
SELECT COUNT(*) FROM Aircraft WHERE velocity > 200;

-- List the vehicle flight number, date and pilot of all the flights, ordered by altitude.
SELECT F.vehicle_flight_number, F.date, P.name
FROM Flight F
JOIN Pilot P ON F.pilot_id = P.pilot_id
ORDER BY F.altitude;

-- List the id, country, city and name of the airports ordered alphabetically by the name.
SELECT airport_id, country, city, name FROM Airport ORDER BY name;

-- What is maximum group equity shareholding of the companies?
-- Assuming there's a table named Company with a column group_equity_shareholding
SELECT MAX(group_equity_shareholding) FROM Company;

-- What is the velocity of the pilot named 'Thompson'?
SELECT A.velocity FROM Aircraft A JOIN Flight F ON A.aircraft_id = F.aircraft_id JOIN Pilot P ON F.pilot_id = P.pilot_id WHERE P.name = 'Thompson';