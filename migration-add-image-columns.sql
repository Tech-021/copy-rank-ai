-- ============================================
-- Migration: Add generate_images and image_count columns to article_jobs
-- ============================================
-- Run this SQL in your Supabase SQL Editor to add the missing columns
-- This migration adds support for image generation settings in article jobs

-- Add generate_images column (defaults to true for backward compatibility)
ALTER TABLE article_jobs 
ADD COLUMN IF NOT EXISTS generate_images BOOLEAN DEFAULT true;

-- Add image_count column (defaults to 2 for backward compatibility)
ALTER TABLE article_jobs 
ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 2;

-- Update existing rows to have default values (in case any exist)
UPDATE article_jobs 
SET generate_images = true 
WHERE generate_images IS NULL;

UPDATE article_jobs 
SET image_count = 2 
WHERE image_count IS NULL;

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'article_jobs' 
AND column_name IN ('generate_images', 'image_count');

