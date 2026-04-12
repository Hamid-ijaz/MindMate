#!/usr/bin/env node

'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const { getApps, initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { PrismaClient } = require('@prisma/client');

const SUPPORTED_ENTITIES = ['users', 'tasks', 'notes', 'accomplishments', 'milestones'];
const DEFAULT_BATCH_SIZE = 100;

const VALID_MILESTONE_TYPES = new Set([
  'birthday',
  'anniversary',
  'work_anniversary',
  'graduation',
  'exam_passed',
  'achievement',
  'milestone',
  'purchase',
  'relationship',
  'travel',
  'custom',
]);

const VALID_MILESTONE_RECURRING_FREQUENCIES = new Set(['yearly', 'monthly']);

let prismaPool = null;

function printUsage() {
  console.log([
    'Firestore -> Postgres importer',
    '',
    'Usage:',
    '  npm run import:firestore:postgres -- [options]',
    '',
    'Options:',
    '  --dry-run               Read and validate, but do not write to Postgres',
    '  --entities=a,b,c        Comma-separated list of entities to import',
    `                          Supported: ${SUPPORTED_ENTITIES.join(', ')}`,
    `  --batch-size=N          Number of records processed concurrently per batch (default: ${DEFAULT_BATCH_SIZE})`,
    '  --help                  Show this message',
    '',
    'Credential env (one of):',
    '  1) FIREBASE_SERVICE_ACCOUNT_JSON',
    '  2) FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY',
    '  3) GOOGLE_APPLICATION_CREDENTIALS (ADC)',
    '',
    'Required Postgres env:',
    '  DATABASE_URL',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    entities: [...SUPPORTED_ENTITIES],
    batchSize: DEFAULT_BATCH_SIZE,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run' || arg === '-n') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg.startsWith('--entities=')) {
      options.entities = parseEntities(arg.slice('--entities='.length));
      continue;
    }

    if (arg === '--entities') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --entities');
      }

      options.entities = parseEntities(next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseBatchSize(arg.slice('--batch-size='.length));
      continue;
    }

    if (arg === '--batch-size') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --batch-size');
      }

      options.batchSize = parseBatchSize(next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseEntities(rawValue) {
  const entities = rawValue
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (entities.length === 0) {
    throw new Error('At least one entity must be provided in --entities');
  }

  const unsupported = entities.filter((entity) => !SUPPORTED_ENTITIES.includes(entity));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported entities: ${unsupported.join(', ')}`);
  }

  return [...new Set(entities)];
}

function parseBatchSize(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid batch size: ${rawValue}`);
  }

  return parsed;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toDate(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const candidate = value.toDate();
    return candidate instanceof Date && !Number.isNaN(candidate.getTime()) ? candidate : undefined;
  }

  if (isPlainObject(value) && typeof value.seconds === 'number') {
    const milliseconds = (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
    return toDate(milliseconds);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 100000000000 ? value * 1000 : value;
    const candidate = new Date(milliseconds);
    return Number.isNaN(candidate.getTime()) ? undefined : candidate;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      return toDate(asNumber);
    }

    const candidate = new Date(trimmed);
    return Number.isNaN(candidate.getTime()) ? undefined : candidate;
  }

  return undefined;
}

