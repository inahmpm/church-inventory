import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Category, CustomFieldDefinition, CustomFieldType } from '../types';

const categoriesCol = collection(db, 'categories');

export function subscribeCategories(ministryId: string, cb: (categories: Category[]) => void) {
  const q = query(categoriesCol, where('ministryId', '==', ministryId), orderBy('name'));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Omit<Category, 'id'>;
        return {
          id: d.id,
          ...data,
          customFields: data.customFields ?? [],
          showCustomFields: data.showCustomFields ?? true,
        };
      }),
    );
  });
}

export async function createCategory(ministryId: string, name: string) {
  await addDoc(categoriesCol, {
    ministryId,
    name,
    subcategories: [],
    customFields: [],
    showCustomFields: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function setShowCustomFields(id: string, showCustomFields: boolean) {
  await updateDoc(doc(db, 'categories', id), { showCustomFields, updatedAt: Date.now() });
}

export async function addCustomField(id: string, current: CustomFieldDefinition[], name: string, type: CustomFieldType) {
  const field: CustomFieldDefinition = { id: crypto.randomUUID(), name, type };
  await updateDoc(doc(db, 'categories', id), {
    customFields: [...current, field],
    updatedAt: Date.now(),
  });
}

export async function updateCustomField(
  id: string,
  current: CustomFieldDefinition[],
  fieldId: string,
  updates: Partial<Pick<CustomFieldDefinition, 'name' | 'type'>>,
) {
  await updateDoc(doc(db, 'categories', id), {
    customFields: current.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
    updatedAt: Date.now(),
  });
}

export async function removeCustomField(id: string, current: CustomFieldDefinition[], fieldId: string) {
  await updateDoc(doc(db, 'categories', id), {
    customFields: current.filter((f) => f.id !== fieldId),
    updatedAt: Date.now(),
  });
}

export async function deleteCategory(id: string) {
  await deleteDoc(doc(db, 'categories', id));
}

export async function addSubcategory(id: string, subcategory: string) {
  await updateDoc(doc(db, 'categories', id), {
    subcategories: arrayUnion(subcategory),
    updatedAt: Date.now(),
  });
}

export async function removeSubcategory(id: string, subcategory: string) {
  await updateDoc(doc(db, 'categories', id), {
    subcategories: arrayRemove(subcategory),
    updatedAt: Date.now(),
  });
}
