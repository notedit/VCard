import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type {
  CardRole,
  MainSubject,
  SkillAppliesTo,
  SkillFewShot,
  SkillOutputSchema,
} from '@vcard/shared-types';

export const platformEnum = pgEnum('platform', ['redbook', 'greenbook']);
export const cardRoleEnum = pgEnum('card_role', [
  'cover',
  'hook',
  'argument',
  'list',
  'payoff',
  'cta',
]);
export const aspectRatioEnum = pgEnum('aspect_ratio', ['4:5', '1:1']);
export const languageEnum = pgEnum('language', ['zh', 'en']);
export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'planning',
  'generating',
  'editing',
  'exported',
]);
export const genJobStatusEnum = pgEnum('gen_job_status', [
  'queued',
  'running',
  'partial',
  'done',
  'failed',
]);
export const textLayoutEnum = pgEnum('text_layout', [
  'top',
  'calligraphy',
  'fullscreen',
  'caption',
]);
export const suggestionTypeEnum = pgEnum('suggestion_type', [
  'structure',
  'platform_sop',
  'quality',
]);
export const suggestionStatusEnum = pgEnum('suggestion_status', [
  'pending',
  'accepted',
  'ignored',
]);
export const changeActorEnum = pgEnum('change_actor', ['user', 'agent']);
export const changeTargetEnum = pgEnum('change_target', ['card', 'project', 'image']);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    platform: platformEnum('platform').notNull().default('redbook'),
    topic: text('topic').notNull(),
    cardCount: integer('card_count').notNull().default(9),
    aspectRatio: aspectRatioEnum('aspect_ratio').notNull().default('4:5'),
    language: languageEnum('language').notNull().default('zh'),
    tone: text('tone').notNull().default('native'),
    skillIds: jsonb('skill_ids').$type<string[]>().notNull().default([]),
    status: projectStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('projects_user_id_idx').on(t.userId),
  }),
);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    role: cardRoleEnum('role').notNull(),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    // Forward ref to cardImages (declared below). ON DELETE SET NULL so that
    // deleting an image row nulls out the pointer instead of cascading-deleting
    // the card. Cycle is safe because the reverse direction (cardImages.cardId)
    // uses ON DELETE CASCADE. AnyPgColumn return type breaks the TS circularity
    // (cards → cardImages → cards via FKs).
    imageVersionId: uuid('image_version_id').references((): AnyPgColumn => cardImages.id, {
      onDelete: 'set null',
    }),
    userEdited: boolean('user_edited').notNull().default(false),
    locked: boolean('locked').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (t) => ({
    projectIdx: index('cards_project_id_index_idx').on(t.projectId, t.index),
    imageVersionIdx: index('cards_image_version_id_idx').on(t.imageVersionId),
  }),
);

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  author: text('author').notNull(),
  category: jsonb('category').$type<string[]>().notNull().default([]),
  systemPrompt: text('system_prompt').notNull(),
  fewShotExamples: jsonb('few_shot_examples').$type<SkillFewShot[]>().notNull().default([]),
  imageRefs: jsonb('image_refs').$type<string[]>().notNull().default([]),
  outputSchema: jsonb('output_schema').$type<SkillOutputSchema>().notNull().default({}),
  appliesTo: jsonb('applies_to').$type<SkillAppliesTo>().notNull(),
  isOfficial: boolean('is_official').notNull().default(false),
});

export const genJobs = pgTable(
  'gen_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: genJobStatusEnum('status').notNull().default('queued'),
    mainSubject: jsonb('main_subject').$type<MainSubject>().notNull(),
    artStyle: text('art_style').notNull().default(''),
    textLayout: textLayoutEnum('text_layout').notNull().default('top'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    projectStatusIdx: index('gen_jobs_project_status_idx').on(t.projectId, t.status),
  }),
);

export const cardImages = pgTable(
  'card_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    genJobId: uuid('gen_job_id')
      .notNull()
      .references(() => genJobs.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    url: text('url').notNull(),
    fullPrompt: text('full_prompt').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cardIdx: index('card_images_card_id_idx').on(t.cardId),
    cardGenVersionUnique: uniqueIndex('card_images_card_gen_version_unique').on(
      t.cardId,
      t.genJobId,
      t.version,
    ),
  }),
);

export const suggestions = pgTable(
  'suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id').references(() => cards.id, { onDelete: 'cascade' }),
    type: suggestionTypeEnum('type').notNull(),
    message: text('message').notNull(),
    actionLabel: text('action_label').notNull(),
    actionPayload: jsonb('action_payload').$type<Record<string, unknown>>().notNull(),
    status: suggestionStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectStatusIdx: index('suggestions_project_status_idx').on(t.projectId, t.status),
  }),
);

export const changeLogs = pgTable(
  'change_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    actor: changeActorEnum('actor').notNull(),
    target: changeTargetEnum('target').notNull(),
    targetId: uuid('target_id').notNull(),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectCreatedIdx: index('change_logs_project_created_idx').on(t.projectId, t.createdAt),
  }),
);

export type ProjectRow = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type CardRow = typeof cards.$inferSelect;
export type CardInsert = typeof cards.$inferInsert;
export type SkillRow = typeof skills.$inferSelect;
export type SkillInsert = typeof skills.$inferInsert;
export type GenJobRow = typeof genJobs.$inferSelect;
export type GenJobInsert = typeof genJobs.$inferInsert;
export type CardImageRow = typeof cardImages.$inferSelect;
export type CardImageInsert = typeof cardImages.$inferInsert;
export type SuggestionRow = typeof suggestions.$inferSelect;
export type SuggestionInsert = typeof suggestions.$inferInsert;
export type ChangeLogRow = typeof changeLogs.$inferSelect;
export type ChangeLogInsert = typeof changeLogs.$inferInsert;

export type { CardRole };
