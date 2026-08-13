CREATE TABLE AssessmentNotes (
    note_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    content TEXT NOT NULL
);

CREATE TABLE Addresses (
    address_id SERIAL PRIMARY KEY,
    zip_code VARCHAR(5) NOT NULL
);

CREATE TABLE Incidents (
    incident_id SERIAL PRIMARY KEY,
    type_code VARCHAR(10) NOT NULL
);

CREATE TABLE Detentions (
    detention_id SERIAL PRIMARY KEY,
    type_code VARCHAR(10) NOT NULL
);

-- Views to answer specific questions

CREATE VIEW AssessmentNoteCount AS
SELECT COUNT(*) AS total_notes FROM AssessmentNotes;

CREATE VIEW AssessmentNoteDates AS
SELECT DISTINCT date FROM AssessmentNotes;

CREATE VIEW AddressZipCodeCount AS
SELECT COUNT(*) AS address_count FROM Addresses WHERE zip_code = '197';

CREATE VIEW IncidentTypeCodes AS
SELECT DISTINCT type_code FROM Incidents;

CREATE VIEW DistinctDetentionTypeCodes AS
SELECT DISTINCT type_code FROM Detentions;