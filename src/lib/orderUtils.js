// Reassigns orderField to 1..N after a delete. Applied client-side;
// no DB unique constraints exist on ordering columns.
export function renumberItems(items, orderField) {
  return items.map((item, i) => ({ ...item, [orderField]: i + 1 }))
}
