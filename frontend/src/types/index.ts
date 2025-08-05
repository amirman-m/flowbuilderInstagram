export interface User {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Flow {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  flow_data?: Record<string, any>;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface UserSession {
  user: User;
  session_token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}
