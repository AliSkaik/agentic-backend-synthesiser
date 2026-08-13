CREATE TABLE device (
    device_id SERIAL PRIMARY KEY,
    carrier VARCHAR(255) NOT NULL,
    software_platform VARCHAR(255) NOT NULL
);

CREATE OR REPLACE FUNCTION count_devices() RETURNS INTEGER AS $$
BEGIN
    RETURN COUNT(*) FROM device;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION list_carriers_alphabetically() RETURNS SETOF VARCHAR(255) AS $$
BEGIN
    RETURN QUERY SELECT DISTINCT carrier FROM device ORDER BY carrier ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION carriers_without_android() RETURNS SETOF VARCHAR(255) AS $$
BEGIN
    RETURN QUERY SELECT DISTINCT carrier FROM device WHERE software_platform != 'Android' ORDER BY carrier ASC;
END;
$$ LANGUAGE plpgsql;