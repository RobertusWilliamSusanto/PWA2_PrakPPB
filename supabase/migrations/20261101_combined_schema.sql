-- ============================================================================
-- COMBINED SCHEMA MIGRATION: 9 TASKS (GUNSHOP CATALOG & REVIEWS)
-- ============================================================================

-- 1. Ensure extensions for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ALTER TABLE products (Katalog)
-- Add share_token, deleted_at, status, seller_phone, and contact info
DO $$ 
BEGIN
    -- share_token for unique, unguessable public share link
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'share_token'
    ) THEN
        ALTER TABLE products ADD COLUMN share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(9), 'hex');
    END IF;

    -- deleted_at for soft delete / archive
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE products ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    -- status for catalog lifecycle: 'active', 'draft', 'archived'
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'status'
    ) THEN
        ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    -- seller_phone / contact for WhatsApp Seller feature
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'seller_phone'
    ) THEN
        ALTER TABLE products ADD COLUMN seller_phone TEXT DEFAULT '081234567890';
    END IF;

    -- user_id / owner identifier for authorization
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE products ADD COLUMN user_id TEXT DEFAULT NULL;
    END IF;
END $$;

-- Backfill share_token for existing products where share_token IS NULL
UPDATE products 
SET share_token = encode(gen_random_bytes(9), 'hex') 
WHERE share_token IS NULL;

-- 3. CREATE TABLE catalog_images (Multi-gambar)
CREATE TABLE IF NOT EXISTS catalog_images (
    id BIGSERIAL PRIMARY KEY,
    catalog_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill existing single image_url to catalog_images if not already migrated
INSERT INTO catalog_images (catalog_id, url, display_order, is_primary)
SELECT p.id, p.image_url, 0, true
FROM products p
WHERE p.image_url IS NOT NULL 
  AND p.image_url <> ''
  AND NOT EXISTS (
      SELECT 1 FROM catalog_images ci WHERE ci.catalog_id = p.id
  );

-- 4. CREATE TABLE review_votes (Thumbs up/down)
CREATE TABLE IF NOT EXISTS review_votes (
    id BIGSERIAL PRIMARY KEY,
    review_id BIGINT REFERENCES reviews(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    value INT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_review_user_vote UNIQUE (review_id, user_id)
);

-- Ensure reviews table has user_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE reviews ADD COLUMN user_id TEXT DEFAULT NULL;
    END IF;
END $$;

-- 5. INDEXES for performance & N+1 prevention
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_share_token ON products(share_token);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_catalog_images_catalog_id ON catalog_images(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_images_order ON catalog_images(catalog_id, display_order);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_review ON review_votes(user_id, review_id);

-- Down migration hint (Reversible):
-- DROP TABLE IF EXISTS review_votes;
-- DROP TABLE IF EXISTS catalog_images;
-- ALTER TABLE products DROP COLUMN IF EXISTS share_token;
-- ALTER TABLE products DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE products DROP COLUMN IF EXISTS status;
-- ALTER TABLE products DROP COLUMN IF EXISTS seller_phone;
