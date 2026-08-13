CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    carrier VARCHAR(255) NOT NULL,
    software_platform VARCHAR(255) NOT NULL
);