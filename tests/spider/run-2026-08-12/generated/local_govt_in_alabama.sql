CREATE TYPE event_type AS ENUM ('Marriage', 'Birthday', 'Funeral');

CREATE TABLE services (
    service_id SERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL
);

CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    event_date DATE NOT NULL,
    event_details TEXT,
    service_id INT REFERENCES services(service_id),
    type_code event_type NOT NULL
);

CREATE TABLE participants (
    participant_id SERIAL PRIMARY KEY,
    participant_name VARCHAR(255) NOT NULL,
    participant_type VARCHAR(50) NOT NULL
);

CREATE TABLE event_participants (
    event_id INT REFERENCES events(event_id),
    participant_id INT REFERENCES participants(participant_id),
    PRIMARY KEY (event_id, participant_id)
);

-- What are the event details of the services that have the type code 'Marriage'?
SELECT e.event_details FROM events e WHERE e.type_code = 'Marriage';

-- What are the ids and details of events that have more than one participants?
SELECT e.event_id, e.event_details FROM events e JOIN event_participants ep ON e.event_id = ep.event_id GROUP BY e.event_id, e.event_details HAVING COUNT(ep.participant_id) > 1;

-- How many events have each participants attended?
SELECT p.participant_id, p.participant_type, COUNT(e.event_id) AS event_count FROM participants p JOIN event_participants ep ON p.participant_id = ep.participant_id JOIN events e ON ep.event_id = e.event_id GROUP BY p.participant_id, p.participant_type;

-- List the participant id, type and the number.
SELECT p.participant_id, p.participant_type, COUNT(e.event_id) AS event_count FROM participants p JOIN event_participants ep ON p.participant_id = ep.participant_id JOIN events e ON ep.event_id = e.event_id GROUP BY p.participant_id, p.participant_type;

-- What are all the participant ids, type code and details?
SELECT p.participant_id, p.participant_type, e.type_code, e.event_details FROM participants p JOIN event_participants ep ON p.participant_id = ep.participant_id JOIN events e ON ep.event_id = e.event_id;

-- How many participants belong to the type 'Organizer'?
SELECT COUNT(participant_id) FROM participants WHERE participant_type = 'Organizer';