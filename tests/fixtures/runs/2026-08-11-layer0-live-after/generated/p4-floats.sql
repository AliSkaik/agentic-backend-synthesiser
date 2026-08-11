CREATE TYPE device_type AS ENUM ('sensor', 'actuator');

CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    device_type device_type NOT NULL,
    location VARCHAR(255)
);

CREATE TABLE readings_batches (
    batch_id SERIAL PRIMARY KEY,
    batch_timestamp TIMESTAMP NOT NULL
);

CREATE TABLE sensor_readings (
    reading_id SERIAL PRIMARY KEY,
    device_id INT REFERENCES devices(device_id),
    batch_id INT REFERENCES readings_batches(batch_id),
    timestamp TIMESTAMP NOT NULL,
    value FLOAT8 NOT NULL,
    units VARCHAR(50)
);