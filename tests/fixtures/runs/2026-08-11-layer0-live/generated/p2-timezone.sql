CREATE TYPE timezone_offset AS (
    hours INT,
    minutes INT
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_instant TIMESTAMP WITH TIME ZONE NOT NULL,
    end_instant TIMESTAMP WITH TIME ZONE NOT NULL,
    time_zone_offset timezone_offset NOT NULL
);