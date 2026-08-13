CREATE TYPE policy_type AS ENUM ('Health', 'Life', 'Auto');

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE policies (
    policy_id SERIAL PRIMARY KEY,
    policy_type_code policy_type NOT NULL,
    customer_id INT REFERENCES customers(customer_id)
);

CREATE OR REPLACE FUNCTION get_customer_policies(customer_name TEXT)
RETURNS SETOF policy_type AS $$
DECLARE
    first_name TEXT;
    last_name TEXT;
BEGIN
    SELECT first_name, last_name INTO first_name, last_name FROM customers WHERE first_name || ' ' || last_name = customer_name;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    RETURN QUERY
    SELECT policy_type_code FROM policies JOIN customers ON policies.customer_id = customers.customer_id WHERE first_name = customer_name AND last_name = last_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION most_frequent_policy()
RETURNS policy_type AS $$
DECLARE
    policy_count INT;
BEGIN
    FOR policy_type_code IN SELECT DISTINCT policy_type_code FROM policies LOOP
        EXECUTE format('SELECT COUNT(*) INTO policy_count FROM policies WHERE policy_type_code = %L', policy_type_code);
        IF policy_count > 1 THEN
            RETURN policy_type_code;
        END IF;
    END LOOP;

    RAISE EXCEPTION 'No frequent policy found';
END;
$$ LANGUAGE plpgsql;