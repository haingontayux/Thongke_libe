import React, { useEffect, useState, useMemo, useRef } from 'react';
import { fetchSalesData, getMockData } from './services/dataService';
import { Order, DailyStat, LoadingState } from './types';
import { StatsCard } from './components/StatsCard';
import { RevenueChart } from './components/Charts';
import { 
  LayoutDashboard, TrendingUp, ShoppingBag, DollarSign, RefreshCw, 
  AlertCircle, User, FileText, Facebook, 
  Calendar, X, Clock
} from 'lucide-react';

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('thisMonth');
  
  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Helper to format YYYY-MM-DD
  const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
  };

  const applyDateFilter = (type: string) => {
    setActiveFilter(type);
    const today = new Date();

    if (type === 'today') {
        const str = fmt(today);
        setStartDate(str);
        setEndDate(str);
    } else if (type === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const str = fmt(yesterday);
        setStartDate(str);
        setEndDate(str);
    } else if (type === 'thisMonth') {
         const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
         setStartDate(fmt(firstDay));
         setEndDate(fmt(today));
    } else if (type === 'all') {
        setStartDate('');
        setEndDate('');
    }
  };

  const handleManualDateChange = (start: string, end: string) => {
      setStartDate(start);
      setEndDate(end);
      setActiveFilter('custom');
  };

  const loadData = async (isAutoRefresh = false) => {
    // Only show loading spinner on full screen if it's not an auto-refresh
    if (!isAutoRefresh) {
        setLoadingState(LoadingState.LOADING);
    }
    
    setErrorMsg('');
    setIsUsingMock(false);
    try {
      const data = await fetchSalesData();
      if (data.length === 0) {
          setErrorMsg('Không tìm thấy dữ liệu nào trong Sheet (File có thể đang trống).');
          setLoadingState(LoadingState.ERROR);
      } else {
          setOrders(data);
          setLastUpdated(new Date());
          setLoadingState(LoadingState.SUCCESS);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Lỗi không xác định khi tải dữ liệu.');
      setLoadingState(LoadingState.ERROR);
    }
  };

  const loadMockData = () => {
    setOrders(getMockData());
    setIsUsingMock(true);
    setLoadingState(LoadingState.SUCCESS);
    setErrorMsg('');
    applyDateFilter('thisMonth');
  };

  // Initial Load and Auto-Refresh Interval
  useEffect(() => {
    // 1. Set default filter immediately
    applyDateFilter('thisMonth');
    
    // 2. Initial Data Load
    loadData();

    // 3. Setup 5-minute auto-refresh interval (300,000 ms)
    const intervalId = setInterval(() => {
        console.log("Auto-refreshing data...");
        loadData(true); // true = silent refresh (keep UI interactive)
    }, 5 * 60 * 1000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []);

  // --- Filtering Logic ---
  const filteredOrders = useMemo(() => {
    if (!startDate && !endDate) return orders;
    
    const start = startDate ? new Date(startDate).setHours(0,0,0,0) : 0;
    const end = endDate ? new Date(endDate).setHours(23,59,59,999) : Number.MAX_VALUE;

    return orders.filter(order => {
      const orderDate = new Date(order.date).getTime();
      return orderDate >= start && orderDate <= end;
    });
  }, [orders, startDate, endDate]);

  // --- Grouping Logic (Group by Customer) ---
  const groupedOrders = useMemo(() => {
    const groups: { [key: string]: Order } = {};
    
    const sortedRaw = [...filteredOrders].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedRaw.forEach(order => {
      const key = order.customerName.trim().toLowerCase();
      
      if (!groups[key]) {
        groups[key] = { 
            ...order, 
            subOrders: [order],
            details: order.details ? `- ${order.details}` : ''
        };
      } else {
        const group = groups[key];
        group.amount += order.amount;
        group.quantity += order.quantity;
        group.date = order.date;
        group.customerName = order.customerName;
        
        if (order.details) {
            group.details = group.details 
                ? `${group.details}\n- ${order.details}` 
                : `- ${order.details}`;
        }
        
        if (!group.facebookLink && order.facebookLink) {
            group.facebookLink = order.facebookLink;
        }

        if (group.subOrders) {
            group.subOrders.push(order);
        }
      }
    });

    return Object.values(groups).sort((a, b) => b.amount - a.amount);
  }, [filteredOrders]);


  // --- Aggregation Logic (Daily - Raw Data) ---
  const dailyStats = useMemo(() => {
    const statsMap = new Map<string, DailyStat>();

    filteredOrders.forEach(order => {
      const dateKey = order.date.split('T')[0];
      const current = statsMap.get(dateKey) || {
        date: dateKey,
        orderCount: 0,
        revenue: 0
      };

      current.orderCount += order.quantity; 
      current.revenue += order.amount;
      statsMap.set(dateKey, current);
    });

    return Array.from(statsMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredOrders]);

  // --- Aggregation Logic (Customers - Raw Data) ---
  const topCustomers = useMemo(() => {
    return groupedOrders.slice(0, 5).map(g => ({
        name: g.customerName,
        totalOrders: g.quantity,
        totalRevenue: g.amount,
        lastOrderDate: g.date
    }));
  }, [groupedOrders]);

  // Derived totals
  const totalRevenue = useMemo(() => dailyStats.reduce((sum, day) => sum + day.revenue, 0), [dailyStats]);
  const totalOrders = useMemo(() => dailyStats.reduce((sum, day) => sum + day.orderCount, 0), [dailyStats]);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // --- Render Helpers ---

  if (loadingState === LoadingState.LOADING && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Đang tải dữ liệu từ Google Sheets...</p>
        </div>
      </div>
    );
  }

  if (loadingState === LoadingState.ERROR && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100 max-w-lg w-full">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Không thể tải dữ liệu</h3>
          <p className="text-gray-600 mb-4">{errorMsg}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => loadData()} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Thử lại</button>
            <button onClick={loadMockData} className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium">Xem demo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-7 h-7 text-blue-600" />
              Báo Cáo Doanh Thu
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500">
                Cập nhật lần cuối: {lastUpdated.toLocaleTimeString('vi-VN')}
                {isUsingMock && <span className="ml-2 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium border border-amber-100">Dữ liệu mẫu</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
             {/* Quick Filters */}
             <div className="flex gap-1.5 bg-gray-100/80 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
                {[
                  { id: 'today', label: 'Hôm nay' },
                  { id: 'yesterday', label: 'Hôm qua' },
                  { id: 'thisMonth', label: 'Tháng này' },
                  { id: 'all', label: 'Tất cả' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => applyDateFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                      activeFilter === f.id 
                      ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
             </div>

             <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-grow md:flex-grow-0">
                    <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => handleManualDateChange(e.target.value, endDate)}
                        className="bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 w-28 md:w-32"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => handleManualDateChange(startDate, e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 w-28 md:w-32"
                    />
                </div>
                <button 
                  onClick={() => loadData(false)} 
                  className="p-2.5 hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-600 transition-colors flex-shrink-0 relative group" 
                  title="Làm mới dữ liệu"
                >
                    <RefreshCw className={`w-5 h-5 ${loadingState === LoadingState.LOADING ? 'animate-spin text-blue-600' : ''}`} />
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      Làm mới
                    </span>
                </button>
             </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard 
            title="Tổng Doanh Thu" 
            value={totalRevenue.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })} 
            icon={DollarSign}
            color="blue"
          />
          <StatsCard 
            title="Tổng Số Lượng" 
            value={totalOrders.toString()} 
            subValue="Sản phẩm/Đơn hàng"
            icon={ShoppingBag}
            color="green"
          />
          <StatsCard 
            title="Giá Trị Trung Bình" 
            value={averageOrderValue.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })} 
            subValue="Doanh thu / Số đơn"
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Charts (AI Analysis removed) */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    Biểu Đồ Doanh Thu Theo Ngày
                    </h3>
                    <RevenueChart data={dailyStats} />
                </div>
            </div>

            {/* Right Column: Top Customers (From Grouped Data) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-orange-500" />
                    Top Khách Hàng
                </h3>
                <div className="space-y-4">
                    {topCustomers.map((cust, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-orange-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'}`}>
                                    {idx + 1}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{cust.name}</p>
                                    <p className="text-xs text-gray-500">{cust.totalOrders} đơn hàng</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">
                                    {cust.totalRevenue.toLocaleString('vi-VN', { notation: "compact" })}
                                </p>
                                <p className="text-xs text-gray-400">VNĐ</p>
                            </div>
                        </div>
                    ))}
                    {topCustomers.length === 0 && <p className="text-center text-gray-500 text-sm py-4">Chưa có dữ liệu</p>}
                </div>
            </div>
        </div>

        {/* Detailed Table (Grouped) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Danh Sách Đơn Hàng</h3>
              <p className="text-sm text-gray-500 mt-1">Đã gộp đơn theo khách hàng. Sắp xếp theo doanh thu.</p>
            </div>
            {activeFilter !== 'all' && (
                <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium">
                    Đang lọc: {activeFilter === 'today' ? 'Hôm nay' : activeFilter === 'yesterday' ? 'Hôm qua' : activeFilter === 'thisMonth' ? 'Tháng này' : 'Tùy chỉnh'}
                </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Đơn Mới Nhất</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Tên Khách</th>
                  <th className="px-6 py-4 font-semibold text-center whitespace-nowrap">Tổng SL</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Chi Tiết (Gộp)</th>
                  <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Tổng Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedOrders.length > 0 ? (
                    groupedOrders.slice(0, 50).map((order) => (
                    <tr 
                        key={order.id} 
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                        <td className="px-6 py-4 font-medium text-gray-500 whitespace-nowrap">
                            {new Date(order.date).toLocaleDateString('vi-VN')}
                            <br/>
                            <span className="text-xs text-gray-400">
                                <Clock className="w-3 h-3 inline mr-1"/>
                                {new Date(order.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{order.customerName}</span>
                            {order.subOrders && order.subOrders.length > 1 && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {order.subOrders.length} đơn
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-center">
                             <span className="inline-block px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">{order.quantity}</span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                            <p className="text-gray-600 truncate">{order.details.replace(/\n/g, ', ')}</p>
                            {order.facebookLink && <Facebook className="w-3 h-3 text-blue-600 mt-1 inline-block" />}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-blue-600 whitespace-nowrap text-base">
                            {order.amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                        </td>
                    </tr>
                    ))
                ) : (
                    <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Không tìm thấy đơn hàng nào trong khoảng thời gian này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  
                  {/* Modal Header */}
                  <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50 flex-shrink-0">
                      <div>
                          <h3 className="text-xl font-bold text-gray-900">Thông Tin Khách Hàng</h3>
                          <p className="text-sm text-gray-500 mt-1">Tổng hợp đơn hàng</p>
                      </div>
                      <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                          <X className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>
                  
                  {/* Modal Body - Scrollable */}
                  <div className="p-6 space-y-6 overflow-y-auto">
                      {/* Customer Info */}
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                              {selectedOrder.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                              <p className="text-xs text-gray-500 uppercase font-semibold">Khách hàng</p>
                              <h4 className="text-lg font-bold text-gray-900">{selectedOrder.customerName}</h4>
                          </div>
                          {selectedOrder.facebookLink && (
                              <a 
                                href={selectedOrder.facebookLink} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-medium hover:bg-[#166fe5] transition-colors shadow-sm"
                              >
                                  <Facebook className="w-4 h-4" />
                                  Facebook
                              </a>
                          )}
                      </div>

                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Tổng Số Lượng</p>
                              <p className="text-2xl font-bold text-gray-900 mt-1">{selectedOrder.quantity}</p>
                          </div>
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                              <p className="text-xs text-blue-600 uppercase tracking-wide">Tổng Doanh Thu</p>
                              <p className="text-2xl font-bold text-blue-700 mt-1">
                                  {selectedOrder.amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                              </p>
                          </div>
                      </div>

                      {/* Detail List or Single Detail */}
                      <div className="border-t border-gray-100 pt-4">
                          <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-500" />
                              Chi Tiết Đơn Hàng & Ghi Chú
                          </p>

                          {selectedOrder.subOrders && selectedOrder.subOrders.length > 0 ? (
                              <div className="space-y-3">
                                  {selectedOrder.subOrders.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((sub, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                                          <div className="flex justify-between items-start text-xs text-gray-500 mb-2 border-b border-gray-100 pb-2">
                                              <span className="flex items-center gap-1">
                                                  <Clock className="w-3 h-3" />
                                                  {new Date(sub.date).toLocaleDateString('vi-VN')} {new Date(sub.date).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                              </span>
                                              <span className="font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                                  SL: {sub.quantity}
                                              </span>
                                          </div>
                                          <p className="text-gray-800 text-sm mb-2">{sub.details || "Không có ghi chú"}</p>
                                          <div className="text-right">
                                              <span className="text-sm font-bold text-blue-600">
                                                  {sub.amount.toLocaleString('vi-VN')} đ
                                              </span>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="p-4 bg-gray-50 rounded-xl text-gray-700 text-sm leading-relaxed border border-gray-100 whitespace-pre-wrap">
                                  {selectedOrder.details || "Không có nội dung chi tiết."}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}