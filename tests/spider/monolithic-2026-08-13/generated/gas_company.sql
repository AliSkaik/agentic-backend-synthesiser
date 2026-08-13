CREATE TABLE gas_companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    headquarters_country VARCHAR(100),
    main_industry VARCHAR(100),
    sales NUMERIC(15, 2)
);