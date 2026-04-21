// api/_lib/tools/index.ts
import { getKpiSummary }  from './get_kpi_summary.js';
import { getTopN }        from './get_top_n.js';
import { getTimeSeries }  from './get_time_series.js';
import { comparePeriods } from './compare_periods.js';
import { getFunnel }      from './get_funnel.js';
import { runSafeSql }     from './run_safe_sql.js';

export const TOOL_FUNCTIONS = {
  get_kpi_summary: getKpiSummary,
  get_top_n:       getTopN,
  get_time_series: getTimeSeries,
  compare_periods: comparePeriods,
  get_funnel:      getFunnel,
  run_safe_sql:    runSafeSql,
} as const;

export type ToolName = keyof typeof TOOL_FUNCTIONS;

export const STATUS_MESSAGE: Record<ToolName, string> = {
  get_kpi_summary: 'Crunching the numbers…',
  get_top_n:       'Finding the top performers…',
  get_time_series: 'Looking at the trend…',
  compare_periods: 'Comparing time periods…',
  get_funnel:      'Walking the funnel…',
  run_safe_sql:    'Pulling custom data…',
};

const FILTERS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    affiliate_id:       { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    affiliate_name:     { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    company_name:       { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    country:            { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    player_country:     { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    campaign:           { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    brand:              { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    am:                 { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    source:             { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    problematic_source: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    period:             { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    ftd_month:          { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'YYYY-MM (derived from FD_Date)' },
    date_from:          { type: 'string', description: 'YYYY-MM-DD' },
    date_to:            { type: 'string', description: 'YYYY-MM-DD' },
  },
} as const;

const DIM_ENUM = {
  type: 'string',
  enum: ['affiliate_id','affiliate_name','company_name','country','player_country','campaign','brand','am','source','problematic_source'],
} as const;

const METRIC_ENUM = {
  type: 'string',
  enum: ['revenue','cost','profit','roi','ftds','clicks','registrations',
         'cpa','conversion_rate','casino_real_ngr','sb_real_ngr','flats_and_adjustments'],
} as const;

export const TOOL_SCHEMAS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_kpi_summary',
      description: 'Aggregated KPIs (revenue, cost, profit, ROI, FTDs, CPA, etc.) over a filter set. Optionally grouped by one or more dimensions.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          filters:  FILTERS_SCHEMA,
          group_by: { type: 'array', items: DIM_ENUM, default: [] },
        },
        required: ['filters'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_top_n',
      description: 'Top N rows by a metric, grouped by a single dimension.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dimension: DIM_ENUM,
          metric:    METRIC_ENUM,
          filters:   FILTERS_SCHEMA,
          limit:     { type: 'integer', minimum: 1, maximum: 50 },
          order:     { type: 'string', enum: ['desc','asc'], default: 'desc' },
        },
        required: ['dimension','metric','filters','limit','order'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_time_series',
      description: 'Time-bucketed series of one metric (day / week / month).',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          metric:      METRIC_ENUM,
          granularity: { type: 'string', enum: ['day','week','month'] },
          filters:     FILTERS_SCHEMA,
          max_points:  { type: 'integer', minimum: 1, maximum: 180, default: 90 },
        },
        required: ['metric','granularity','filters'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_periods',
      description: 'Side-by-side aggregates for two date ranges, with absolute and percentage deltas.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          filters: FILTERS_SCHEMA,
          period_a: {
            type: 'object', additionalProperties: false,
            properties: { from: { type: 'string' }, to: { type: 'string' } },
            required: ['from','to'],
          },
          period_b: {
            type: 'object', additionalProperties: false,
            properties: { from: { type: 'string' }, to: { type: 'string' } },
            required: ['from','to'],
          },
          metrics: { type: 'array', items: METRIC_ENUM, minItems: 1 },
        },
        required: ['filters','period_a','period_b','metrics'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_funnel',
      description: 'Clicks → registrations → FTDs counts and conversion percentages, optionally grouped by one dimension.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          filters:  FILTERS_SCHEMA,
          group_by: DIM_ENUM,
        },
        required: ['filters'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_safe_sql',
      description: 'LAST-RESORT escape hatch for ad-hoc SELECT-only SQL against performance_records. Only use when no other tool can answer the question. State your reason.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query:  { type: 'string', description: 'A single SELECT statement against performance_records' },
          reason: { type: 'string', description: 'Why none of the other tools work for this question' },
        },
        required: ['query','reason'],
      },
    },
  },
];