function toOptionalBoolean(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function toBoolean(value, fallback) {
  const normalized = toOptionalBoolean(value);
  return normalized === undefined ? fallback : normalized;
}

function toOptionalInt(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNonNegativeInt(value, fallback) {
  const parsed = toOptionalInt(value);
  if (parsed === undefined) {
    return fallback;
  }

  return parsed < 0 ? fallback : parsed;
}

function toPositiveInt(value, fallback) {
  const parsed = toOptionalInt(value);
  if (parsed === undefined || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function toStringValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

function toNonEmptyString(value) {
  const text = toStringValue(value);
  if (text === undefined) {
    return undefined;
  }

  const trimmed = text.trim();
  return trimmed || undefined;
}

function toJsonSafe(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .map((item) => toJsonSafe(item))
      .filter((item) => item !== undefined);
    return sanitized;
  }

  if (isPlainObject(value)) {
    const output = {};

    for (const [key, child] of Object.entries(value)) {
      const sanitized = toJsonSafe(child);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }

    return output;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'object') {
    if (typeof value.path === 'string') {
      return value.path;
    }

    if (typeof value.toString === 'function') {
      const stringValue = value.toString();
      if (stringValue && stringValue !== '[object Object]') {
        return stringValue;
      }
    }

    return undefined;
  }

  return value;
}

function sanitizeForPrisma(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = [];
    for (const item of value) {
      const sanitizedItem = sanitizeForPrisma(item);
      if (sanitizedItem !== undefined) {
        sanitizedArray.push(sanitizedItem);
      }
    }
    return sanitizedArray;
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      const sanitized = sanitizeForPrisma(child);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }
    return output;
  }

  return value;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeMilestoneType(value) {
  if (!value) {
    return 'custom';
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return VALID_MILESTONE_TYPES.has(normalized) ? normalized : 'custom';
}

function normalizeMilestoneRecurringFrequency(value) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return VALID_MILESTONE_RECURRING_FREQUENCIES.has(normalized) ? normalized : undefined;
}

function toMappedRecord(record) {
  return { record };
}

function toSkipRecord(reason) {
  return { skipReason: reason };
}

function deriveNameFromEmail(email) {
  const localPart = email.split('@')[0] || '';
  const words = localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return { firstName: 'Unknown', lastName: 'User' };
  }

  const capitalize = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

  const firstName = capitalize(words[0]);
  const lastName = words.length > 1 ? words.slice(1).map(capitalize).join(' ') : 'User';

  return { firstName, lastName };
}

function inferUserEmailFromPath(docPath) {
  const segments = docPath.split('/');
  const usersIndex = segments.indexOf('users');
  if (usersIndex === -1) {
    return undefined;
  }

  return segments[usersIndex + 1] || undefined;
}

function parseServiceAccountFromEnv(rawJson) {
  try {
    const parsed = JSON.parse(rawJson);
    const projectId = parsed.projectId || parsed.project_id;
    const clientEmail = parsed.clientEmail || parsed.client_email;
    const privateKeyRaw = parsed.privateKey || parsed.private_key;

    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing projectId/clientEmail/privateKey');
    }

    return {
      projectId,
      clientEmail,
      privateKey: String(privateKeyRaw).replace(/\\n/g, '\n'),
    };
  } catch (error) {
    throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`);
  }
}

function initializeFirebase() {
  if (getApps().length > 0) {
    return;
  }

  const inlineServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineServiceAccount) {
    const serviceAccount = parseServiceAccountFromEnv(inlineServiceAccount);
    initializeApp({ credential: cert(serviceAccount) });
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    return;
  }

  initializeApp({ credential: applicationDefault() });
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  try {
    const { PrismaPg } = require('@prisma/adapter-pg');
    const { Pool } = require('pg');

    prismaPool = new Pool({ connectionString: databaseUrl });
    return new PrismaClient({ adapter: new PrismaPg(prismaPool) });
  } catch {
    return new PrismaClient();
  }
}

function createStats() {
  return {
    fetched: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
  };
}

function createErrorCollector(limit = 20) {
  const errors = [];

  return {
    push(entity, docPath, error) {
      if (errors.length >= limit) {
        return;
      }

      errors.push({
        entity,
        docPath,
        message: error instanceof Error ? error.message : String(error),
      });
    },
    getAll() {
      return errors;
    },
  };
}

function mapUserDocument(docSnap) {
  const data = docSnap.data() || {};
  const email = toNonEmptyString(data.email) || toNonEmptyString(docSnap.id);

  if (!email || !email.includes('@')) {
    return toSkipRecord('missing valid email');
  }

  const fallbackName = deriveNameFromEmail(email);
  const createdAt = toDate(data.createdAt) || new Date();
  const updatedAt = toDate(data.updatedAt) || createdAt;

  return toMappedRecord({
    email,
    firstName: toNonEmptyString(data.firstName) || fallbackName.firstName,
    lastName: toNonEmptyString(data.lastName) || fallbackName.lastName,
    phone: toNonEmptyString(data.phone),
    dob: toNonEmptyString(data.dob),
    password: toStringValue(data.password),
    createdAt,
    updatedAt,
  });
}

function mapTaskDocument(docSnap) {
  const data = docSnap.data() || {};
  const userEmail = toNonEmptyString(data.userEmail) || toNonEmptyString(data.userId);

  if (!userEmail || !userEmail.includes('@')) {
    return toSkipRecord('missing valid userEmail');
  }

  const createdAt = toDate(data.createdAt) || new Date();
  const updatedAt = toDate(data.updatedAt);
  const completedAt = toDate(data.completedAt)
    || (toBoolean(data.completed, false) ? (updatedAt || createdAt) : undefined);

  return toMappedRecord({
    id: docSnap.id,
    userEmail,
    title: toNonEmptyString(data.title) || 'Untitled task',
    description: toStringValue(data.description),
    category: toNonEmptyString(data.category) || 'General',
    priority: toNonEmptyString(data.priority) || 'Medium',
    duration: toPositiveInt(data.duration, 30),
    createdAt,
    updatedAt,
    rejectionCount: toNonNegativeInt(data.rejectionCount, 0),
    lastRejectedAt: toDate(data.lastRejectedAt),
    isMuted: toBoolean(data.isMuted, false),
    isArchived: toBoolean(data.isArchived, false),
    completedAt,
    parentId: toNonEmptyString(data.parentId),
    reminderAt: toDate(data.reminderAt),
    onlyNotifyAtReminder: toBoolean(data.onlyNotifyAtReminder, false),
    notifiedAt: toDate(data.notifiedAt),
    recurrence: toJsonSafe(data.recurrence),
    scheduledAt: toDate(data.scheduledAt),
    scheduledEndAt: toDate(data.scheduledEndAt),
    isTimeBlocked: toOptionalBoolean(data.isTimeBlocked),
    calendarEventId: toNonEmptyString(data.calendarEventId),
    pomodoroSessions: toOptionalInt(data.pomodoroSessions),
    estimatedPomodoros: toOptionalInt(data.estimatedPomodoros),
    timeSpent: toOptionalInt(data.timeSpent),
    isAllDay: toOptionalBoolean(data.isAllDay),
    calendarColor: toNonEmptyString(data.calendarColor),
    location: toNonEmptyString(data.location),
    attendees: toJsonSafe(data.attendees),
    isRecurring: toOptionalBoolean(data.isRecurring),
    originalTaskId: toNonEmptyString(data.originalTaskId),
  });
}

function mapNoteDocument(docSnap) {
  const data = docSnap.data() || {};
  const userEmail = toNonEmptyString(data.userEmail) || inferUserEmailFromPath(docSnap.ref.path);

  if (!userEmail || !userEmail.includes('@')) {
    return toSkipRecord('missing valid userEmail');
  }

  const createdAt = toDate(data.createdAt) || new Date();
  const updatedAt = toDate(data.updatedAt) || createdAt;

  return toMappedRecord({
    id: docSnap.id,
    userEmail,
    title: toNonEmptyString(data.title) || 'Untitled note',
    content: toStringValue(data.content) || '',
    imageUrl: data.imageUrl === null ? null : toNonEmptyString(data.imageUrl),
    audioUrl: data.audioUrl === null ? null : toNonEmptyString(data.audioUrl),
    color: toNonEmptyString(data.color),
    fontSize: toOptionalInt(data.fontSize),
    isArchived: toBoolean(data.isArchived, false),
    createdAt,
    updatedAt,
  });
}

function mapAccomplishmentDocument(docSnap) {
  const data = docSnap.data() || {};
  const userEmail = toNonEmptyString(data.userEmail) || inferUserEmailFromPath(docSnap.ref.path);

  if (!userEmail || !userEmail.includes('@')) {
    return toSkipRecord('missing valid userEmail');
  }

  const createdAt = toDate(data.createdAt) || new Date();

  return toMappedRecord({
    id: docSnap.id,
    userEmail,
    date: toNonEmptyString(data.date) || formatDateOnly(createdAt),
    content: toStringValue(data.content) || 'Imported accomplishment',
    createdAt,
  });
}

function mapMilestoneDocument(docSnap) {
  const data = docSnap.data() || {};
  const userEmail = toNonEmptyString(data.userEmail) || inferUserEmailFromPath(docSnap.ref.path);

  if (!userEmail || !userEmail.includes('@')) {
    return toSkipRecord('missing valid userEmail');
  }

  const createdAt = toDate(data.createdAt) || new Date();
  const updatedAt = toDate(data.updatedAt) || createdAt;
  const originalDate = toDate(data.originalDate) || createdAt;
  const isRecurring = toBoolean(data.isRecurring, false);

  return toMappedRecord({
    id: docSnap.id,
    userEmail,
    title: toNonEmptyString(data.title) || 'Untitled milestone',
    description: toStringValue(data.description),
    type: normalizeMilestoneType(toNonEmptyString(data.type) || 'custom'),
    originalDate,
    isRecurring,
    recurringFrequency: isRecurring ? normalizeMilestoneRecurringFrequency(toNonEmptyString(data.recurringFrequency)) : undefined,
    icon: toNonEmptyString(data.icon),
    color: toNonEmptyString(data.color),
    isActive: toBoolean(data.isActive, true),
    notificationSettings: toJsonSafe(data.notificationSettings),
    lastNotifiedAt: toDate(data.lastNotifiedAt),
    nextAnniversaryDate: toDate(data.nextAnniversaryDate),
    createdAt,
    updatedAt,
  });
}

async function upsertRecord(prismaModel, uniqueField, record, immutableFields) {
  const createData = sanitizeForPrisma(record);
  const updateData = sanitizeForPrisma({ ...record });

  for (const field of immutableFields) {
    delete updateData[field];
  }

  await prismaModel.upsert({
    where: {
      [uniqueField]: record[uniqueField],
    },
    create: createData,
    update: updateData,
  });
}

async function ensureUserExists(prisma, userEmail, ensuredUsers, dryRun) {
  if (!userEmail || ensuredUsers.has(userEmail)) {
    return;
  }

  ensuredUsers.add(userEmail);

  if (dryRun) {
    return;
  }

  const fallbackName = deriveNameFromEmail(userEmail);
  const now = new Date();

  await prisma.user.upsert({
    where: { email: userEmail },
    create: sanitizeForPrisma({
      email: userEmail,
      firstName: fallbackName.firstName,
      lastName: fallbackName.lastName,
      createdAt: now,
      updatedAt: now,
    }),
    update: {},
  });
}

async function importSimpleEntity({
  entityName,
  docs,
  mapDocument,
  upsertDocument,
  batchSize,
  dryRun,
  prisma,
  ensuredUsers,
  errorCollector,
}) {
  const stats = createStats();
  stats.fetched = docs.length;

  for (let offset = 0; offset < docs.length; offset += batchSize) {
    const batch = docs.slice(offset, offset + batchSize);

    await Promise.all(batch.map(async (docSnap) => {
      try {
        const mapped = mapDocument(docSnap);
        if (!mapped.record) {
          stats.skipped += 1;
          return;
        }

        if (entityName !== 'users') {
          await ensureUserExists(prisma, mapped.record.userEmail, ensuredUsers, dryRun);
        }

        if (!dryRun) {
          await upsertDocument(mapped.record);
        }

        if (entityName === 'users') {
          ensuredUsers.add(mapped.record.email);
        }

        stats.upserted += 1;
      } catch (error) {
        stats.failed += 1;
        errorCollector.push(entityName, docSnap.ref.path, error);
      }
    }));

    console.log(`[${entityName}] processed ${Math.min(offset + batch.length, docs.length)}/${docs.length}`);
  }

  return stats;
}

async function importTasks({
  docs,
  batchSize,
  dryRun,
  prisma,
  ensuredUsers,
  errorCollector,
}) {
  const stats = createStats();
  stats.fetched = docs.length;

  const parentLinks = [];
  const knownTaskIds = new Set();

  for (let offset = 0; offset < docs.length; offset += batchSize) {
    const batch = docs.slice(offset, offset + batchSize);

    await Promise.all(batch.map(async (docSnap) => {
      try {
        const mapped = mapTaskDocument(docSnap);
        if (!mapped.record) {
          stats.skipped += 1;
          return;
        }

        const taskRecord = mapped.record;
        knownTaskIds.add(taskRecord.id);

        await ensureUserExists(prisma, taskRecord.userEmail, ensuredUsers, dryRun);

        if (taskRecord.parentId) {
          parentLinks.push({
            taskId: taskRecord.id,
            parentId: taskRecord.parentId,
            docPath: docSnap.ref.path,
          });
        }

        if (!dryRun) {
          const createPayload = { ...taskRecord, parentId: undefined };
          await upsertRecord(prisma.task, 'id', createPayload, ['id']);
        }

        stats.upserted += 1;
      } catch (error) {
        stats.failed += 1;
        errorCollector.push('tasks', docSnap.ref.path, error);
      }
    }));

    console.log(`[tasks] processed ${Math.min(offset + batch.length, docs.length)}/${docs.length}`);
  }

  const parentLinkStats = {
    discovered: parentLinks.length,
    linked: 0,
    skipped: 0,
    failed: 0,
  };

  if (parentLinks.length > 0) {
    const parentTaskExistence = new Map();

    const doesTaskExist = async (taskId) => {
      if (knownTaskIds.has(taskId)) {
        return true;
      }

      if (parentTaskExistence.has(taskId)) {
        return parentTaskExistence.get(taskId);
      }

      const existing = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true },
      });
      const exists = Boolean(existing);
      parentTaskExistence.set(taskId, exists);
      return exists;
    };

    for (let offset = 0; offset < parentLinks.length; offset += batchSize) {
      const batch = parentLinks.slice(offset, offset + batchSize);

      await Promise.all(batch.map(async (link) => {
        try {
          const parentExists = await doesTaskExist(link.parentId);
          if (!parentExists) {
            parentLinkStats.skipped += 1;
            return;
          }

          if (!dryRun) {
            await prisma.task.update({
              where: { id: link.taskId },
              data: sanitizeForPrisma({ parentId: link.parentId }),
            });
          }

          parentLinkStats.linked += 1;
        } catch (error) {
          parentLinkStats.failed += 1;
          errorCollector.push('tasks', link.docPath, error);
        }
      }));
    }
  }

  return { stats, parentLinkStats };
}

async function fetchMilestoneDocuments(db) {
  const [collectionGroupSnapshot, rootCollectionSnapshot] = await Promise.all([
    db.collectionGroup('milestones').get(),
    db.collection('milestones').get(),
  ]);

  const byPath = new Map();

  for (const docSnap of collectionGroupSnapshot.docs) {
    byPath.set(docSnap.ref.path, docSnap);
  }

  for (const docSnap of rootCollectionSnapshot.docs) {
    byPath.set(docSnap.ref.path, docSnap);
  }

  return Array.from(byPath.values());
}

function printEntitySummary(entity, stats) {
  console.log(`- ${entity}: fetched=${stats.fetched}, upserted=${stats.upserted}, skipped=${stats.skipped}, failed=${stats.failed}`);
}

async function main() {
  let prisma;

  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      printUsage();
      return;
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }

    initializeFirebase();

    const firestore = getFirestore();
    prisma = createPrismaClient();

    const startedAt = Date.now();
    const ensuredUsers = new Set();
    const errorCollector = createErrorCollector();
    const summaries = {};

    console.log('Starting Firestore -> Postgres import');
    console.log(`Mode: ${options.dryRun ? 'dry-run (no writes)' : 'live import'}`);
    console.log(`Entities: ${options.entities.join(', ')}`);
    console.log(`Batch size: ${options.batchSize}`);

    if (options.entities.includes('users')) {
      const usersSnapshot = await firestore.collection('users').get();
      summaries.users = await importSimpleEntity({
        entityName: 'users',
        docs: usersSnapshot.docs,
        mapDocument: mapUserDocument,
        upsertDocument: async (record) => {
          await upsertRecord(prisma.user, 'email', record, ['email']);
        },
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        prisma,
        ensuredUsers,
        errorCollector,
      });
    }

    if (options.entities.includes('tasks')) {
      const tasksSnapshot = await firestore.collection('tasks').get();
      const { stats, parentLinkStats } = await importTasks({
        docs: tasksSnapshot.docs,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        prisma,
        ensuredUsers,
        errorCollector,
      });

      summaries.tasks = stats;
      summaries.tasksParentLinks = parentLinkStats;
    }

    if (options.entities.includes('notes')) {
      const notesSnapshot = await firestore.collection('notes').get();
      summaries.notes = await importSimpleEntity({
        entityName: 'notes',
        docs: notesSnapshot.docs,
        mapDocument: mapNoteDocument,
        upsertDocument: async (record) => {
          await upsertRecord(prisma.note, 'id', record, ['id']);
        },
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        prisma,
        ensuredUsers,
        errorCollector,
      });
    }

    if (options.entities.includes('accomplishments')) {
      const accomplishmentsSnapshot = await firestore.collection('accomplishments').get();
      summaries.accomplishments = await importSimpleEntity({
        entityName: 'accomplishments',
        docs: accomplishmentsSnapshot.docs,
        mapDocument: mapAccomplishmentDocument,
        upsertDocument: async (record) => {
          await upsertRecord(prisma.accomplishment, 'id', record, ['id']);
        },
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        prisma,
        ensuredUsers,
        errorCollector,
      });
    }

    if (options.entities.includes('milestones')) {
      const milestoneDocs = await fetchMilestoneDocuments(firestore);
      summaries.milestones = await importSimpleEntity({
        entityName: 'milestones',
        docs: milestoneDocs,
        mapDocument: mapMilestoneDocument,
        upsertDocument: async (record) => {
          await upsertRecord(prisma.milestone, 'id', record, ['id']);
        },
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        prisma,
        ensuredUsers,
        errorCollector,
      });
    }

    const completedAt = Date.now();
    const durationSeconds = ((completedAt - startedAt) / 1000).toFixed(2);

    console.log('');
    console.log('Import summary');
    for (const entity of options.entities) {
      if (summaries[entity]) {
        printEntitySummary(entity, summaries[entity]);
      }
    }

    if (summaries.tasksParentLinks) {
      console.log(
        `- tasks parent links: discovered=${summaries.tasksParentLinks.discovered}, linked=${summaries.tasksParentLinks.linked}, skipped=${summaries.tasksParentLinks.skipped}, failed=${summaries.tasksParentLinks.failed}`,
      );
    }

    const collectedErrors = errorCollector.getAll();
    if (collectedErrors.length > 0) {
      console.log('');
      console.log(`Encountered ${collectedErrors.length} errors (showing capped list):`);
      for (const entry of collectedErrors) {
        console.log(`  - [${entry.entity}] ${entry.docPath}: ${entry.message}`);
      }
      process.exitCode = 1;
    }

    console.log('');
    console.log(`Done in ${durationSeconds}s`);
    if (options.dryRun) {
      console.log('Dry-run complete. No Postgres writes were made.');
    }
  } catch (error) {
    console.error('Import failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }

    if (prismaPool) {
      await prismaPool.end();
    }
  }
}

void main();
