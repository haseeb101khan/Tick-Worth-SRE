import { useEffect, useState } from 'react';
import { Product } from '../../types';
import { getProducts } from '../../services/productService';
import { getLowStock } from '../../services/inventoryService';
import { getMonthlyReport } from '../../services/reportService';
import { getStaff } from '../../services/userService';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { StockOverview } from '../../components/dashboard/StockOverview';
import { OrdersAdmin } from '../../components/dashboard/OrdersAdmin';
import { TransferPanel } from '../../components/dashboard/TransferPanel';
import { ReceiveStockPanel } from '../../components/dashboard/ReceiveStockPanel';
import { DamagePanel } from '../../components/dashboard/DamagePanel';
import { CourierPanel } from '../../components/dashboard/CourierPanel';
import { CatalogPanel } from '../../components/dashboard/CatalogPanel';
import { StockRequestsPanel } from '../../components/dashboard/StockRequestsPanel';
import { MonthlyReportPanel } from '../../components/dashboard/MonthlyReportPanel';
import { ReportsArchivePanel } from '../../components/dashboard/ReportsArchivePanel';
import { UserManagementPanel } from '../../components/dashboard/UserManagementPanel';
import { formatMoney } from '../../utils/format';

export function OwnerDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockVersion, setStockVersion] = useState(0);
  const [stats, setStats] = useState({ revenue: 0, orders: 0, lowStock: 0, staff: 0 });
  const bump = () => setStockVersion((v) => v + 1);
  const loadProducts = () => getProducts().then(setProducts).catch(() => undefined);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      getMonthlyReport(now.getFullYear(), now.getMonth() + 1),
      getLowStock(),
      getStaff(),
    ])
      .then(([report, low, staff]) => {
        setStats({
          revenue: report.totalRevenueCents,
          orders: report.orderCount,
          lowStock: low.length,
          staff: staff.filter((s) => s.active).length,
        });
      })
      .catch(() => undefined);
  }, [stockVersion]);

  return (
    <DashboardShell
      title="Owner Dashboard"
      preview={
        <>
          <StatCard label="Revenue this month" value={formatMoney(stats.revenue)} tone="good" />
          <StatCard label="Orders this month" value={stats.orders} />
          <StatCard label="Low-stock alerts" value={stats.lowStock} tone={stats.lowStock ? 'warn' : 'good'} />
          <StatCard label="Active staff" value={stats.staff} />
        </>
      }
      tabs={[
        { id: 'report', label: '📈 Monthly Report', render: () => <MonthlyReportPanel /> },
        { id: 'received', label: '📨 Received Reports', render: () => <ReportsArchivePanel /> },
        { id: 'catalog', label: '🏷 Catalogue', render: () => <CatalogPanel products={products} onChange={() => { loadProducts(); bump(); }} /> },
        { id: 'orders', label: '🧾 Orders', render: () => <OrdersAdmin products={products} onStockChange={bump} /> },
        { id: 'requests', label: '📌 Requests', render: () => <StockRequestsPanel onStockChange={bump} /> },
        { id: 'inventory', label: '📦 Inventory', render: () => <StockOverview refreshKey={stockVersion} /> },
        { id: 'receive', label: '📥 Receive Stock', render: () => <ReceiveStockPanel products={products} onDone={bump} /> },
        { id: 'transfers', label: '🔄 Transfers', render: () => <TransferPanel products={products} onDone={bump} /> },
        { id: 'damage', label: '🛠 Damage & Repairs', render: () => <DamagePanel products={products} onStockChange={bump} /> },
        { id: 'couriers', label: '🚚 Couriers', render: () => <CourierPanel /> },
        { id: 'users', label: '👥 User Management', render: () => <UserManagementPanel /> },
      ]}
    />
  );
}
