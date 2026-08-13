CREATE TABLE poll_resource (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE candidate (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    poll_resource_id INT REFERENCES poll_resource(id)
);

CREATE TABLE support_rate (
    id SERIAL PRIMARY KEY,
    candidate_id INT REFERENCES candidate(id),
    rate DECIMAL(5, 2) CHECK (rate BETWEEN 0 AND 100),
    date DATE
);

-- View to count the number of candidates
CREATE VIEW candidate_count AS
SELECT COUNT(*) AS total_candidates FROM candidate;

-- View to find the poll resource with the most candidates
CREATE VIEW most_candidate_poll_resource AS
SELECT pr.id, pr.name, COUNT(c.id) AS candidate_count
FROM poll_resource pr
JOIN candidate c ON pr.id = c.poll_resource_id
GROUP BY pr.id, pr.name
ORDER BY candidate_count DESC
LIMIT 1;

-- View to find the top 3 highest support rates
CREATE VIEW top_support_rates AS
SELECT sr.candidate_id, sr.rate, sr.date
FROM support_rate sr
ORDER BY sr.rate DESC
LIMIT 3;