export const EQUIPMENT_STATUSES = [
  'Good Condition',
  'Fair Condition',
  'For Repair',
  'For Replacement',
  'For Disposal',
] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const ASSIGNED_TYPES = ['Borrowable', 'Fixed', 'Issued'] as const;
export type AssignedType = (typeof ASSIGNED_TYPES)[number];

export type UserRole = 'super-admin' | 'ministry-admin' | 'member';

export interface Ministry {
  id: string; // Firestore doc id
  name: string;
  slug: string; // used in /borrow/:slug
  inventoryCodePrefix: string; // e.g. "TECH", "AV", "MUSIC"
  notificationEmail?: string;
  department?: string;
  hiddenFields: ToggleableFieldKey[]; // default equipment fields hidden from every category's form
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_DEPARTMENTS = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'] as const;

export interface Department {
  id: string; // Firestore doc id
  name: string;
  createdAt: number;
}

export interface AppUser {
  uid: string; // Firestore doc id, matches Firebase Auth uid
  name: string;
  email: string;
  ministryId: string;
  role: UserRole;
  active: boolean; // soft-disable, since Auth accounts can't be deleted client-side
  mustChangePassword: boolean;
  createdAt: number;
}

export const CUSTOM_FIELD_TYPES = ['text', 'date', 'checkbox'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

// A custom attribute defined by a user for equipment in a given category,
// e.g. "Cable Length" (text) on the "Cables" category. Embedded on the
// category doc rather than its own collection/id-generation scheme, since
// custom fields only ever exist in the context of one category.
export interface CustomFieldDefinition {
  id: string; // client-generated (crypto.randomUUID()), stable across renames
  name: string; // display label, e.g. "Cable Length"
  type: CustomFieldType;
}

// Built-in equipment attributes that can be hidden from every category's
// add/edit form (ministry-wide setting; they still always show in the shared
// Inventory table/report, just blank when hidden). The identity fields
// (category, item, inventoryCode, status) are never hideable since the rest
// of the app depends on them always being set.
export const TOGGLEABLE_EQUIPMENT_FIELDS = [
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'assignedType', label: 'Assigned Type' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'department', label: 'Department' },
  { key: 'ministry', label: 'Ministry' },
  { key: 'location', label: 'Location' },
  { key: 'purchaseDate', label: 'Purchase Date' },
  { key: 'statusDetails', label: 'Status Details' },
] as const;
export type ToggleableFieldKey = (typeof TOGGLEABLE_EQUIPMENT_FIELDS)[number]['key'];

export interface Category {
  id: string; // Firestore doc id
  ministryId: string;
  name: string;
  subcategories: string[];
  customFields: CustomFieldDefinition[]; // this category's extra attributes
  showCustomFields: boolean; // whether the custom fields section shows on this category's form/table/report
  createdAt: number;
  updatedAt: number;
}

export interface Equipment {
  id: string; // Firestore doc id
  ministryId: string;
  category: string;
  subcategory: string;
  inventoryCode: string; // unique QR code value
  item: string;
  serialNumber: string;
  assignedType: AssignedType;
  assignedTo: string;
  department: string;
  ministry: string;
  location: string;
  purchaseDate: string; // yyyy-mm-dd
  status: EquipmentStatus;
  statusDetails: string;
  customFields: Record<string, string>; // keyed by CustomFieldDefinition.id
  // Internal borrow-tracking fields, not part of the visible inventory table:
  isBorrowed: boolean;
  activeBorrowRequestId: string | null;
  // Internal pull-out tracking fields, mirrors the borrow-tracking fields above:
  pulloutStatus: PulloutItemStatus | null; // 'for_pullout' | 'pulled_out' | null
  activePulloutRequestId: string | null;
  createdAt: number;
  updatedAt: number;
}

// The custom fields to actually render/display for a category — empty when
// the category has turned its custom fields section off, without discarding
// the definitions (or previously entered data) themselves.
export function visibleCustomFields(category: Category | undefined): CustomFieldDefinition[] {
  if (!category || category.showCustomFields === false) return [];
  return category.customFields;
}

export type NewEquipment = Omit<
  Equipment,
  | 'id'
  | 'isBorrowed'
  | 'activeBorrowRequestId'
  | 'pulloutStatus'
  | 'activePulloutRequestId'
  | 'createdAt'
  | 'updatedAt'
>;

export type BorrowRequestStatus = 'pending' | 'borrowed' | 'returned' | 'denied';

export interface BorrowedItem {
  equipmentId: string;
  inventoryCode: string;
  item: string;
  category: string;
}

export interface BorrowRequest {
  id: string;
  ministryId: string;
  name: string;
  email: string;
  ministry: string;
  contactNo: string;
  venue: string;
  equipmentRequested: string; // free-text description from the public form
  status: BorrowRequestStatus;
  items: BorrowedItem[]; // populated by tech support while scanning
  submittedAt: number; // timestamp of form submission
  fulfilledAt: number | null; // timestamp scanning was completed / items handed out
  returnedAt: number | null; // timestamp items were returned
  deniedAt: number | null; // timestamp the request was rejected
}

export const HISTORY_LOG_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'borrowed',
  'removed',
  'handed_out',
  'returned',
  'pulled_out',
  'denied',
  'pullout_scheduled',
  'pullout_removed',
  'pullout_scanned_out',
  'pullout_scanned_in',
  'pullout_missing',
  'pullout_found',
] as const;
export type HistoryLogAction = (typeof HISTORY_LOG_ACTIONS)[number];

