CREATE TABLE Aircraft (
    AircraftID SERIAL PRIMARY KEY,
    Description VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Airport (
    AirportID SERIAL PRIMARY KEY,
    Name VARCHAR(255) NOT NULL UNIQUE,
    Country VARCHAR(100)
);

CREATE TABLE Flight (
    FlightID SERIAL PRIMARY KEY,
    AircraftID INT REFERENCES Aircraft(AircraftID),
    DepartureAirportID INT REFERENCES Airport(AirportID),
    ArrivalAirportID INT REFERENCES Airport(AirportID),
    InternationalPassengers INT
);

-- To answer: How many aircrafts are there?
SELECT COUNT(*) FROM Aircraft;

-- To answer: What is the number of aircraft?
SELECT COUNT(*) FROM Aircraft;

-- To answer: List the description of all aircrafts.
SELECT Description FROM Aircraft;

-- To answer: What are the descriptions for the aircrafts?
SELECT Description FROM Aircraft;

-- To answer: What is the average number of international passengers of all airports?
SELECT AVG(InternationalPassengers) AS AverageInternationalPassengers
FROM Flight;