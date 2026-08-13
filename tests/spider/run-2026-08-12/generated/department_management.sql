CREATE TABLE Departments (
    DepartmentID SERIAL PRIMARY KEY,
    Name VARCHAR(255) NOT NULL UNIQUE,
    CreationYear INT NOT NULL CHECK (CreationYear > 0),
    Budget DECIMAL(15, 2) NOT NULL CHECK (Budget >= 0)
);

CREATE TABLE Employees (
    EmployeeID SERIAL PRIMARY KEY,
    FirstName VARCHAR(255) NOT NULL,
    LastName VARCHAR(255) NOT NULL,
    BornState VARCHAR(255),
    Age INT NOT NULL CHECK (Age > 0),
    Rank INT NOT NULL CHECK (Rank >= 1)
);

CREATE TABLE DepartmentHeads (
    DepartmentID INT REFERENCES Departments(DepartmentID),
    EmployeeID INT REFERENCES Employees(EmployeeID),
    PRIMARY KEY (DepartmentID, EmployeeID)
);

CREATE TABLE EmployeeDepartments (
    EmployeeID INT REFERENCES Employees(EmployeeID),
    DepartmentID INT REFERENCES Departments(DepartmentID),
    PRIMARY KEY (EmployeeID, DepartmentID)
);