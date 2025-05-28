// TypeScript type definitions for Employee Purchase System

export type EmployeeRole = 'staff' | 'manager' | 'owner';
export type PurchaseStatus = 'pending' | 'approved' | 'completed' | 'cancelled';

export interface Employee {
  id: string;
  name: string;
  password_hash: string;
  role: EmployeeRole;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequest {
  id: string;
  employee_id: string;
  total_amount: number;
  image_urls: string[];
  notes?: string;
  status: 'pending' | 'approved_by_manager' | 'approved_by_owner' | 'completed' | 'rejected';
  approved_by_manager_id?: string;
  approved_by_manager_at?: string;
  approved_by_owner_id?: string;
  approved_by_owner_at?: string;
  completed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestWithEmployee extends PurchaseRequest {
  employee: Pick<Employee, 'id' | 'name' | 'role'>;
  approved_by_manager?: Pick<Employee, 'id' | 'name'>;
  approved_by_owner?: Pick<Employee, 'id' | 'name'>;
}

export interface PurchaseItem {
  id: string;
  purchase_request_id: string;
  item_name?: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
  created_at: string;
}

export interface PurchaseLog {
  id: string;
  purchase_request_id: string;
  action: string;
  performed_by: string;
  performed_at: string;
  details?: Record<string, any>;
}

export interface LoginCredentials {
  name: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role: EmployeeRole;
}

export interface PurchaseStatistics {
  date: string;
  total_requests: number;
  total_amount: number;
  pending_count: number;
  approved_count: number;
  completed_count: number;
  cancelled_count: number;
}

export interface EmployeeStatistics {
  employee_id: string;
  employee_name: string;
  employee_role: EmployeeRole;
  total_requests: number;
  total_amount: number;
  avg_purchase_amount: number;
}

export interface CreatePurchaseRequestData {
  totalAmount: number;
  imageUrls: string[];
export interface CreatePurchaseRequestInput {
  total_amount: number;
  image_urls: string[];
  notes?: string;
}

export interface PurchaseRequestFilters {
  status?: PurchaseStatus;
  employee_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  total_pages: number;
  limit: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UploadedFile {
  url: string;
  path: string;
  size: number;
}

// Database table types for Supabase
export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          name: string;
          password_hash: string;
          role: EmployeeRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          password_hash: string;
          role: EmployeeRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          password_hash?: string;
          role?: EmployeeRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_requests: {
        Row: {
          id: string;
          employee_id: string;
          total_amount: number;
          status: PurchaseStatus;
          image_urls: string[];
          request_date: string;
          approved_by: string | null;
          approved_at: string | null;
          completed_by: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          total_amount: number;
          status?: PurchaseStatus;
          image_urls: string[];
          request_date?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          completed_by?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          total_amount?: number;
          status?: PurchaseStatus;
          image_urls?: string[];
          request_date?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          completed_by?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_logs: {
        Row: {
          id: string;
          purchase_request_id: string;
          action: string;
          performed_by: string;
          performed_at: string;
          details: Record<string, any> | null;
        };
        Insert: {
          id?: string;
          purchase_request_id: string;
          action: string;
          performed_by: string;
          performed_at?: string;
          details?: Record<string, any> | null;
        };
        Update: {
          id?: string;
          purchase_request_id?: string;
          action?: string;
          performed_by?: string;
          performed_at?: string;
          details?: Record<string, any> | null;
        };
      };
    };
    Views: {
      purchase_requests_with_employees: {
        Row: PurchaseRequest;
      };
      purchase_statistics: {
        Row: PurchaseStatistics;
      };
    };
    Functions: {
      approve_purchase_request: {
        Args: {
          request_id: string;
          approver_id: string;
        };
        Returns: boolean;
      };
      complete_purchase_request: {
        Args: {
          request_id: string;
          completer_id: string;
        };
        Returns: boolean;
      };
    };
  };
}
