CREATE TABLE genres (
    genre_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE artists (
    artist_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE albums (
    album_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id INT REFERENCES artists(artist_id),
    genre_id INT REFERENCES genres(genre_id)
);

CREATE TABLE tracks (
    track_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    album_id INT REFERENCES albums(album_id),
    genre_id INT REFERENCES genres(genre_id),
    composer VARCHAR(255),
    milliseconds INT,
    bytes BIGINT,
    unit_price NUMERIC(10, 2)
);

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    address VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(255),
    postal_code VARCHAR(10),
    phone VARCHAR(255),
    fax VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    support_rep_id INT
);

CREATE TABLE invoices (
    invoice_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id),
    invoice_date TIMESTAMP NOT NULL,
    total NUMERIC(10, 2)
);

CREATE TABLE invoice_items (
    invoice_item_id SERIAL PRIMARY KEY,
    invoice_id INT REFERENCES invoices(invoice_id),
    track_id INT REFERENCES tracks(track_id),
    quantity INT
);