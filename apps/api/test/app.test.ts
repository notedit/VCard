import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { db } from '../src/store.js';

describe('project and cards', () => {
  it('creates project and supports card edit with optimistic lock', async () => {
    db.projects.clear(); db.cards.clear(); db.changeLogs.clear();
    const pRes = await app.request('/projects', { method: 'POST', body: JSON.stringify({ topic: 'test' }) });
    expect(pRes.status).toBe(201);
    const project = await pRes.json();

    const card = { id: 'c1', projectId: project.id, index: 0, role: 'cover', title: 't', body: 'b', imageVersionId: null, userEdited: false, locked: false, version: 1 };
    await app.request('/internal/cards', { method: 'POST', body: JSON.stringify(card) });
    const okRes = await app.request(`/projects/${project.id}/cards/c1`, { method: 'PATCH', body: JSON.stringify({ title: 'new', version: 1 }) });
    expect(okRes.status).toBe(200);
    const conflict = await app.request(`/projects/${project.id}/cards/c1`, { method: 'PATCH', body: JSON.stringify({ title: 'x', version: 1 }) });
    expect(conflict.status).toBe(409);
  });
});
