-- Compliance controls enforced by the database, independent of application code.

-- 1. Append-only tables: reject UPDATE / DELETE / TRUNCATE.
CREATE OR REPLACE FUNCTION pharma360_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only (regulated record): % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_events','electronic_signatures','inventory_transactions','master_data_versions','batch_step_corrections']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pharma360_reject_mutation()', t || '_immutable_row', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION pharma360_reject_mutation()', t || '_immutable_truncate', t);
  END LOOP;
END $$;

-- 2. Inventory integrity.
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_reserved_within_quantity" CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "quantity");
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_ref" CHECK (
  ("itemType" = 'MATERIAL' AND "materialId" IS NOT NULL) OR ("itemType" = 'PRODUCT' AND "productId" IS NOT NULL)
);

-- 3. Released batches must carry a QA decision.
ALTER TABLE "batches" ADD CONSTRAINT "batches_release_requires_qa" CHECK (
  "status" NOT IN ('RELEASED','REJECTED') OR ("qaDecisionById" IS NOT NULL AND "qaDecisionAt" IS NOT NULL)
);

-- 4. Released material lots must carry a disposition.
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_release_requires_disposition" CHECK (
  "status" <> 'RELEASED' OR "dispositionById" IS NOT NULL
);

-- 5. Trigram search support for global search & similar-case lookup.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "deviations_title_trgm" ON "deviations" USING gin ("title" gin_trgm_ops);
