// Analyzr-style tags and options

export const VIEW_TAGS = [
  { value: '', label: 'None' },
  { value: 'FO', label: 'Face On' },
  { value: 'DL', label: 'Down the Line' },
  { value: 'OV', label: 'Overhead' },
  { value: 'RE', label: 'Rear' },
  { value: 'OT', label: 'Other' },
];

export const COLOR_LABELS = [
  { value: '', label: 'None' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'grey', label: 'Grey' },
];

export const DEFAULT_STUDENTS = [
  {
    id: 1,
    name: 'Demo Student',
    email: 'demo@golf.com',
    phone: '555-0123',
    notes: 'Working on takeaway path.',
    handicap: '',
    goals: '',
    distances: '',
    physical_limits: '',
    lessons: [
      {
        id: 1,
        lesson_date: new Date().toISOString().slice(0, 10),
        notes: '',
        swings: [],
      },
    ],
  },
];

export const STORAGE_KEY = 'swingstr_data';
export const STORAGE_KEY_LEGACY = 'swingstr_students';
