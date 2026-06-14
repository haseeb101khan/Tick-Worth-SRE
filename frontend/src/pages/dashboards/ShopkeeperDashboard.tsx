import { useEffect, useState } from 'react';
import { Product } from '../../types';
import { getProducts } from '../../services/productService';
import { getAllOrders } from '../../services/orderService';
import { getAllRequests } from '../../services/stockRequestService';
import { getRestockRequests } from '../../services/restockRequestService';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { StockOverview } from '../../components/dashboard/StockOverview';
import { OrdersAdmin } from '../../components/dashboard/OrdersAdmin';
import { TransferPanel } from '../../components/dashboard/TransferPanel';
import { DamagePanel } from '../../components/dashboard/DamagePanel';
import { CourierPanel } from '../../components/dashboard/CourierPanel';
import { CatalogPanel } from '../../components/dashboard/CatalogPanel';
import { StockRequestsPanel } from '../../components/dashboard/StockRequestsPanel';
import { RestockPanel } from '../../components/dashboard/RestockPanel';
import { SendReportPanel } from '../../components/dashboard/SendReportPanel';

export function ShopkeeperDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockVersion, setStockVersion] = useState(0);
  const [stats, setStats] = useState({ awaitingPayment: 0, toDispatch: 0, openRequests: 0, restockPending: 0 });
  const bump = () => setStockVersion((v) => v + 1);
  const loadProducts = () => getProducts().then(setProducts).catch(() => undefined);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    Promise.all([getAllOrders(), getAllRequests(), getRestockRequests()])
      .then(([orders, requests, restocks]) => {
        setStats({
          awaitingPayment: orders.filter((o) => o.status === 'PENDING').length,
          toDispatch: orders.filter((o) => o.status === 'PAID').length,
          openRequests: requests.filter((r) => r.status === 'OPEN').length,
          restockPending: restocks.filter((r) => r.status === 'OPEN').length,
        });
      })
      .catch(() => undefined);
  }, [stockVersion]);

  return (
    <DashboardShell
      title="Shopkeeper Dashboard"
      preview={
        <>
          <StatCard label="Awaiting payment" value={stats.awaitingPayment} tone={stats.awaitingPayment ? 'warn' : 'default'} />
          <StatCard label="Ready to dispatch" value={stats.toDispatch} tone={stats.toDispatch ? 'warn' : 'default'} />
          <StatCard label="Customer requests" value={stats.openRequests} tone={stats.openRequests ? 'warn' : 'good'} />
          <StatCard label="Restock pending" value={stats.restockPending} tone={stats.restockPending ? 'warn' : 'good'} />
        </>
      }
      tabs={[
        { id: 'orders', label: '🧾 Orders', render: () => <OrdersAdmin products={products} onStockChange={bump} /> },
        { id: 'catalog', label: '🏷 Catalogue', render: () => <CatalogPanel products={products} onChange={() => { loadProducts(); bump(); }} /> },
        { id: 'requests', label: '📌 Customer Requests', render: () => <StockRequestsPanel onStockChange={bump} /> },
        { id: 'restock', label: '📦 Restock', render: () => <RestockPanel onStockChange={bump} /> },
        { id: 'stock', label: '🏬 Stock (incl. warehouse)', render: () => <StockOverview refreshKey={stockVersion} /> },
        { id: 'transfers', label: '🔄 Transfers', render: () => <TransferPanel products={products} onDone={bump} /> },
        { id: 'damage', label: '🛠 Damage & Repairs', render: () => <DamagePanel products={products} onStockChange={bump} /> },
        { id: 'couriers', label: '🚚 Couriers', render: () => <CourierPanel /> },
        { id: 'report', label: '📊 Reports', render: () => <SendReportPanel /> },
      ]}
    />
  );
}
