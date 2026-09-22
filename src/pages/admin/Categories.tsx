import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addCustomField,
  addSubcategory,
  createCategory,
  deleteCategory,
  removeCustomField,
  removeSubcategory,
  setShowCustomFields,
  subscribeCategories,
  updateCustomField,
} from '../../lib/categories';
import { setHiddenFields as setMinistryHiddenFields } from '../../lib/ministries';
import { useActiveMinistry } from '../../lib/MinistryContext';
import { TOGGLEABLE_EQUIPMENT_FIELDS, type Category, type CustomFieldType, type ToggleableFieldKey } from '../../types';

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <path d="M12 4v16M4 12h16" strokeLinecap="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path
        d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path
        d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Categories() {
  const { ministryId, ministry } = useActiveMinistry();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<string, string>>({});
  const [customFieldDrafts, setCustomFieldDrafts] = useState<Record<string, { name: string; type: CustomFieldType }>>({});
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editFieldDraft, setEditFieldDraft] = useState<{ name: string; type: CustomFieldType }>({
    name: '',
    type: 'text',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeCategories(ministryId, setCategories);
  }, [ministryId]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  const editingCategory = categories.find((c) => c.id === editingId) ?? null;

  function closeEditModal() {
    setEditingId(null);
    setEditingFieldId(null);
  }

  async function handleToggleDefaultField(key: ToggleableFieldKey) {
    setError(null);
    if (!ministryId || !ministry) return;
    const hidden = ministry.hiddenFields.includes(key);
    const next = hidden ? ministry.hiddenFields.filter((k) => k !== key) : [...ministry.hiddenFields, key];
    try {
      await setMinistryHiddenFields(ministryId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update field visibility.');
    }
  }

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

  async function handleToggleShowCustomFields(c: Category) {
    setError(null);
    try {
      await setShowCustomFields(c.id, !c.showCustomFields);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update custom fields visibility.');
    }
  }

  async function handleAddCustomField(c: Category, e: FormEvent) {
    e.preventDefault();
    setError(null);
    const draft = customFieldDrafts[c.id] ?? { name: '', type: 'text' as CustomFieldType };
    const name = draft.name.trim();
    if (!name) return;
    if (c.customFields.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" already exists under "${c.name}".`);
      return;
    }
    try {
      await addCustomField(c.id, c.customFields, name, draft.type);
      setCustomFieldDrafts((prev) => ({ ...prev, [c.id]: { name: '', type: 'text' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add custom field.');
    }
  }

  async function handleRemoveCustomField(c: Category, fieldId: string) {
    setError(null);
    try {
      await removeCustomField(c.id, c.customFields, fieldId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove custom field.');
    }
  }

  function startEditingCustomField(f: { id: string; name: string; type: CustomFieldType }) {
    setEditingFieldId(f.id);
    setEditFieldDraft({ name: f.name, type: f.type });
  }

  async function handleSaveCustomField(c: Category, fieldId: string, e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = editFieldDraft.name.trim();
    if (!name) return;
    if (c.customFields.some((f) => f.id !== fieldId && f.name.toLowerCase() === name.toLowerCase())) {
      alert(`"${name}" already exists under "${c.name}".`);
      return;
    }
    try {
      await updateCustomField(c.id, c.customFields, fieldId, { name, type: editFieldDraft.type });
      setEditingFieldId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update custom field.');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Categories</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card space-y-2">
        <div className="text-sm font-medium text-slate-700">
          Default fields shown on every category's equipment form
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TOGGLEABLE_EQUIPMENT_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                className="accent-primary-600"
                checked={!(ministry?.hiddenFields ?? []).includes(key)}
                onChange={() => handleToggleDefaultField(key)}
                disabled={!ministry}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-slate-800">Category List</h2>
          <form onSubmit={handleAddCategory} className="flex items-center gap-2">
            <input
              className="input text-sm sm:w-52"
              placeholder="New category name, e.g. Audio"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary rounded-full whitespace-nowrap text-sm inline-flex items-center gap-1.5"
            >
              <IconPlus />
              Add category
            </button>
          </form>
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <IconSearch />
          </span>
          <input
            className="input rounded-full pl-9"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <div className="hidden sm:flex items-center gap-4 bg-slate-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="flex-1">Name</span>
            <span className="w-32">Subcategories</span>
            <span className="w-32">Custom Fields</span>
            <span className="w-20 text-right">Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredCategories.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setEditingId(c.id)}
              >
                <span className="flex-1 min-w-[10rem] flex items-center gap-2.5 font-medium text-slate-800">
                  <span className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                    <IconTag />
                  </span>
                  {c.name}
                </span>
                <span className="sm:w-32 text-sm text-slate-500">
                  {c.subcategories.length} sub{c.subcategories.length === 1 ? '' : 's'}
                </span>
                <span className="sm:w-32 text-sm text-slate-500">
                  {c.showCustomFields
                    ? `${c.customFields.length} field${c.customFields.length === 1 ? '' : 's'}`
                    : 'Hidden'}
                </span>
                <span className="sm:w-20 flex items-center justify-end gap-2 ml-auto sm:ml-0">
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(c.id);
                    }}
                    aria-label={`Edit ${c.name}`}
                  >
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-slate-200 text-red-500 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(c);
                    }}
                    aria-label={`Delete ${c.name}`}
                  >
                    <IconTrash />
                  </button>
                </span>
              </div>
            ))}
            {filteredCategories.length === 0 && (
              <div className="text-center text-slate-400 py-8">
                {categories.length === 0 ? 'No categories yet. Add one above.' : 'No categories match your search.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingCategory && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={closeEditModal}
        >
          <div
            className="card max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <IconTag />
                </span>
                {editingCategory.name}
              </h2>
              <button
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                onClick={closeEditModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subcategories</div>
              <div className="flex flex-wrap gap-2">
                {editingCategory.subcategories.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    {s}
                    <button
                      className="text-slate-400 hover:text-red-600 leading-none"
                      onClick={() => handleRemoveSubcategory(editingCategory, s)}
                      aria-label={`Remove ${s}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {editingCategory.subcategories.length === 0 && (
                  <span className="text-xs text-slate-400">No subcategories yet.</span>
                )}
              </div>

              <form onSubmit={(e) => handleAddSubcategory(editingCategory, e)} className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="New subcategory"
                  value={subcategoryDrafts[editingCategory.id] ?? ''}
                  onChange={(e) =>
                    setSubcategoryDrafts((prev) => ({ ...prev, [editingCategory.id]: e.target.value }))
                  }
                />
                <button type="submit" className="btn-secondary whitespace-nowrap text-sm">
                  Add
                </button>
              </form>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <input
                  type="checkbox"
                  className="accent-primary-600"
                  checked={editingCategory.showCustomFields}
                  onChange={() => handleToggleShowCustomFields(editingCategory)}
                />
                Custom Fields
              </label>
              <div className={`flex flex-wrap gap-2 ${editingCategory.showCustomFields ? '' : 'opacity-50'}`}>
                {editingCategory.customFields.map((f) =>
                  editingFieldId === f.id ? (
                    <form
                      key={f.id}
                      onSubmit={(e) => handleSaveCustomField(editingCategory, f.id, e)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <input
                        className="input text-xs py-1 px-2 w-32"
                        autoFocus
                        value={editFieldDraft.name}
                        onChange={(e) => setEditFieldDraft((prev) => ({ ...prev, name: e.target.value }))}
                      />
                      <select
                        className="input text-xs py-1 px-2 w-auto"
                        value={editFieldDraft.type}
                        onChange={(e) =>
                          setEditFieldDraft((prev) => ({ ...prev, type: e.target.value as CustomFieldType }))
                        }
                      >
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <button type="submit" className="text-primary-600 hover:text-primary-700 text-xs font-medium">
                        Save
                      </button>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 text-xs"
                        onClick={() => setEditingFieldId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      {f.name} <span className="text-slate-400">({f.type})</span>
                      <button
                        className="text-slate-400 hover:text-primary-600 leading-none"
                        onClick={() => startEditingCustomField(f)}
                        aria-label={`Edit ${f.name}`}
                      >
                        <IconEdit />
                      </button>
                      <button
                        className="text-slate-400 hover:text-red-600 leading-none"
                        onClick={() => handleRemoveCustomField(editingCategory, f.id)}
                        aria-label={`Remove ${f.name}`}
                      >
                        &times;
                      </button>
                    </span>
                  ),
                )}
                {editingCategory.customFields.length === 0 && (
                  <span className="text-xs text-slate-400">No custom fields yet.</span>
                )}
              </div>

              <form onSubmit={(e) => handleAddCustomField(editingCategory, e)} className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="New field name, e.g. Cable Length"
                  value={customFieldDrafts[editingCategory.id]?.name ?? ''}
                  onChange={(e) =>
                    setCustomFieldDrafts((prev) => ({
                      ...prev,
                      [editingCategory.id]: { name: e.target.value, type: prev[editingCategory.id]?.type ?? 'text' },
                    }))
                  }
                />
                <select
                  className="input text-sm w-auto"
                  value={customFieldDrafts[editingCategory.id]?.type ?? 'text'}
                  onChange={(e) =>
                    setCustomFieldDrafts((prev) => ({
                      ...prev,
                      [editingCategory.id]: {
                        name: prev[editingCategory.id]?.name ?? '',
                        type: e.target.value as CustomFieldType,
                      },
                    }))
                  }
                >
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <button type="submit" className="btn-secondary whitespace-nowrap text-sm">
                  Add
                </button>
              </form>
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" className="btn-secondary" onClick={closeEditModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
