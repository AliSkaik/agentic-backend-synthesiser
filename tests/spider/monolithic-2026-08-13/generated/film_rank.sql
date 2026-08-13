CREATE TABLE films (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    director VARCHAR(100),
    ticket_sales_gross NUMERIC(15, 2)
);