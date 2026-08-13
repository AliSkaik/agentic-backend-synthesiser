CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    item_id INT REFERENCES items(item_id),
    user_id INT REFERENCES users(user_id),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT
);

-- Indexes for faster querying
CREATE INDEX idx_item_title ON items(title);
CREATE INDEX idx_review_item ON reviews(item_id);
CREATE INDEX idx_review_user ON reviews(user_id);