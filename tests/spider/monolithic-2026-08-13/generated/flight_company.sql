CREATE TABLE airports (
    id SERIAL PRIMARY KEY,
    country VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE vehicles (
    flight_number VARCHAR(10) PRIMARY KEY,
    velocity INT NOT NULL,
    altitude INT NOT NULL,
    pilot_id INT,
    airport_id INT,
    FOREIGN KEY (pilot_id) REFERENCES pilots(id),
    FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE pilots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);