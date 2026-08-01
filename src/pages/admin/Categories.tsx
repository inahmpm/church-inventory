import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  addSubcategory,
  createCategory,
  deleteCategory,
  removeSubcategory,
  subscribeCategories,
} from '../../lib/categories';
import { useCurrentUser } from '../../lib/useCurrentUser';
import type { Category } from '../../types';

export default function Categories() {
  const { profile } = useCurrentUser();
  const ministryId = profile?.ministryId;

  if (profile && profile.role !== 'ministry-admin' && profile.role !== 'super-admin') {
    return <Navigate to="/admin" replace />;
  }
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeCategories(ministryId, setCategories);
  }, [ministryId]);

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ministryId) return;
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" already exists.`);
      return;
    }
    try {
      await createCategory(ministryId, name);
      setNewCategory('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category.');
    }
  }

  async function handleDeleteCategory(c: Category) {
    if (!confirm(`Delete category "${c.name}" and all its subcategories? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteCategory(c.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category.');
    }
  }

  async function handleAddSubcategory(c: Category, e: FormEvent) {
    e.preventDefault();
    setError(null);
    const draft = (subcategoryDrafts[c.id] ?? '').trim();
    if (!draft) return;
    if (c.subcategories.some((s) => s.toLowerCase() === draft.toLowerCase())) {
      alert(`"${draft}" already exists under "${c.name}".`);
      return;
    }
    try {
      await addSubcategory(c.id, draft);
      setSubcategoryDrafts((prev) => ({ ...prev, [c.id]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subcategory.');
    }
  }

  async function handleRemoveSubcategory(c: Category, s: string) {
    setError(null);
    try {
      await removeSubcategory(c.id, s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove subcategory.');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Categories</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleAddCategory} className="card flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="input flex-1"
          placeholder="New category name, e.g. Audio"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button type="submit" className="btn-primary whitespace-nowrap">
          + Add Category
        </button>
      </form>

      <div className="space-y-3">
        {categories.map((c) => (
          <div key={c.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-slate-800">{c.name}</h2>
              <button className="text-sm text-red-600 hover:underline" onClick={() => handleDeleteCategory(c)}>
                Delete
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {c.subcategories.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                >
                  {s}
                  <button
                    className="text-slate-400 hover:text-red-600 leading-none"
                    onClick={() => handleRemoveSubcategory(c, s)}
                    aria-label={`Remove ${s}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
              {c.subcategories.length === 0 && (
                <span className="text-xs text-slate-400">No subcategories yet.</span>
              )}
            </div>

            <form onSubmit={(e) => handleAddSubcategory(c, e)} className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="New subcategory"
                value={subcategoryDrafts[c.id] ?? ''}
                onChange={(e) => setSubcategoryDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
              />
              <button type="submit" className="btn-secondary whitespace-nowrap text-sm">
                Add
              </button>
            </form>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="text-center text-slate-400 py-8">No categories yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
