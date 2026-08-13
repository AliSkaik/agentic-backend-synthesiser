CREATE TABLE CameraLens (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    focal_length_mm DECIMAL(5, 2) NOT NULL,
    max_aperture DECIMAL(3, 2) NOT NULL
);

CREATE TABLE Photo (
    id SERIAL PRIMARY KEY,
    camera_lens_id INT REFERENCES CameraLens(id),
    color_scheme VARCHAR(100),
    name VARCHAR(255)
);

CREATE TABLE Mountain (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    height_meters DECIMAL(8, 2) NOT NULL,
    prominence DECIMAL(8, 2) NOT NULL,
    country VARCHAR(100)
);

-- Indexes for faster querying
CREATE INDEX idx_camera_lens_focal_length ON CameraLens(focal_length_mm);
CREATE INDEX idx_photo_camera_lens_id ON Photo(camera_lens_id);
CREATE INDEX idx_mountain_height_prominence_country ON Mountain(height_meters, prominence, country);

-- Example queries based on the requirements

-- How many camera lenses have a focal length longer than 15 mm?
SELECT COUNT(*) FROM CameraLens WHERE focal_length_mm > 15;

-- Find the brand and name for each camera lens, and sort in descending order of maximum aperture
SELECT brand, model FROM CameraLens ORDER BY max_aperture DESC;

-- List the id, color scheme, and name for all the photos
SELECT id, color_scheme, name FROM Photo;

-- What are the maximum and average height of the mountains?
SELECT MAX(height_meters), AVG(height_meters) FROM Mountain;

-- What are the average prominence of the mountains in country 'Morocco'?
SELECT AVG(prominence) FROM Mountain WHERE country = 'Morocco';