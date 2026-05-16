import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type {
  ActivityActor,
  ActivityTarget,
  AspectRatio,
  CardLayout,
  ChatAction,
  ChatRole,
  DeckMode,
  DeckSettings,
  DeckStatus,
  GenerationStatus,
  Language,
} from '@vcard/shared-types';

export const deckModeEnum = pgEnum('deck_mode', ['html', 'image']);
export const deckStatusEnum = pgEnum('deck_status', ['draft', 'outlined', 'styled', 'generating', 'ready', 'exported']);
export const aspectRatioEnum = pgEnum('aspect_ratio', ['1:1', '4:5', '9:16']);
export const languageEnum = pgEnum('language', ['zh-CN', 'zh-TW', 'en', 'ja']);
export const cardLayoutEnum = pgEnum('card_layout', ['cover', 'list', 'quote', 'stat', 'closer']);
export const generationStatusEnum = pgEnum('generation_status', ['queued', 'running', 'done', 'failed']);
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant']);
export const activityActorEnum = pgEnum('activity_actor', ['user', 'assistant', 'system']);
export const activityTargetEnum = pgEnum('activity_target', ['deck', 'card', 'generation', 'chat']);

export const decks = pgTable(
  'decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().default('demo-user'),
    title: text('title').notNull().default('Untitled deck'),
    prompt: text('prompt').notNull(),
    mode: deckModeEnum('mode').$type<DeckMode>().notNull().default('html'),
    cardCount: integer('card_count').notNull().default(7),
    aspectRatio: aspectRatioEnum('aspect_ratio').$type<AspectRatio>().notNull().default('4:5'),
    language: languageEnum('language').$type<Language>().notNull().default('zh-CN'),
    settings: jsonb('settings').$type<DeckSettings>().notNull(),
    status: deckStatusEnum('status').$type<DeckStatus>().notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUpdatedIdx: index('decks_user_updated_idx').on(t.userId, t.updatedAt),
    statusIdx: index('decks_status_idx').on(t.status),
  }),
);

export const deckCards = pgTable(
  'deck_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    title: text('title').notNull().default(''),
    bullets: jsonb('bullets').$type<string[]>().notNull().default([]),
    layout: cardLayoutEnum('layout').$type<CardLayout>().notNull().default('list'),
    note: text('note'),
    render: jsonb('render').$type<Record<string, unknown>>().notNull().default({}),
    imagePrompt: text('image_prompt'),
    imageUrl: text('image_url'),
    userEdited: boolean('user_edited').notNull().default(false),
    locked: boolean('locked').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deckIndexIdx: index('deck_cards_deck_index_idx').on(t.deckId, t.index),
  }),
);

export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    mode: deckModeEnum('mode').$type<DeckMode>().notNull(),
    status: generationStatusEnum('status').$type<GenerationStatus>().notNull().default('queued'),
    requested: jsonb('requested').$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb('result').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deckCreatedIdx: index('generation_jobs_deck_created_idx').on(t.deckId, t.createdAt),
    statusIdx: index('generation_jobs_status_idx').on(t.status),
  }),
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id').references(() => deckCards.id, { onDelete: 'set null' }),
    role: chatRoleEnum('role').$type<ChatRole>().notNull(),
    body: text('body').notNull(),
    actions: jsonb('actions').$type<ChatAction[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deckCreatedIdx: index('chat_messages_deck_created_idx').on(t.deckId, t.createdAt),
    cardIdx: index('chat_messages_card_idx').on(t.cardId),
  }),
);

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    actor: activityActorEnum('actor').$type<ActivityActor>().notNull(),
    target: activityTargetEnum('target').$type<ActivityTarget>().notNull(),
    targetId: uuid('target_id'),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deckCreatedIdx: index('activity_logs_deck_created_idx').on(t.deckId, t.createdAt),
  }),
);

export type DeckRow = typeof decks.$inferSelect;
export type DeckInsert = typeof decks.$inferInsert;
export type DeckCardRow = typeof deckCards.$inferSelect;
export type DeckCardInsert = typeof deckCards.$inferInsert;
export type GenerationJobRow = typeof generationJobs.$inferSelect;
export type GenerationJobInsert = typeof generationJobs.$inferInsert;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type ChatMessageInsert = typeof chatMessages.$inferInsert;
export type ActivityLogRow = typeof activityLogs.$inferSelect;
export type ActivityLogInsert = typeof activityLogs.$inferInsert;
