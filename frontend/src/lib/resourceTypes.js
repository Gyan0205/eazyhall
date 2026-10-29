export const RESOURCE_TYPES = [
  { value: 'Hall', label: 'Seminar hall' },
  { value: 'Lab', label: 'Lab' },
  { value: 'Court', label: 'Sports court' },
  { value: 'Equipment', label: 'Equipment' },
];

export const typeLabel = (type) => RESOURCE_TYPES.find(t => t.value === type)?.label || type;
