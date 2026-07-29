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
  email: string;
  ministryId: string;
  role: UserRole;
  active: boolean; // soft-disable, since Auth accounts can't be deleted client-side
  mustChangePassword: boolean;
  createdAt: number;
}

export interface Category {
  id: string; // Firestore doc id
  ministryId: string;
  name: string;
  subcategories: string[];
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
  location: string;
  purchaseDate: string; // yyyy-mm-dd
  status: EquipmentStatus;
  statusDetails: string;
  // Internal borrow-tracking fields, not part of the visible inventory table:
  isBorrowed: boolean;
  activeBorrowRequestId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type NewEquipment = Omit<
  Equipment,
  'id' | 'isBorrowed' | 'activeBorrowRequestId' | 'createdAt' | 'updatedAt'
>;

export type BorrowRequestStatus = 'pending' | 'borrowed' | 'returned';

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
}

export const HISTORY_LOG_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'borrowed',
  'removed',
  'handed_out',
  'returned',
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
