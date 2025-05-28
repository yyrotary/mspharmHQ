import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getEmployeeByName, getEmployeeById } from './supabase';
import { Employee, AuthUser } from './types';

// Authentication utilities for Employee Purchase System

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = 'employee-auth-token';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// 비밀번호 해싱
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// 비밀번호 검증
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT 토큰 생성
export function generateToken(user: Employee): string {
  const payload: AuthUser = {
    id: user.id,
    name: user.name,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'mspharm-employee-purchase',
  });
}

// JWT 토큰 검증
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// 사용자 인증
export async function authenticateUser(name: string, password: string): Promise<Employee | null> {
  const employee = await getEmployeeByName(name);
  if (!employee) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, employee.password_hash);
  if (!isValidPassword) {
    return null;
  }

  return employee;
}

// 쿠키에서 현재 사용자 정보 가져오기
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const user = verifyToken(token);
    if (!user) {
      return null;
    }

    // 사용자가 여전히 존재하는지 확인
    const employee = await getEmployeeById(user.id);
    if (!employee) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// 요청에서 현재 사용자 정보 가져오기 (API Routes용)
export async function getCurrentUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const user = verifyToken(token);
    if (!user) {
      return null;
    }

    // 사용자가 여전히 존재하는지 확인
    const employee = await getEmployeeById(user.id);
    if (!employee) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user from request:', error);
    return null;
  }
}

// 인증 필수 미들웨어
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

// 권한 확인
export function checkPermission(
  userRole: AuthUser['role'],
  requiredRoles: AuthUser['role'][]
): boolean {
  return requiredRoles.includes(userRole);
}

// 권한 필수 미들웨어
export async function requirePermission(requiredRoles: AuthUser['role'][]): Promise<AuthUser> {
  const user = await requireAuth();
  
  if (!checkPermission(user.role, requiredRoles)) {
    throw new Error('Insufficient permissions');
  }

  return user;
}

// 쿠키 설정 (서버 컴포넌트용)
export function setAuthCookie(token: string): void {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24시간
    path: '/',
  });
}

// 쿠키 삭제 (서버 컴포넌트용)
export function clearAuthCookie(): void {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

// API Response용 쿠키 설정
export function createAuthCookieHeader(token: string): string {
  const maxAge = 24 * 60 * 60; // 24시간
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/${secure}`;
}

// API Response용 쿠키 삭제
export function createClearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`;
}

// 역할별 권한 정의
export const PERMISSIONS = {
  // 모든 직원이 할 수 있는 작업
  CREATE_PURCHASE_REQUEST: ['staff', 'manager', 'owner'],
  VIEW_OWN_REQUESTS: ['staff', 'manager', 'owner'],
  
  // 관리자 이상이 할 수 있는 작업
  APPROVE_STAFF_REQUESTS: ['manager', 'owner'],
  VIEW_ALL_REQUESTS: ['manager', 'owner'],
  
  // 약국장만 할 수 있는 작업
  APPROVE_MANAGER_REQUESTS: ['owner'],
  VIEW_STATISTICS: ['owner'],
  COMPLETE_REQUESTS: ['owner'],
} as const;

// 권한 확인 헬퍼 함수들
export function canCreatePurchaseRequest(role: AuthUser['role']): boolean {
  return checkPermission(role, PERMISSIONS.CREATE_PURCHASE_REQUEST);
}

export function canViewOwnRequests(role: AuthUser['role']): boolean {
  return checkPermission(role, PERMISSIONS.VIEW_OWN_REQUESTS);
}

export function canApproveStaffRequests(role: AuthUser['role']): boolean {
  return checkPermission(role, PERMISSIONS.APPROVE_STAFF_REQUESTS);
}

export function canViewAllRequests(role: AuthUser['role']): boolean {
  return checkPermission(role, PERMISSIONS.VIEW_ALL_REQUESTS);
}

export function canApproveManagerRequests(role: AuthUser['role']): boolean {
  return checkPermission(role, PERMISSIONS.APPROVE_MANAGER_REQUESTS);
}

export function canViewStatistics(role: AuthUser['role']): boolean {
  return checkPermission(role, PERMISSIONS.VIEW_STATISTICS);
}

export function canCompleteRequests(role: AuthUser['role']): boolean {
  return checkPermission(role, PERMISSIONS.COMPLETE_REQUESTS);
}

// 요청에서 사용자 인증 및 검증 (API Routes용)
export async function verifyEmployeeAuth(request: NextRequest): Promise<AuthUser | null> {
  return getCurrentUserFromRequest(request);
}
