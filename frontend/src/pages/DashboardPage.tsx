import { useAuth } from '../contexts/AuthContext';
import { ShopkeeperDashboard } from './dashboards/ShopkeeperDashboard';
import { WarehouseDashboard } from './dashboards/WarehouseDashboard';
import { OwnerDashboard } from './dashboards/OwnerDashboard';

/**
 * Renders the dashboard tailored to the signed-in staff member's role.
 * (Route access is already gated to staff by RequireRole in App.tsx.)
 */
export function DashboardPage() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'OWNER':
      return <OwnerDashboard />;
    case 'WAREHOUSE_MANAGER':
      return <WarehouseDashboard />;
    case 'SHOPKEEPER':
      return <ShopkeeperDashboard />;
    default:
      return null;
  }
}
