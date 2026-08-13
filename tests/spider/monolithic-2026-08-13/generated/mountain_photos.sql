CREATE TABLE camera_lenses (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    focal_length_mm DECIMAL(10, 2) NOT NULL,
    max_aperture DECIMAL(3, 2) NOT NULL
);

CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    mountain_id INT NOT NULL,
    color_scheme VARCHAR(255),
    name VARCHAR(255)
);

CREATE TABLE mountains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    height_meters DECIMAL(10, 2) NOT NULL,
    prominence DECIMAL(10, 2) NOT NULL,
    country VARCHAR(255) NOT NULL
);