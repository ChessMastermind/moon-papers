export const ialSubjectMapping = {
  // IAL Prefixes
  'WAA': 'Arabic', 'WBI': 'Biology', 'WCH': 'Chemistry', 'WPH': 'Physics',
  'WMA': 'Mathematics', 'WAC': 'Accounting', 'WBS': 'Business Studies',
  'WEC': 'Economics', 'WGE': 'Geography', 'WHI': 'History',
  'WIT': 'Information Technology', 'WLA': 'Law', 'WPS': 'Psychology',
  'WEN': 'English Language', 'WET': 'English Literature', 'WFR': 'French',
  'WGN': 'German', 'WSP': 'Spanish', 'WGK': 'Greek', 'WST': 'Statistics',
  'WDM': 'Decision Mathematics', 'WFM': 'Further Mathematics',
  'WPM': 'Pure Mathematics', 'WME': 'Mechanics',
};

// New IGCSE Mapping
export const edexcelIgcseMapping = {
  // Original Codes
  '4AC': 'Accounting',
  '4BI': 'Biology',
  '4CH': 'Chemistry',
  '4CP': 'Computer Science',
  '4EC': 'Economics',
  '4EA': 'English Language A',
  '4EB': 'English Language B',
  '4ET': 'English Literature',
  '4GE': 'Geography',
  '4HI': 'History',
  '4IT': 'Information Technology',
  '4MA': 'Mathematics A',
  '4MB': 'Mathematics B',
  '4PM': 'Further Pure Mathematics',
  '4PH': 'Physics',
  '4PS': 'Psychology',
  '4RS': 'Religious Studies',
  '4SI': 'Science (Single Award)',
  '4SD': 'Science (Double Award)',
  '4SS': 'Science (Double Award)',
  '4BS': 'Business',
  '4HB': 'Human Biology',
  '4CN': 'Chinese',
  '4FR': 'French',
  '4GN': 'German',
  '4SP': 'Spanish',
  '4TA': 'Tamil',
  '4GK': 'Greek',
  '4AR': 'Arabic (First Language)',
  '4AA': 'Arabic (Foreign Language)',
  
  // New Missing Codes
  '4BA': 'Bangladesh Studies',
  '4CM': 'Commerce',
  '4SW': 'Swahili',
  
  // New International/Modular Codes (4W...)
  '4WA': 'Accounting (International)',
  '4WC': 'Commerce (International)',
  '4WE': 'Economics (International)',
  '4WG': 'Geography (International)',
  '4WH': 'History (International)',
  '4WP': 'Physics (International)',
};

export const getIALSubjectName = (unitCode) => {
  if (!unitCode) return 'Unknown Subject';
  
  // Handle IGCSE (starts with 4)
  if (unitCode.startsWith('4')) {
    const prefix = unitCode.substring(0, 3);
    return edexcelIgcseMapping[prefix] || unitCode;
  }

  // Handle IAL (prefix is 3 letters)
  const prefix = unitCode.substring(0, 3);
  return ialSubjectMapping[prefix] || unitCode;
};