CREATE TABLE People (
    person_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL
);

CREATE TABLE Venues (
    venue_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE Debates (
    debate_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    audience_count INT NOT NULL,
    venue_id INT REFERENCES Venues(venue_id)
);

CREATE TABLE PeopleDebates (
    person_id INT REFERENCES People(person_id),
    debate_id INT REFERENCES Debates(debate_id),
    PRIMARY KEY (person_id, debate_id)
);