-- Employee Purchase System Database Schema for Supabase (Safe Version - No DROP)
-- Version: 1.0.0
-- Date: 2025-05-27
-- 
-- 주의: 이 버전은 DROP TABLE 명령어가 제거되어 있습니다.
-- 기존 테이블이 있으면 오류가 발생할 수 있습니다.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('staff', 'manager', 'owner')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for employees
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- Create purchase_requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
  image_urls TEXT[] NOT NULL,
  request_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES employees(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for purchase_requests
CREATE INDEX IF NOT EXISTS idx_purchase_requests_employee_id ON purchase_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_request_date ON purchase_requests(request_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_approved_by ON purchase_requests(approved_by);

-- Create purchase_items table (for future use)
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  item_name VARCHAR(255),
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) CHECK (unit_price >= 0),
  subtotal DECIMAL(10, 2) CHECK (subtotal >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for purchase_items
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_request_id ON purchase_items(purchase_request_id);

-- Create purchase_logs table
CREATE TABLE IF NOT EXISTS purchase_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id),
  action VARCHAR(50) NOT NULL,
  performed_by UUID NOT NULL REFERENCES employees(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

-- Create indexes for purchase_logs
CREATE INDEX IF NOT EXISTS idx_purchase_logs_purchase_request_id ON purchase_logs(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_performed_by ON purchase_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_performed_at ON purchase_logs(performed_at DESC);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (DROP and CREATE to ensure they work)
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_requests_updated_at ON purchase_requests;
CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS를 사용하지 않음 - API 레벨에서 권한 검증
-- 모든 테이블 접근은 Service Role Key를 통해 이루어지며,
-- Next.js API Routes에서 사용자 권한을 검증합니다.

-- Note: Supabase 대시보드에서 다음을 확인하세요:
-- 1. Authentication > Policies 에서 RLS가 비활성화되어 있는지 확인
-- 2. 필요한 경우 다음 명령을 실행하여 RLS 비활성화:
-- ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_logs DISABLE ROW LEVEL SECURITY;

-- Create views for easier querying
CREATE OR REPLACE VIEW purchase_requests_with_employees AS
SELECT 
    pr.*,
    e.name as employee_name,
    e.role as employee_role,
    approver.name as approved_by_name,
    completer.name as completed_by_name
FROM purchase_requests pr
JOIN employees e ON pr.employee_id = e.id
LEFT JOIN employees approver ON pr.approved_by = approver.id
LEFT JOIN employees completer ON pr.completed_by = completer.id;

-- Create materialized view for statistics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS purchase_statistics AS
SELECT 
    DATE_TRUNC('day', request_date) as date,
    COUNT(*) as total_requests,
    SUM(total_amount) as total_amount,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count
FROM purchase_requests
GROUP BY DATE_TRUNC('day', request_date);

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_purchase_statistics_date ON purchase_statistics(date DESC);

-- Function to handle purchase approval workflow
CREATE OR REPLACE FUNCTION approve_purchase_request(
    request_id UUID,
    approver_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    request_employee_id UUID;
    approver_role VARCHAR(20);
    request_status VARCHAR(20);
BEGIN
    -- Get request details
    SELECT employee_id, status INTO request_employee_id, request_status
    FROM purchase_requests
    WHERE id = request_id;
    
    -- Check if request exists and is pending
    IF request_status != 'pending' THEN
        RAISE EXCEPTION 'Request is not in pending status';
    END IF;
    
    -- Get approver role
    SELECT role INTO approver_role
    FROM employees
    WHERE id = approver_id AND is_active = true;
    
    -- Check approval rules
    IF request_employee_id = approver_id THEN
        RAISE EXCEPTION 'Cannot approve own request';
    END IF;
    
    -- If requester is a manager, only owner can approve
    IF EXISTS (
        SELECT 1 FROM employees 
        WHERE id = request_employee_id 
        AND role = 'manager'
    ) AND approver_role != 'owner' THEN
        RAISE EXCEPTION 'Only owner can approve manager requests';
    END IF;
    
    -- Update the request
    UPDATE purchase_requests
    SET status = 'approved',
        approved_by = approver_id,
        approved_at = CURRENT_TIMESTAMP
    WHERE id = request_id;
    
    -- Log the action
    INSERT INTO purchase_logs (purchase_request_id, action, performed_by, details)
    VALUES (request_id, 'approved', approver_id, 
        jsonb_build_object('previous_status', 'pending', 'new_status', 'approved'));
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to complete purchase request
CREATE OR REPLACE FUNCTION complete_purchase_request(
    request_id UUID,
    completer_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    request_status VARCHAR(20);
    approver_id_val UUID;
BEGIN
    -- Get request details
    SELECT status, approved_by INTO request_status, approver_id_val
    FROM purchase_requests
    WHERE id = request_id;
    
    -- Check if request is approved
    IF request_status != 'approved' THEN
        RAISE EXCEPTION 'Request must be approved before completion';
    END IF;
    
    -- Check if completer is the approver
    IF approver_id_val != completer_id THEN
        RAISE EXCEPTION 'Only the approver can complete the request';
    END IF;
    
    -- Update the request
    UPDATE purchase_requests
    SET status = 'completed',
        completed_by = completer_id,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = request_id;
    
    -- Log the action
    INSERT INTO purchase_logs (purchase_request_id, action, performed_by, details)
    VALUES (request_id, 'completed', completer_id, 
        jsonb_build_object('previous_status', 'approved', 'new_status', 'completed'));
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Initial data insertion (with bcrypt hashed passwords)
-- Note: 실제 비밀번호 해시를 생성하여 아래 값을 교체하세요!
-- 
-- Node.js에서 해시 생성 방법:
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('admin123', 10);
-- console.log(hash);

-- 예시 (실제 해시로 교체 필요):
-- INSERT INTO employees (name, password_hash, role) VALUES
--     ('약국장', '$2b$10$실제해시값', 'owner'),
--     ('김관리자', '$2b$10$실제해시값', 'manager'),
--     ('이직원', '$2b$10$실제해시값', 'staff'),
--     ('박직원', '$2b$10$실제해시값', 'staff')
-- ON CONFLICT (name) DO NOTHING;

-- Create storage bucket for images (run in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('employee-purchases', 'employee-purchases', false)
-- ON CONFLICT (id) DO NOTHING;

-- 참고: Storage 정책은 RLS를 사용하지 않으므로 설정하지 않습니다.
-- 모든 파일 접근은 Service Role Key를 통해서만 가능합니다.

-- Useful queries for monitoring
-- Daily purchase summary
-- SELECT 
--     DATE(request_date) as date,
--     COUNT(*) as total_requests,
--     SUM(total_amount) as total_amount,
--     COUNT(DISTINCT employee_id) as unique_employees
-- FROM purchase_requests
-- WHERE request_date >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY DATE(request_date)
-- ORDER BY date DESC;

-- Employee purchase summary
-- SELECT 
--     e.name,
--     e.role,
--     COUNT(pr.id) as total_requests,
--     SUM(pr.total_amount) as total_spent,
--     AVG(pr.total_amount) as avg_purchase
-- FROM employees e
-- LEFT JOIN purchase_requests pr ON e.id = pr.employee_id
-- WHERE pr.status = 'completed'
-- GROUP BY e.id, e.name, e.role
-- ORDER BY total_spent DESC;
