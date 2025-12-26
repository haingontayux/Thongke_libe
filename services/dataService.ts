import { Order } from '../types';

// Link Google Sheet Published CSV
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSIGSB-s0s175VQKxGEwebzkcw5dRiRm152QKSXSN4KOymLgYGYCoZCJRwVV_1jVy9gcN2YrHm71bBr/pub?output=csv';

const parseCSVLine = (text: string) => {
  const result = [];
  let curValue = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(curValue);
      curValue = '';
    } else {
      curValue += char;
    }
  }
  result.push(curValue);
  return result.map(v => v.trim().replace(/^"|"$/g, '').trim());
};

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanStr = value.replace(/[^0-9.,]/g, '');
  if (!cleanStr) return 0;

  if (cleanStr.includes('.') && !cleanStr.includes(',')) {
    return parseFloat(cleanStr.replace(/\./g, ''));
  }
  if (cleanStr.includes(',') && !cleanStr.includes('.')) {
    return parseFloat(cleanStr.replace(/,/g, ''));
  }
  
  return parseFloat(cleanStr.replace(/\./g, '').replace(/,/g, '.'));
};

const parseNumber = (value: string): number => {
  if (!value) return 1; // Default to 1 if empty
  const cleanStr = value.replace(/[^0-9]/g, '');
  return parseInt(cleanStr, 10) || 1;
};

const parseDate = (value: string): string => {
  if (!value) return new Date().toISOString();
  
  // Xử lý định dạng VN: DD/MM/YYYY HH:mm:ss hoặc DD/MM/YYYY
  const parts = value.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (parts) {
    const d = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return new Date().toISOString();
};

export const fetchSalesData = async (): Promise<Order[]> => {
  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) {
      throw new Error(`Lỗi kết nối: ${response.status}`);
    }
    const csvText = await response.text();
    
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const dataLines = lines.slice(1);
    
    return dataLines.map((line, index) => {
      const values = parseCSVLine(line);
      const row: any = {};
      
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });

      // Mapping dựa trên tên cột người dùng cung cấp
      const findVal = (keywords: string[]) => {
        const key = headers.find(h => keywords.some(k => h.includes(k)));
        return key ? row[key] : '';
      };

      // Cột: Thời Gian, Tên Khách, Số Đơn, Tổng Tiền, Chi Tiết, Link Facebook
      const dateVal = findVal(['thời gian', 'ngày', 'time', 'date']);
      const nameVal = findVal(['tên khách', 'khách hàng', 'name']);
      const quantityVal = findVal(['số đơn', 'số lượng', 'quantity']);
      const amountVal = findVal(['tổng tiền', 'doanh thu', 'amount', 'thành tiền']);
      const detailVal = findVal(['chi tiết', 'nội dung', 'comment', 'product']);
      const linkVal = findVal(['link facebook', 'facebook', 'fb']);

      return {
        id: `row-${index}`,
        date: parseDate(dateVal),
        amount: parseCurrency(amountVal),
        quantity: parseNumber(quantityVal),
        customerName: nameVal || `Khách ${index + 1}`,
        details: detailVal || '',
        facebookLink: linkVal || '',
        originalData: row
      };
    });

  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
};

export const getMockData = (): Order[] => {
  const today = new Date();
  const data: Order[] = [];
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    const ordersPerDay = Math.floor(Math.random() * 5) + 1;
    
    for (let j = 0; j < ordersPerDay; j++) {
      const amount = Math.floor(Math.random() * 500000) + 100000;
      data.push({
        id: `mock-${i}-${j}`,
        date: date.toISOString(),
        amount: amount,
        quantity: Math.floor(Math.random() * 3) + 1,
        customerName: `Nguyễn Văn ${String.fromCharCode(65 + j)}`,
        details: 'Combo 2 áo thun, size L, màu đen. Giao hàng giờ hành chính.',
        facebookLink: 'https://facebook.com',
        originalData: {}
      });
    }
  }
  return data;
};