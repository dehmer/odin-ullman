const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base'})
export const compare = fn => (a, b) => collator.compare(fn(a), fn(b))
