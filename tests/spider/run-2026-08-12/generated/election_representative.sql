CREATE TABLE elections (
    election_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    vote_percent NUMERIC(5, 2) NOT NULL
);

CREATE TABLE representatives (
    representative_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    party VARCHAR(100) NOT NULL
);

CREATE TABLE election_representatives (
    election_id INT REFERENCES elections(election_id),
    representative_id INT REFERENCES representatives(representative_id),
    PRIMARY KEY (election_id, representative_id)
);

-- How many elections are there?
SELECT COUNT(*) FROM elections;

-- List the votes of elections in descending order.
SELECT vote_percent FROM elections ORDER BY vote_percent DESC;

-- List the dates and vote percents of elections.
SELECT date, vote_percent FROM elections;

-- What are the minimum and maximum vote percents of elections?
SELECT MIN(vote_percent), MAX(vote_percent) FROM elections;

-- What are the names and parties of representatives?
SELECT name, party FROM representatives;