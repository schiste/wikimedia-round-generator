export function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}
