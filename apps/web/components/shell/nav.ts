import type { PermissionCode } from '@pharmodry/types';
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileBarChart,
  GitBranch,
  FileSearch,
  FlaskConical,
  Gauge,
  Home,
  KeyRound,
  ListChecks,
  Package,
  PackageCheck,
  ScrollText,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Visible when the user has ANY of these permissions. */
  perms?: PermissionCode[];
  /** Additionally requires ALL of these permissions. */
  all?: PermissionCode[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'My work', href: '/', icon: Home },
      { label: 'Command Center', href: '/command-center', icon: Activity, perms: ['commandcenter.view'] },
      { label: 'Dashboard', href: '/dashboard', icon: Gauge, perms: ['analytics.view'] },
      { label: 'Copilot', href: '/copilot', icon: Sparkles, perms: ['ai.copilot.use'] },
    ],
  },
  {
    label: 'Supply & inventory',
    items: [
      { label: 'Purchase orders', href: '/procurement/purchase-orders', icon: ShoppingCart, perms: ['procurement.po.view'] },
      { label: 'Goods receipts', href: '/inventory/receipts', icon: Truck, perms: ['inventory.view'] },
      { label: 'Inventory', href: '/inventory', icon: Boxes, perms: ['inventory.view'] },
      { label: 'Stock movements', href: '/inventory/movements', icon: ScrollText, perms: ['inventory.view'] },
    ],
  },
  {
    label: 'Production',
    items: [
      { label: 'Production plans', href: '/production/plans', icon: ClipboardList, perms: ['production.plan.view'] },
      { label: 'Batches & eBMR', href: '/production/batches', icon: Factory, perms: ['batch.view'] },
      { label: 'Traceability & recall', href: '/traceability', icon: GitBranch, all: ['batch.view', 'inventory.view'] },
    ],
  },
  {
    label: 'Quality',
    items: [
      { label: 'QA release', href: '/quality/release', icon: PackageCheck, perms: ['inventory.release', 'batch.approve'] },
      { label: 'QC samples', href: '/quality/samples', icon: FlaskConical, perms: ['qc.view'] },
      { label: 'OOS investigations', href: '/quality/oos', icon: ShieldAlert, perms: ['oos.view'] },
      { label: 'Deviations', href: '/quality/deviations', icon: ClipboardCheck, perms: ['deviation.view'] },
      { label: 'CAPA', href: '/quality/capa', icon: ListChecks, perms: ['capa.view'] },
      { label: 'Product quality review', href: '/quality/pqr', icon: FileBarChart, all: ['analytics.view', 'batch.view'] },
    ],
  },
  {
    label: 'Master data',
    items: [
      { label: 'Products', href: '/master-data/products', icon: Package, perms: ['masterdata.view'] },
      { label: 'Materials', href: '/master-data/materials', icon: FlaskConical, perms: ['masterdata.view'] },
      { label: 'Suppliers', href: '/master-data/suppliers', icon: Building2, perms: ['supplier.view'] },
      { label: 'Equipment', href: '/master-data/equipment', icon: Wrench, perms: ['masterdata.view'] },
      { label: 'Specifications', href: '/master-data/specifications', icon: FileSearch, perms: ['masterdata.view'] },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Audit trail', href: '/audit-trail', icon: ScrollText, perms: ['audit.view'] },
      { label: 'Reports', href: '/reports', icon: BarChart3, perms: ['report.export', 'audit.export'] },
      { label: 'Users', href: '/admin/users', icon: Users, perms: ['admin.user.manage'] },
      { label: 'Roles & permissions', href: '/admin/roles', icon: KeyRound, perms: ['admin.role.manage'] },
      { label: 'Organisation', href: '/admin/organization', icon: Building2, perms: ['admin.site.manage', 'admin.tenant.manage'] },
      { label: 'AI governance', href: '/admin/ai', icon: Sparkles, perms: ['ai.admin'] },
    ],
  },
];