export interface HistoryLogEntry {
  id: string;
  ministryId: string;
  equipmentId: string;
  inventoryCode: string;
  item: string;
  action: HistoryLogAction;
  details: string;
  actor: string | null; // signed-in admin's email, if known
  timestamp: number;
}

export interface EquipmentPullout {
  id: string;
  ministryId: string;
  equipmentId: string; // linked inventory item
  inventoryCode: string;
  item: string;
  area: string; // free-text: where the equipment is being pulled out to
  pulloutAt: number; // date/time of the pullout, chosen by the user
  actor: string | null; // signed-in admin's email, if known
  createdAt: number;
}

export type NewEquipmentPullout = Omit<EquipmentPullout, 'id' | 'actor' | 'createdAt'>;

// ---------------------------------------------------------------------------
// Equipment Pull-out Module (request/items lifecycle) — supersedes the flat
// `EquipmentPullout` log above for new pull-outs. That collection stays in
// place, read-only, as a historical record predating this module.
// ---------------------------------------------------------------------------

export const PULLOUT_REQUEST_STATUSES = ['draft', 'scheduled', 'in_progress', 'closed'] as const;
export type PulloutRequestStatus = (typeof PULLOUT_REQUEST_STATUSES)[number];

export const PULLOUT_ITEM_STATUSES = ['for_pullout', 'pulled_out', 'returned', 'missing'] as const;
export type PulloutItemStatus = (typeof PULLOUT_ITEM_STATUSES)[number];

export interface PulloutRequest {
  id: string;
  ministryId: string;
  purpose: string;
  pulloutAt: number; // scheduled date & time of pull-out
  returnDueAt: number; // scheduled date & time of return
  destination: string;
  requestorName: string;
  requestorEmail: string | null;
  status: PulloutRequestStatus; // derived rollup, never set directly by the UI
  itemCount: number; // denormalized count for list views
  createdBy: string | null; // requesting user's email
  createdAt: number;
  updatedAt: number;
}

export type NewPulloutRequest = Omit<
  PulloutRequest,
  'id' | 'status' | 'itemCount' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

export interface PulloutItem {
  id: string;
  equipmentId: string; // FK -> equipment/{id}
  inventoryCode: string;
  item: string;
  category: string;
  subcategory: string;
  itemStatus: PulloutItemStatus;
  scannedOutAt: number | null;
  scannedOutBy: string | null; // Ministry Admin's email
  scannedInAt: number | null;
  scannedInBy: string | null; // Ministry Admin's email
  conditionNoteOnReturn: string | null;
}
