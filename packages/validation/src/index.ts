import { z } from 'zod';
import { CapaActionType, CapaSource, MaterialType, Priority, Severity } from '@pharmodry/types';

const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.values(o) as [T[keyof T], ...T[keyof T][]]);
const isoDate = z.string().min(1, 'Required').refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');
const positive = z.coerce.number({ invalid_type_error: 'Must be a number' }).positive('Must be greater than zero');

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Every electronic signature requires password re-entry and an explicit meaning. */
export const signatureSchema = z.object({
  password: z.string().min(1, 'Password is required to sign'),
  meaning: z.string().min(3),
  reason: z.string().max(1000).optional(),
});
export type SignatureInput = z.infer<typeof signatureSchema>;

export const grnLineSchema = z.object({
  materialId: z.string().uuid('Select a material'),
  poLineId: z.string().uuid().optional().or(z.literal('')),
  supplierBatch: z.string().min(1, 'Supplier batch is required'),
  quantity: positive,
  containers: z.coerce.number().int().min(1).default(1),
  mfgDate: isoDate,
  expiryDate: isoDate,
  retestDate: z.string().optional().or(z.literal('')),
  warehouseId: z.string().uuid('Select a warehouse'),
  binId: z.string().uuid().optional().or(z.literal('')),
});

export const grnSchema = z
  .object({
    siteId: z.string().uuid('Select a site'),
    supplierId: z.string().uuid('Select a supplier'),
    purchaseOrderId: z.string().uuid().optional().or(z.literal('')),
    deliveryNote: z.string().optional(),
    remarks: z.string().optional(),
    lines: z.array(grnLineSchema).min(1, 'Add at least one line'),
  })
  .superRefine((v, ctx) => {
    v.lines.forEach((l, i) => {
      if (Date.parse(l.expiryDate) <= Date.parse(l.mfgDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', i, 'expiryDate'], message: 'Expiry must be after manufacturing date' });
      }
    });
  });
export type GrnInput = z.infer<typeof grnSchema>;

export const deviationCreateSchema = z.object({
  siteId: z.string().uuid('Select a site'),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  title: z.string().min(5, 'Title is too short').max(200),
  description: z.string().min(10, 'Describe what happened'),
  immediateAction: z.string().min(3, 'Record the immediate action taken'),
  occurredAt: isoDate,
  category: z.string().optional(),
  proposedSeverity: enumOf(Severity).optional().or(z.literal('')),
  productId: z.string().uuid().optional().or(z.literal('')),
  batchId: z.string().uuid().optional().or(z.literal('')),
  materialId: z.string().uuid().optional().or(z.literal('')),
  equipmentId: z.string().uuid().optional().or(z.literal('')),
});
export type DeviationCreateInput = z.infer<typeof deviationCreateSchema>;

export const capaCreateSchema = z.object({
  siteId: z.string().uuid('Select a site'),
  source: enumOf(CapaSource),
  deviationId: z.string().uuid().optional().or(z.literal('')),
  oosId: z.string().uuid().optional().or(z.literal('')),
  problemStatement: z.string().min(10),
  rootCause: z.string().optional(),
  priority: enumOf(Priority),
  ownerId: z.string().uuid('Select an owner'),
  dueDate: isoDate,
  effectivenessCriteria: z.string().optional(),
  actions: z
    .array(
      z.object({
        type: enumOf(CapaActionType),
        description: z.string().min(5),
        ownerId: z.string().uuid(),
        dueDate: isoDate,
      }),
    )
    .default([]),
});
export type CapaCreateInput = z.infer<typeof capaCreateSchema>;

export const materialSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2),
  type: enumOf(MaterialType),
  uomId: z.string().uuid(),
  specificationRef: z.string().optional(),
  storageRequirement: z.string().optional(),
  retestPeriodMonths: z.coerce.number().int().min(0).optional(),
  safetyStock: z.coerce.number().min(0).default(0),
  leadTimeDays: z.coerce.number().int().min(0).default(30),
  unitCost: z.coerce.number().min(0).default(0),
});

export const reasonSchema = z.object({ reason: z.string().min(5, 'A reason of at least 5 characters is required') });

export * from 'zod';
