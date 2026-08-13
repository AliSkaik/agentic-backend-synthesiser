CREATE TABLE Films (
    FilmID SERIAL PRIMARY KEY,
    Title VARCHAR(255) NOT NULL,
    Director VARCHAR(100),
    TicketSalesGross DECIMAL(15, 2)
);

-- To count the number of films
SELECT COUNT(*) FROM Films;

-- To list distinct directors of all films
SELECT DISTINCT Director FROM Films;

-- To find the average ticket sales gross in dollars of films
SELECT AVG(TicketSalesGross) AS AverageTicketSalesGross FROM Films;