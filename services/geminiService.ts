import { GoogleGenAI } from "@google/genai";
import { DailyStat, AnalysisResult } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in process.env");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeSalesData = async (dailyStats: DailyStat[]): Promise<AnalysisResult | null> => {
  const ai = getClient();
  if (!ai) return null;

  // Prepare a lightweight summary of the data for the prompt to save tokens
  const dataSummary = dailyStats.map(d => `${d.date}: ${d.orderCount} đơn, ${d.revenue.toLocaleString('vi-VN')} đ`).join('\n');

  const prompt = `
    Bạn là một chuyên gia phân tích dữ liệu kinh doanh.
    Dưới đây là dữ liệu bán hàng theo ngày (Ngày: Số lượng đơn, Doanh thu):
    ${dataSummary}

    Hãy phân tích dữ liệu này và trả về kết quả dưới định dạng JSON (chỉ JSON thuần túy, không markdown) với các trường sau:
    1. "summary": Tổng quan ngắn gọn về hiệu suất bán hàng.
    2. "trend": Nhận xét về xu hướng tăng/giảm.
    3. "recommendation": Một lời khuyên ngắn để cải thiện doanh số dựa trên dữ liệu.
    
    Hãy trả lời bằng tiếng Việt.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return null;
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return null;
  }
};