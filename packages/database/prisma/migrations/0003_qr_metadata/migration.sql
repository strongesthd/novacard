-- Add QR metadata for installations that already applied migration 0002.
ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "scanCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "lastScannedAt" TIMESTAMP(3);
