-- 고객 ID와 PIN으로 인증하는 함수 추가
CREATE OR REPLACE FUNCTION authenticate_customer_by_id_and_pin(
  input_customer_id UUID,
  input_pin TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  is_initial_pin BOOLEAN,
  customer_id UUID,
  customer_code TEXT,
  customer_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_record RECORD;
  pin_matches BOOLEAN;
BEGIN
  -- 고객 정보 조회
  SELECT 
    c.id,
    c.customer_code,
    c.name,
    c.pin_hash,
    c.is_initial_pin
  INTO customer_record
  FROM customers c
  WHERE c.id = input_customer_id;

  -- 고객이 존재하지 않는 경우
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- PIN 검증 (해시 비교)
  pin_matches := crypt(input_pin, customer_record.pin_hash) = customer_record.pin_hash;

  -- 결과 반환
  IF pin_matches THEN
    RETURN QUERY SELECT 
      TRUE,
      customer_record.is_initial_pin,
      customer_record.id,
      customer_record.customer_code,
      customer_record.name;
  ELSE
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$;
