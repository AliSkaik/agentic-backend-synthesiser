CREATE TABLE Vehicles (
    VehicleID SERIAL PRIMARY KEY,
    Make VARCHAR(50) NOT NULL,
    Model VARCHAR(50) NOT NULL,
    Year INT NOT NULL,
    LicensePlate VARCHAR(20) UNIQUE NOT NULL
);

-- To list all vehicle ids
SELECT VehicleID FROM Vehicles;

-- To show the detail of vehicle with id 1
SELECT * FROM Vehicles WHERE VehicleID = 1;