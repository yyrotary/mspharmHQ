-- Fix for purchase_requests status column to include 'rejected'
-- This script adds 'rejected' status to the existing CHECK constraint

-- Drop the existing constraint
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_status_check;

-- Add the new constraint with 'rejected' included
ALTER TABLE purchase_requests ADD CONSTRAINT purchase_requests_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled'));

-- Update the materialized view to include rejected count
DROP MATERIALIZED VIEW IF EXISTS purchase_statistics;

CREATE MATERIALIZED VIEW purchase_statistics AS
SELECT 
    DATE_TRUNC('day', request_date) as date,
    COUNT(*) as total_requests,
    SUM(total_amount) as total_amount,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count
FROM purchase_requests
GROUP BY DATE_TRUNC('day', request_date);

-- Create index on materialized view
CREATE INDEX idx_purchase_statistics_date ON purchase_statistics(date DESC); 