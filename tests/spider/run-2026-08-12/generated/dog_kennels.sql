CREATE TYPE gender AS ENUM ('Male', 'Female');

CREATE TABLE states (
    state_id SERIAL PRIMARY KEY,
    state_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE owners (
    owner_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    cell_phone VARCHAR(20),
    state_id INT REFERENCES states(state_id)
);

CREATE TABLE professionals (
    professional_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    cell_phone VARCHAR(20),
    state_id INT REFERENCES states(state_id)
);

CREATE TABLE dogs (
    dog_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    gender gender NOT NULL
);

CREATE TABLE treatments (
    treatment_id SERIAL PRIMARY KEY,
    professional_id INT REFERENCES professionals(professional_id),
    dog_id INT REFERENCES dogs(dog_id)
);

CREATE TABLE states_professionals (
    state_id INT REFERENCES states(state_id),
    professional_id INT REFERENCES professionals(professional_id),
    PRIMARY KEY (state_id, professional_id)
);

-- Which states have both owners and professionals living there?
SELECT s.state_name
FROM states s
JOIN owners o ON s.state_id = o.state_id
JOIN states_professionals sp ON s.state_id = sp.state_id
GROUP BY s.state_id, s.state_name
HAVING COUNT(o.owner_id) > 0 AND COUNT(sp.professional_id) > 0;

-- Find the states where both owners and professionals live.
SELECT s.state_name
FROM states s
JOIN owners o ON s.state_id = o.state_id
JOIN states_professionals sp ON s.state_id = sp.state_id
GROUP BY s.state_id, s.state_name
HAVING COUNT(o.owner_id) > 0 AND COUNT(sp.professional_id) > 0;

-- What is the average age of the dogs who have gone through any treatments?
SELECT AVG(d.age)
FROM dogs d
JOIN treatments t ON d.dog_id = t.dog_id;

-- Find the average age of the dogs who went through treatments.
SELECT AVG(d.age)
FROM dogs d
JOIN treatments t ON d.dog_id = t.dog_id;

-- Which professionals live in the state of Indiana or have done treatment on more than 2 treatments?
SELECT p.professional_id, p.last_name, p.cell_phone
FROM professionals p
WHERE p.state_id IN (
    SELECT s.state_id
    FROM states s
    WHERE s.state_name = 'Indiana'
)
OR (
    SELECT COUNT(t.treatment_id)
    FROM treatments t
    WHERE t.professional_id = p.professional_id
) > 2;