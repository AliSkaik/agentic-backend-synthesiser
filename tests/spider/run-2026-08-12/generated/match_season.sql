CREATE TABLE Country (
    country_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    capital VARCHAR(100) NOT NULL
);

CREATE TABLE Language (
    language_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE CountryLanguage (
    country_id INT REFERENCES Country(country_id),
    language_id INT REFERENCES Language(language_id),
    is_official BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_CountryLanguage PRIMARY KEY (country_id, language_id)
);

-- Queries based on the requirements

-- How many countries are there in total?
SELECT COUNT(*) FROM Country;

-- Show the country name and capital of all countries.
SELECT name, capital FROM Country;

-- What are the names and capitals of each country?
SELECT name, capital FROM Country;

-- Show all official native languages that contain the word "English".
SELECT l.name
FROM Language l
JOIN CountryLanguage cl ON l.language_id = cl.language_id
WHERE cl.is_official AND l.name LIKE '%English%';