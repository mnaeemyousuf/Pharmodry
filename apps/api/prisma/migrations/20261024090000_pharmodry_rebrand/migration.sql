-- Pharmodry rebrand: rename the append-only guard function. Existing triggers reference the function by OID,
-- so they keep enforcing immutability without being recreated. No data is changed.
ALTER FUNCTION pharma360_reject_mutation() RENAME TO pharmodry_reject_mutation;
