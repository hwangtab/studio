export const ALL_LEAD_EVENT_NAMES = [
  'lead_click_kakao',
  'lead_click_phone',
  'lead_click_naver_map',
  'lead_submit_success',
  'lead_submit_error',
  'lead_form_start',
  'lead_form_abandon',
  'lead_form_field_error',
] as const;

export const QUALIFIED_LEAD_EVENT_NAMES = [
  'lead_click_kakao',
  'lead_click_phone',
  'lead_click_naver_map',
  'lead_submit_success',
] as const;

const FORM_ERROR_EVENT_NAMES = [
  'lead_submit_error',
  'lead_form_field_error',
  'lead_form_abandon',
] as const;

export type LeadEventNameForReport = typeof ALL_LEAD_EVENT_NAMES[number];

export interface Ga4SourceSessionRow {
  source: string;
  medium: string;
  sessions: number;
  bounceRate: number;
}

export interface Ga4LeadEventRow {
  source: string;
  medium: string;
  eventName: string;
  eventCount: number;
}

export type LeadSourceCsvRow = [string, string, number, string, number, number, number];

const sourceKey = (source: string, medium: string) => `${source}\u0000${medium}`;

export const buildLeadSourceRows = (
  sourceRows: Ga4SourceSessionRow[],
  leadEventRows: Ga4LeadEventRow[]
): LeadSourceCsvRow[] => {
  const leadEventsBySource = new Map<string, { leadEvents: number; qualifiedLeads: number; formErrors: number }>();
  const qualifiedNames = new Set<string>(QUALIFIED_LEAD_EVENT_NAMES);
  const formErrorNames = new Set<string>(FORM_ERROR_EVENT_NAMES);

  for (const row of leadEventRows) {
    const key = sourceKey(row.source, row.medium);
    const current = leadEventsBySource.get(key) || { leadEvents: 0, qualifiedLeads: 0, formErrors: 0 };
    current.leadEvents += row.eventCount;
    if (qualifiedNames.has(row.eventName)) current.qualifiedLeads += row.eventCount;
    if (formErrorNames.has(row.eventName)) current.formErrors += row.eventCount;
    leadEventsBySource.set(key, current);
  }

  return sourceRows.map((row) => {
    const counts = leadEventsBySource.get(sourceKey(row.source, row.medium)) || {
      leadEvents: 0,
      qualifiedLeads: 0,
      formErrors: 0,
    };

    return [
      row.source,
      row.medium,
      row.sessions,
      row.bounceRate.toFixed(3),
      counts.leadEvents,
      counts.qualifiedLeads,
      counts.formErrors,
    ];
  });
};
