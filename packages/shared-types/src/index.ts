export type Platform = 'redbook' | 'greenbook';
export type CardRole = 'cover' | 'hook' | 'argument' | 'list' | 'payoff' | 'cta';
export type AspectRatio = '4:5' | '1:1';
export type Language = 'zh' | 'en';
export type ProjectStatus = 'draft' | 'planning' | 'generating' | 'editing' | 'exported';
export type GenJobStatus = 'queued' | 'running' | 'partial' | 'done' | 'failed';
export type SuggestionType = 'structure' | 'platform_sop' | 'quality';
export type SuggestionStatus = 'pending' | 'accepted' | 'ignored';
export type ChangeActor = 'user' | 'agent';
export type ChangeTarget = 'card' | 'project' | 'image';
export type AppliesToStage = 'plan' | 'edit' | 'image_prompt';
export type SubjectLock = 'lighting' | 'camera' | 'people' | 'props';
export type TextLayout = 'top' | 'calligraphy' | 'fullscreen' | 'caption';

export interface Project {
  id: string;
  userId: string;
  platform: Platform;
  topic: string;
  cardCount: number;
  aspectRatio: AspectRatio;
  language: Language;
  tone: string;
  skillIds: string[];
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Card {
  id: string;
  projectId: string;
  index: number;
  role: CardRole;
  title: string;
  body: string;
  imageVersionId: string | null;
  userEdited: boolean;
  locked: boolean;
  version: number;
}

export interface SkillFewShot {
  input: string;
  output: string;
}

export interface SkillOutputSchema {
  mustHave?: CardRole[];
  maxWordsPerCard?: number;
  titleEmojiProb?: number;
}

export interface SkillAppliesTo {
  platforms: Platform[];
  stages: AppliesToStage[];
}

export interface Skill {
  id: string;
  name: string;
  author: string;
  category: string[];
  systemPrompt: string;
  fewShotExamples: SkillFewShot[];
  imageRefs: string[];
  outputSchema: SkillOutputSchema;
  appliesTo: SkillAppliesTo;
  isOfficial: boolean;
}

export interface MainSubject {
  description: string;
  refImages: string[];
  locks: SubjectLock[];
}

export interface GenJob {
  id: string;
  projectId: string;
  status: GenJobStatus;
  mainSubject: MainSubject;
  artStyle: string;
  textLayout: TextLayout;
  startedAt: Date;
  completedAt: Date | null;
}

export interface CardImage {
  id: string;
  cardId: string;
  genJobId: string;
  version: number;
  url: string;
  fullPrompt: string;
  createdAt: Date;
}

export interface Suggestion {
  id: string;
  projectId: string;
  cardId: string | null;
  type: SuggestionType;
  message: string;
  actionLabel: string;
  actionPayload: Record<string, unknown>;
  status: SuggestionStatus;
  createdAt: Date;
}

export interface ChangeLog {
  id: string;
  projectId: string;
  actor: ChangeActor;
  target: ChangeTarget;
  targetId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}
