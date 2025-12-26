// Data types for the raw response from App Script
export interface RawOrderItem {
  [key: string]: any;
}

// Normalized data structure for the app
export interface Order {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  amount: number; // Tổng Tiền
  quantity: number; // Số Đơn
  customerName: string; // Tên Khách
  details: string; // Chi Tiết (Nội dung cmt/đơn hàng)
  facebookLink: string; // Link Facebook
  originalData: RawOrderItem;
  subOrders?: Order[]; // Danh sách đơn hàng con khi gộp
}

export interface DailyStat {
  date: string;
  orderCount: number;
  revenue: number;
}

export interface CustomerStat {
  name: string;
  totalOrders: number; // Tổng số đơn đã gộp
  totalRevenue: number;
  lastOrderDate: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  summary: string;
  trend: string;
  recommendation: string;
}