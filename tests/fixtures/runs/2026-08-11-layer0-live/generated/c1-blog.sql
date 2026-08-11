CREATE TYPE tag_name AS VARCHAR(255);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    user_id INT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name tag_name NOT NULL UNIQUE
);

CREATE TABLE post_tags (
    post_id INT NOT NULL REFERENCES posts(post_id),
    tag_id INT NOT NULL REFERENCES tags(tag_id),
    PRIMARY KEY (post_id, tag_id)
);