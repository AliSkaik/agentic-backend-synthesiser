CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE furniture (
    id SERIAL PRIMARY KEY,
    manufacturer_id INT REFERENCES manufacturers(id),
    name VARCHAR(255) NOT NULL,
    market_rate DECIMAL(10, 2) NOT NULL,
    component_amount INT NOT NULL
);

-- View to count total furniture components
CREATE VIEW total_components AS
SELECT SUM(component_amount) AS total FROM furniture;

-- Function to find the furniture with the highest market rate
CREATE OR REPLACE FUNCTION get_highest_market_rate_furniture()
RETURNS TABLE(name VARCHAR(255), id INT) AS $$
BEGIN
    RETURN QUERY SELECT name, id FROM furniture ORDER BY market_rate DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find the total market rate of top 2 market share furnitures
CREATE OR REPLACE FUNCTION get_top_2_market_share_total()
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN (SELECT SUM(market_rate) FROM furniture ORDER BY market_rate DESC LIMIT 2);
END;
$$ LANGUAGE plpgsql;

-- View to find all furnitures with more than 10 components
CREATE VIEW furniture_with_more_than_10_components AS
SELECT name, component_amount FROM furniture WHERE component_amount > 10;

-- Function to find the least popular furniture
CREATE OR REPLACE FUNCTION get_least_popular_furniture()
RETURNS TABLE(name VARCHAR(255), component_amount INT) AS $$
BEGIN
    RETURN QUERY SELECT name, component_amount FROM furniture ORDER BY component_amount ASC LIMIT 1;
END;
$$ LANGUAGE plpgsql;