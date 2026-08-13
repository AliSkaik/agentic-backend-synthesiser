CREATE TABLE Buildings (
    BuildingID SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Rooms (
    RoomID SERIAL PRIMARY KEY,
    BuildingID INT REFERENCES Buildings(BuildingID),
    Capacity INT NOT NULL,
    RoomType VARCHAR(50)
);

CREATE TABLE Departments (
    DepartmentID SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL UNIQUE,
    Budget DECIMAL(10, 2) NOT NULL
);

CREATE TABLE Classrooms (
    ClassroomID SERIAL PRIMARY KEY,
    RoomID INT REFERENCES Rooms(RoomID),
    Capacity INT NOT NULL CHECK (Capacity > 50)
);

CREATE TABLE DepartmentBudgets (
    DepartmentID INT REFERENCES Departments(DepartmentID),
    Budget DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (DepartmentID)
);

-- Find the buildings which have rooms with capacity more than 50
SELECT DISTINCT b.Name FROM Buildings b JOIN Rooms r ON b.BuildingID = r.BuildingID WHERE r.Capacity > 50;

-- What are the distinct buildings with capacities of greater than 50?
SELECT DISTINCT b.Name FROM Buildings b JOIN Rooms r ON b.BuildingID = r.BuildingID WHERE r.Capacity > 50;

-- Count the number of rooms that are not in the Lamberton building
SELECT COUNT(*) FROM Rooms r JOIN Buildings b ON r.BuildingID = b.BuildingID WHERE b.Name != 'Lamberton';

-- How many classrooms are not in Lamberton?
SELECT COUNT(*) FROM Classrooms c JOIN Rooms r ON c.RoomID = r.RoomID JOIN Buildings b ON r.BuildingID = b.BuildingID WHERE b.Name != 'Lamberton';

-- What is the name and building of the departments whose budget is more than the average budget?
SELECT d.Name, b.Name FROM Departments d JOIN DepartmentBudgets db ON d.DepartmentID = db.DepartmentID JOIN Buildings b ON d.DepartmentID = b.DepartmentID WHERE db.Budget > (SELECT AVG(Budget) FROM DepartmentBudgets);