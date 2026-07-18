export const FORM_PLATFORM_CONTRACT_VERSION = '1.0.0' as const;

export const JSON_SCHEMA_DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema' as const;

export const ORZ_LOCAL_TIME_FORMAT = 'orz-local-time' as const;

export const FORM_TYPES = ['normal', 'activity', 'joinus'] as const;

export type FormType = (typeof FORM_TYPES)[number];

export type SubmissionAccess =
  | 'anonymous-allowed'
  | 'authentication-required'
  | 'member-required';

export interface FormTypePolicy {
  allowedSubmissionAccess: readonly SubmissionAccess[];
  identityFieldsRequired: boolean;
}

export const FORM_TYPE_POLICIES = {
  normal: {
    allowedSubmissionAccess: [
      'anonymous-allowed',
      'authentication-required',
      'member-required',
    ],
    identityFieldsRequired: false,
  },
  activity: {
    allowedSubmissionAccess: ['authentication-required'],
    identityFieldsRequired: true,
  },
  joinus: {
    allowedSubmissionAccess: ['authentication-required'],
    identityFieldsRequired: true,
  },
} as const satisfies Readonly<Record<FormType, FormTypePolicy>>;

export const SYSTEM_IDENTITY_FIELDS = {
  name: {
    fieldId: 'system.identity.name',
    semanticKey: 'identity.name',
    jsonPointer: '/identity/name',
    format: null,
  },
  email: {
    fieldId: 'system.identity.email',
    semanticKey: 'identity.email',
    jsonPointer: '/identity/email',
    format: 'email',
  },
} as const;

export const FORM_ITEM_SUPPORT = {
  text: { category: 'data', jsonType: 'string', table: true },
  email: {
    category: 'data',
    jsonType: 'string',
    format: 'email',
    table: true,
  },
  number: { category: 'data', jsonType: 'number', table: true },
  integer: { category: 'data', jsonType: 'integer', table: true },
  textarea: { category: 'data', jsonType: 'string', table: true },
  radio: { category: 'data', jsonType: 'string', table: true },
  select: { category: 'data', jsonType: 'string', table: true },
  multiSelect: { category: 'data', jsonType: 'array', table: true },
  checkbox: { category: 'data', jsonType: 'boolean', table: true },
  date: {
    category: 'data',
    jsonType: 'string',
    format: 'date',
    table: true,
  },
  time: {
    category: 'data',
    jsonType: 'string',
    format: ORZ_LOCAL_TIME_FORMAT,
    table: true,
  },
  dateTime: {
    category: 'data',
    jsonType: 'string',
    format: 'date-time',
    table: true,
  },
  cascader: { category: 'data', jsonType: 'array', table: true },
  repeater: { category: 'data', jsonType: 'array', table: 'summary' },
  identityName: { category: 'system', jsonType: 'string', table: true },
  identityEmail: {
    category: 'system',
    jsonType: 'string',
    format: 'email',
    table: true,
  },
  section: { category: 'layout', jsonType: null, table: false },
  markdown: { category: 'layout', jsonType: null, table: false },
} as const;

export type FormItemType = keyof typeof FORM_ITEM_SUPPORT;

export const SUPPORTED_JSON_SCHEMA_KEYWORDS = [
  '$schema',
  '$id',
  'type',
  'title',
  'description',
  'properties',
  'required',
  'additionalProperties',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'enum',
  'const',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'if',
  'then',
  'else',
] as const;

export const FORM_PLATFORM_LIMITS = {
  schemaDocumentBytes: 256 * 1024,
  schemaBundleBytes: 1024 * 1024,
  schemaNodes: 2_000,
  schemaDepth: 12,
  fields: 200,
  objectDepth: 2,
  repeatingArrayDepth: 1,
  arrayItems: 100,
  optionsPerField: 500,
  cascaderDepth: 5,
  patternLength: 256,
  markdownBytes: 64 * 1024,
  requestBodyBytes: 1024 * 1024,
  filterConditions: 20,
  sortRules: 5,
  pageSize: 100,
  synchronousExportRows: 5_000,
  exportRows: 100_000,
  outboundPayloadBytes: 256 * 1024,
} as const;

export type FormPlatformLimit = keyof typeof FORM_PLATFORM_LIMITS;

export const FORM_PLATFORM_NON_GOALS = [
  'self-service-multi-workspace',
  'arbitrary-json-schema-round-trip',
  'remote-dynamic-options',
  'file-upload',
  'payment',
  'electronic-signature',
  'offline-entry',
  'real-time-collaboration',
  'user-supplied-code',
  'formula-engine',
  'general-workflow-engine',
  'plugin-marketplace',
  'webhook-exactly-once',
] as const;

export type FormPlatformNonGoal = (typeof FORM_PLATFORM_NON_GOALS)[number];
