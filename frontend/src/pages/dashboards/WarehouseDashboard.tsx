import { useEffect, useState } from 'react';
import { Product } from '../../types';
import { getProducts } from '../../services/productService';
import { getInventory, getLowStock } from '../../services/inventoryService';
import { getDamageReports } from '../../services/damageService';
import { getRestockRequests } from '../../services/restockRequestService';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import { StatCard } from '../../components/dashboard/StatCard';
import { StockOverview } from '../../components/dashboard/StockOverview';
import { TransferPanel } from '../../components/dashboard/TransferPanel';
import { ReceiveStockPanel } from '../../components/dashboard/ReceiveStockPanel';
import { RestockQueuePanel } from '../../components/dashboard/RestockQueuePanel';
import { DamagePanel } from '../../components/dashboard/DamagePanel';
import { SendReportPanel } from '../../components/dashboard/SendReportPanel';

export function WarehouseDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockVersion, setStockVersion] = useState(0);
  const [stats, setStats] = useState({ openRestock: 0, warehouseLow: 0, warehouseUnits: 0, openRepairs: 0 });
  const bump = () => setStockVersion((v) => v + 1);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  useEffect(() => {
    Promise.all([getInventory(), getLowStock(), getDamageReports(), getRestockRequests()])
      .then(([inv, low, reports, restocks]) => {
        setStats({
          openRestock: restocks.filter((r) => r.status === 'OPEN').length,
          warehouseLow: low.filter((s) => s.location === 'WAREHOUSE').length,
          warehouseUnits: inv
            .filter((s) => s.location === 'WAREHOUSE')
            .reduce((sum, s) => sum + s.quantity, 0),
          openRepairs: reports.filter((r) => r.status === 'REPORTED' || r.status === 'IN_REPAIR').length,
        });
      })
      .catch(() => undefined);
  }, [stockVersion]);

  return (
    <DashboardShell
      title="Warehouse Dashboard"
      preview={
        <>
          <StatCard label="Restock requests" value={stats.openRestock} tone={stats.openRestock ? 'warn' : 'good'} />
          <StatCard label="Warehouse low / out" value={stats.warehouseLow} tone={stats.warehouseLow ? 'warn' : 'good'} />
          <StatCard label="Units in warehouse" value={stats.warehouseUnits} />
          <StatCard label="Open repairs" value={stats.openRepairs} />
        </>
      }
      tabs={[
        { id: 'inventory', label: '📦 Inventory', render: () => <StockOverview refreshKey={stockVersion} /> },
        { id: 'restock', label: '📥 Restock requests', render: () => <RestockQueuePanel onStockChange={bump} /> },
        { id: 'receive', label: '📦 Receive Stock', render: () => <ReceiveStockPanel products={products} onDone={bump} /> },
        { id: 'transfers', label: '🔄 Transfers', render: () => <TransferPanel products={products} onDone={bump} /> },
        { id: 'damage', label: '🛠 Damage & Repairs', render: () => <DamagePanel products={products} onStockChange={bump} /> },
        { id: 'report', label: '📊 Reports', render: () => <SendReportPanel /> },
      ]}
    />
  );
}
