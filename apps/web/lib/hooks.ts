'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Equipment, Lookup, Material, Product, Site, Supplier, UserLite, Warehouse } from './types';

const LONG = 5 * 60_000;

export const useSites = () => useQuery({ queryKey: ['sites'], queryFn: () => api.get<Site[]>('/sites'), staleTime: LONG });
export const useWarehouses = (siteId?: string) => useQuery({ queryKey: ['warehouses', siteId], queryFn: () => api.get<Warehouse[]>('/warehouses', { siteId }), staleTime: LONG });
export const useDirectory = (permission?: string) => useQuery({ queryKey: ['directory', permission], queryFn: () => api.get<UserLite[]>('/users/directory', { permission }), staleTime: LONG });
export const useLookups = () =>
  useQuery({ queryKey: ['lookups'], queryFn: () => api.get<{ uoms: Lookup[]; categories: Lookup[]; dosageForms: Lookup[]; testMethods: Lookup[] }>('/master-data/lookups'), staleTime: LONG });
export const useProducts = () => useQuery({ queryKey: ['products-all'], queryFn: () => api.page<Product>('/products', { pageSize: 200 }).then((r) => r.data), staleTime: LONG });
export const useMaterials = () => useQuery({ queryKey: ['materials-all'], queryFn: () => api.page<Material>('/materials', { pageSize: 200 }).then((r) => r.data), staleTime: LONG });
/** Pass enabled=false when the user lacks supplier.view (avoids a 403 for optional filters). */
export const useSuppliers = (enabled = true) => useQuery({ queryKey: ['suppliers-all'], queryFn: () => api.page<Supplier>('/suppliers', { pageSize: 200 }).then((r) => r.data), staleTime: LONG, enabled });
export const useEquipment = () => useQuery({ queryKey: ['equipment-all'], queryFn: () => api.page<Equipment>('/equipment', { pageSize: 200 }).then((r) => r.data), staleTime: LONG });

export const statusOptions = (values: string[]) => values.map((v) => ({ value: v, label: v.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }));
