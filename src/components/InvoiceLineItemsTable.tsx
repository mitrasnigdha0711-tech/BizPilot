'use client';

import { useState } from 'react';

export interface LineItemDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceLineItemsTableProps {
  items?: LineItemDraft[];
  onChange: (items: LineItemDraft[]) => void;
  currency?: string;
}

function lineAmount(item: LineItemDraft): number {
  const qty = Number(item.quantity);
  const price = Number(item.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return Math.round(qty * price * 100) / 100;
}

function rowError(item: LineItemDraft): string | null {
  if (!item.description.trim()) return 'Each line item needs a description.';
  const qty = Number(item.quantity);
  const price = Number(item.unitPrice);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
    return 'Quantity must be greater than 0 and unit price cannot be negative.';
  }
  return null;
}

export function validateLineItems(items: LineItemDraft[]): string | null {
  if (items.length === 0) return 'Add at least one line item.';
  for (const item of items) {
    const error = rowError(item);
    if (error) return error;
  }
  return null;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function InvoiceLineItemsTable({
  items: itemsProp,
  onChange,
  currency = 'USD',
}: InvoiceLineItemsTableProps) {
  const items = Array.isArray(itemsProp) ? itemsProp : [];
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const total = Math.round(items.reduce((sum, item) => sum + lineAmount(item), 0) * 100) / 100;
  const formatMoney = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  function updateRow(id: string, patch: Partial<LineItemDraft>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addRow() {
    onChange([...items, { id: makeId(), description: '', quantity: '1', unitPrice: '0' }]);
  }

  function removeRow(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function markTouched(id: string) {
    setTouched((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[32rem] text-sm" data-nexen-id="nx-b96eb75e-0">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-b96eb75e-1">
            <tr data-nexen-id="nx-b96eb75e-2">
              <th className="px-3 py-2 font-medium" data-nexen-id="nx-b96eb75e-3">Description</th>
              <th className="px-3 py-2 font-medium" data-nexen-id="nx-b96eb75e-4">Qty</th>
              <th className="px-3 py-2 font-medium" data-nexen-id="nx-b96eb75e-5">Unit price</th>
              <th className="px-3 py-2 text-right font-medium" data-nexen-id="nx-b96eb75e-6">Amount</th>
              <th className="px-3 py-2" data-nexen-id="nx-b96eb75e-7">
                <span className="sr-only" data-nexen-id="nx-b96eb75e-8">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody data-nexen-id="nx-b96eb75e-9">
            {items.length === 0 && (
              <tr data-nexen-id="nx-b96eb75e-10">
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground" data-nexen-id="nx-b96eb75e-11">
                  No line items yet.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const error = touched[item.id] ? rowError(item) : null;
              return (
                <tr data-nexen-component="nx_components_InvoiceLineItemsTable" key={item.id} className="border-t border-border align-top" data-nexen-id="nx-b96eb75e-12">
                  <td className="px-3 py-2" data-nexen-id="nx-b96eb75e-13">
                    <input
                      aria-label="Description"
                      className={inputClass}
                      value={item.description}
                      onChange={(e) => updateRow(item.id, { description: e.target.value })}
                      onBlur={() => markTouched(item.id)}
                     data-nexen-id="nx-b96eb75e-14"/>
                    {error && <p className="mt-1 text-xs text-destructive" data-nexen-id="nx-b96eb75e-15">{error}</p>}
                  </td>
                  <td className="px-3 py-2" data-nexen-id="nx-b96eb75e-16">
                    <input
                      aria-label="Quantity"
                      type="number"
                      min="0"
                      step="any"
                      className={inputClass}
                      value={item.quantity}
                      onChange={(e) => updateRow(item.id, { quantity: e.target.value })}
                      onBlur={() => markTouched(item.id)}
                     data-nexen-id="nx-b96eb75e-17"/>
                  </td>
                  <td className="px-3 py-2" data-nexen-id="nx-b96eb75e-18">
                    <input
                      aria-label="Unit price"
                      type="number"
                      min="0"
                      step="any"
                      className={inputClass}
                      value={item.unitPrice}
                      onChange={(e) => updateRow(item.id, { unitPrice: e.target.value })}
                      onBlur={() => markTouched(item.id)}
                     data-nexen-id="nx-b96eb75e-19"/>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-foreground" data-nexen-id="nx-b96eb75e-20">
                    {formatMoney(lineAmount(item))}
                  </td>
                  <td className="px-3 py-2 text-right" data-nexen-id="nx-b96eb75e-21">
                    <button
                      type="button"
                      onClick={() => removeRow(item.id)}
                      className="rounded-[var(--radius)] px-2 py-1.5 text-xs text-destructive hover:bg-muted"
                     data-nexen-id="nx-b96eb75e-22">
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border">
            <tr data-nexen-id="nx-b96eb75e-23">
              <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground" data-nexen-id="nx-b96eb75e-24">
                Total
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold text-foreground" data-nexen-id="nx-b96eb75e-25">
                {formatMoney(total)}
              </td>
              <td  data-nexen-id="nx-b96eb75e-26"/>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
       data-nexen-id="nx-b96eb75e-27">
        Add line item
      </button>
    </div>
  );
}