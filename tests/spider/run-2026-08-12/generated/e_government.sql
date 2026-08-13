CREATE TYPE gender AS ENUM ('Male', 'Female', 'Other');

CREATE TABLE individuals (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE,
    gender gender,
    UNIQUE (first_name, middle_name, last_name)
);

CREATE TABLE forms (
    id SERIAL PRIMARY KEY,
    form_type VARCHAR(100) NOT NULL
);

CREATE TABLE party_forms (
    id SERIAL PRIMARY KEY,
    form_id INT REFERENCES forms(id),
    party_name VARCHAR(100) NOT NULL,
    UNIQUE (form_id, party_name)
);

CREATE TABLE individual_form_submissions (
    id SERIAL PRIMARY KEY,
    individual_id INT REFERENCES individuals(id),
    form_id INT REFERENCES forms(id),
    submission_date DATE NOT NULL
);

-- View to list every individual's first name, middle name and last name in alphabetical order by last name
CREATE VIEW sorted_individuals AS
SELECT first_name, middle_name, last_name FROM individuals ORDER BY last_name;

-- View to find the name of the most popular party form
CREATE VIEW most_popular_party_form AS
SELECT p.party_name
FROM party_forms p
JOIN individual_form_submissions ifs ON p.form_id = ifs.form_id
GROUP BY p.party_name
ORDER BY COUNT(*) DESC
LIMIT 1;