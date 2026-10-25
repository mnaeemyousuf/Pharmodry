-- GS1 GTIN for serialization readiness (DRAP S.R.O. 963(I)/2026).
ALTER TABLE "products" ADD COLUMN "gtin" TEXT;
CREATE UNIQUE INDEX "products_tenantId_gtin_key" ON "products"("tenantId", "gtin");
