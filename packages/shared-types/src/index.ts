export type Platform = 'redbook' | 'greenbook';
export type CardRole = 'cover' | 'hook' | 'argument' | 'list' | 'payoff' | 'cta';

export interface Project {
  id: string;
  userId: string;
  platform: Platform;
  topic: string;
  cardCount: number;
  aspectRatio: '4:5' | '1:1';
  language: 'zh' | 'en';
  tone: string;
  skillIds: string[];
  status: 'draft' | 'planning' | 'generating' | 'editing' | 'exported';
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

export interface ChangeLog {
  id: string;
  projectId: string;
  actor: 'user' | 'agent';
  target: 'card' | 'project' | 'image';
  targetId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}
