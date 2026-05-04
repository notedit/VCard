import type { Card, ChangeLog, Project } from '@vcard/shared-types';

export const db = {
  projects: new Map<string, Project>(),
  cards: new Map<string, Card>(),
  changeLogs: new Map<string, ChangeLog>()
};

export const uid = () => crypto.randomUUID();
