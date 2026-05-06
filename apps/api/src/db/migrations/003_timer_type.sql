ALTER TABLE media_items DROP CONSTRAINT IF EXISTS media_items_type_check;
ALTER TABLE media_items ADD CONSTRAINT media_items_type_check CHECK (type IN ('image','video','pptx','url','pdf','timer'));
