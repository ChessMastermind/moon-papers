export const ialSubjectMapping = {
  'WAA': 'Arabic',
  'WBI': 'Biology',
  'WCH': 'Chemistry',
  'WPH': 'Physics',
  'WMA': 'Mathematics',
  'WAC': 'Accounting',
  'WBS': 'Business Studies',
  'WEC': 'Economics',
  'WGE': 'Geography',
  'WHI': 'History',
  'WIT': 'Information Technology',
  'WLA': 'Law',
  'WPS': 'Psychology',
  'WEN': 'English Language',
  'WET': 'English Literature',
  'WFR': 'French',
  'WGN': 'German',
  'WSP': 'Spanish',
  'WGK': 'Greek',
  'WGK': 'Greek',
  'WST': 'Statistics',
  'WDM': 'Decision Mathematics',
  'WFM': 'Further Mathematics',
  'WPM': 'Pure Mathematics',
  'WME': 'Mechanics',
};

export const getIALSubjectName = (unitCode) => {
  if (!unitCode) return 'Unknown Subject';
  // Most IAL codes start with W followed by 2 letters for subject
  // e.g. WBI11 -> WBI -> Biology
  // Some might be different, but this covers the majority
  const prefix = unitCode.substring(0, 3);
  return ialSubjectMapping[prefix] || unitCode;
};
