-- Small, browser-generated WebP covers. The original file is never stored.
ALTER TABLE songs ADD COLUMN cover_image TEXT DEFAULT NULL CHECK (cover_image IS NULL OR (length(cover_image)<=43715 AND substr(cover_image,1,23)='data:image/webp;base64,'));
