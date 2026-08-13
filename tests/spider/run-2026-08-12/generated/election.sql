CREATE TABLE counties (
    county_id SERIAL PRIMARY KEY,
    county_name VARCHAR(100) NOT NULL UNIQUE,
    population INT NOT NULL
);

-- To count the total number of counties
SELECT COUNT(*) FROM counties;

-- To show the county name and population of all counties
SELECT county_name, population FROM counties;

-- To show the average population of all counties
SELECT AVG(population) AS average_population FROM counties;