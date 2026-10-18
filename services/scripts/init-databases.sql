-- One database per service (local development). In AWS give each service its own RDS database
-- or schema and its own least-privilege login.
CREATE DATABASE hfa_auth;
CREATE DATABASE hfa_user;
CREATE DATABASE hfa_pharmacy;
CREATE DATABASE hfa_payment;
CREATE DATABASE hfa_admin;
