CREATE TABLE Accounts (
    AccountID SERIAL PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    Details TEXT
);

CREATE TABLE Statements (
    StatementID SERIAL PRIMARY KEY,
    AccountID INT REFERENCES Accounts(AccountID),
    Date DATE NOT NULL,
    Amount NUMERIC(10, 2) NOT NULL
);