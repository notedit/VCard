import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { CardRole, ProjectStatus, Skill, SuggestionStatus, SuggestionType, TextLayout } from '@vcard/shared-types';

type Project = {
  id: string;
  userId: string;
  platform: 'redbook' | 'greenbook';
  topic: string;
  cardCount: number;
  aspectRatio: '4:5' | '1:1';
  language: 'zh' | 'en';
  tone: string;
  skillIds: string[];
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

type Card = {
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
};

type CardImage = {
  id: string;
  cardId: string;
  url: string;
  cardIndex: number;
};

type ProjectSnapshot = {
  project: Project;
  cards: Card[];
};

type JobStatus = {
  job: { id: string; status: string };
  done: number[];
  pending: number[];
  failed: number[];
  images: CardImage[];
};

type Suggestion = {
  id: string;
  projectId: string;
  cardId: string | null;
  type: SuggestionType;
  message: string;
  actionLabel: string;
  actionPayload: Record<string, unknown>;
  status: SuggestionStatus;
  createdAt: string;
};

type BusyKey = 'project' | 'skills' | 'plan' | 'image' | 'save' | 'edit' | 'export' | 'reorder';

type EditProposal = {
  field: 'title' | 'body';
  newValue: string;
  rationale: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

const roleLabel: Record<CardRole, string> = {
  cover: '封面',
  hook: '钩子',
  argument: '立论',
  list: '清单',
  payoff: 'Payoff',
  cta: 'CTA',
};

const roleClass: Record<CardRole, string> = {
  cover: 'role-cover',
  hook: 'role-hook',
  argument: 'role-argument',
  list: 'role-list',
  payoff: 'role-payoff',
  cta: 'role-cta',
};

const lockOptions = [
  { value: 'lighting', label: '光线' },
  { value: 'camera', label: '机位' },
  { value: 'props', label: '道具' },
  { value: 'people', label: '人物' },
] as const;

const layoutOptions: Array<{ value: TextLayout; label: string }> = [
  { value: 'top', label: '顶部标题' },
  { value: 'caption', label: '角标说明' },
  { value: 'fullscreen', label: '满版文字' },
  { value: 'calligraphy', label: '手写感' },
];

const suggestionLabel: Record<SuggestionType, string> = {
  structure: '结构',
  platform_sop: '平台 SOP',
  quality: '质量',
};

export function StudioApp() {
  const [topic, setTopic] = useState('周末 200 块在胡同吃到撑');
  const [project, setProject] = useState<Project | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [images, setImages] = useState<CardImage[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('准备创建小红书 9 图项目');
  const [busy, setBusy] = useState<Record<BusyKey, boolean>>({
    project: false,
    skills: false,
    plan: false,
    image: false,
    save: false,
    edit: false,
    export: false,
    reorder: false,
  });
  const [imageSubject, setImageSubject] = useState('胡同餐桌、自然光、真实烟火气');
  const [artStyle, setArtStyle] = useState('真实摄影，手机拍摄质感，不过度棚拍');
  const [textLayout, setTextLayout] = useState<TextLayout>('top');
  const [locks, setLocks] = useState<Array<(typeof lockOptions)[number]['value']>>(['lighting', 'props']);
  const [editField, setEditField] = useState<'title' | 'body'>('title');
  const [editInstruction, setEditInstruction] = useState('更像真实用户分享，标题更有反差');
  const [proposal, setProposal] = useState<EditProposal | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? cards[0] ?? null,
    [cards, selectedCardId],
  );

  const imageByCardId = useMemo(() => new Map(images.map((image) => [image.cardId, image])), [images]);

  const progress = cards.length === 0 ? 0 : Math.round((images.length / cards.length) * 100);
  const selectedCardHasImage = selectedCard ? imageByCardId.has(selectedCard.id) : false;

  useEffect(() => {
    void loadSkills();
  }, []);

  useEffect(() => {
    if (!selectedCard) {
      setDraftTitle('');
      setDraftBody('');
      setProposal(null);
      return;
    }
    setDraftTitle(selectedCard.title);
    setDraftBody(selectedCard.body);
    setProposal(null);
  }, [selectedCard?.id, selectedCard?.title, selectedCard?.body]);

  async function loadSkills() {
    setBusyFlag('skills', true);
    try {
      const body = await request<{ skills: Skill[] }>('/skills');
      setSkills(body.skills);
      setSelectedSkillIds((current) => (current.length > 0 ? current : body.skills.map((skill) => skill.id)));
    } catch (err) {
      showError(err);
    } finally {
      setBusyFlag('skills', false);
    }
  }

  async function createProject() {
    setBusyFlag('project', true);
    setError('');
    try {
      const created = await request<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({ topic }),
      });
      setProject(created);
      setCards([]);
      setImages([]);
      setSuggestions([]);
      setSelectedCardId(null);
      if (selectedSkillIds.length > 0) {
        const updated = await request<Project>(`/projects/${created.id}/skills`, {
          method: 'PATCH',
          body: JSON.stringify({ skillIds: selectedSkillIds }),
        });
        setProject(updated);
      }
      setNotice('项目已创建，可以开始 Plan');
      return created.id;
    } catch (err) {
      showError(err);
      return null;
    } finally {
      setBusyFlag('project', false);
    }
  }

  async function ensureProject() {
    if (project) return project.id;
    return createProject();
  }

  async function syncSkills(projectId: string) {
    if (selectedSkillIds.length === 0) return;
    const updated = await request<Project>(`/projects/${projectId}/skills`, {
      method: 'PATCH',
      body: JSON.stringify({ skillIds: selectedSkillIds }),
    });
    setProject(updated);
  }

  async function runPlan() {
    setBusyFlag('plan', true);
    setError('');
    setProposal(null);
    try {
      const projectId = await ensureProject();
      if (!projectId) return;
      await syncSkills(projectId);
      setNotice('Agent 正在生成 9 张卡片');
      const res = await fetch(`${API_BASE}/projects/${projectId}/plan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, skillIds: selectedSkillIds }),
      });
      if (!res.ok) throw new Error(`Plan failed: ${res.status}`);
      await res.text();
      const snapshot = await request<ProjectSnapshot>(`/projects/${projectId}`);
      setProject(snapshot.project);
      setCards(snapshot.cards);
      setImages([]);
      setSelectedCardId(snapshot.cards[0]?.id ?? null);
      await loadSuggestions(projectId);
      setNotice(`Plan 完成：${snapshot.cards.length} 张卡`);
    } catch (err) {
      showError(err);
    } finally {
      setBusyFlag('plan', false);
    }
  }

  async function generateSelectedImage() {
    if (cards.length === 0) {
      setError('先生成 Plan，再开始图片任务。');
      return;
    }
    if (!selectedCard) {
      setError('先选择一张卡片。');
      return;
    }
    setBusyFlag('image', true);
    setError('');
    try {
      const projectId = await ensureProject();
      if (!projectId) return;
      const gen = await request<{ job: { id: string; status: string }; queued: number }>(
        `/projects/${projectId}/gen-jobs`,
        {
          method: 'POST',
          body: JSON.stringify({
            mainSubject: { description: imageSubject, refImages: [], locks },
            artStyle,
            textLayout,
            cardIds: [selectedCard.id],
          }),
        },
      );
      setNotice(`当前卡片图片任务已入队：${gen.queued} 张`);
      const finalStatus = await pollJob(gen.job.id, 1, (status) => {
        mergeImages(status.images, setImages);
        setNotice(`当前卡片生成中：${status.images.length}/1`);
      });
      mergeImages(finalStatus.images, setImages);
      await loadSuggestions(projectId);
      setNotice(`当前卡片图片状态：${finalStatus.job.status}`);
    } catch (err) {
      showError(err);
    } finally {
      setBusyFlag('image', false);
    }
  }

  async function saveSelectedCard() {
    if (!selectedCard || !project) return;
    setBusyFlag('save', true);
    setError('');
    try {
      const updated = await request<Card>(`/projects/${project.id}/cards/${selectedCard.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: draftTitle,
          body: draftBody,
          version: selectedCard.version,
        }),
      });
      setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
      setSelectedCardId(updated.id);
      setProposal(null);
      await loadSuggestions(project.id);
      setNotice('卡片已保存');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('版本冲突：卡片已被更新，正在拉取最新内容。');
        await refreshProject();
      } else {
        showError(err);
      }
    } finally {
      setBusyFlag('save', false);
    }
  }

  async function proposeEdit() {
    if (!selectedCard) return;
    setBusyFlag('edit', true);
    setError('');
    setProposal(null);
    try {
      const res = await fetch(`${API_BASE}/cards/${selectedCard.id}/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ field: editField, instruction: editInstruction }),
      });
      if (!res.ok) throw new Error(`Edit failed: ${res.status}`);
      const streamText = await res.text();
      const nextProposal = parseEditProposal(streamText, editField);
      if (!nextProposal) throw new Error('Agent 没有返回可用改写。');
      setProposal(nextProposal);
      if (nextProposal.field === 'title') setDraftTitle(nextProposal.newValue);
      if (nextProposal.field === 'body') setDraftBody(nextProposal.newValue);
      setNotice('Agent 已生成改写候选');
    } catch (err) {
      showError(err);
    } finally {
      setBusyFlag('edit', false);
    }
  }

  async function moveSelectedCard(direction: -1 | 1) {
    if (!project || !selectedCard) return;
    const nextCards = [...cards].sort((a, b) => a.index - b.index);
    const position = nextCards.findIndex((card) => card.id === selectedCard.id);
    const targetPosition = position + direction;
    if (targetPosition < 0 || targetPosition >= nextCards.length) return;
    [nextCards[position], nextCards[targetPosition]] = [nextCards[targetPosition], nextCards[position]];
    const order = nextCards.map((card, index) => ({ cardId: card.id, index }));
    setBusyFlag('reorder', true);
    try {
      await request(`/projects/${project.id}/cards`, {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      });
      setCards(nextCards.map((card, index) => ({ ...card, index })));
      await loadSuggestions(project.id);
      setNotice('顺序已更新，Agent 会异步检查结构');
    } catch (err) {
      showError(err);
    } finally {
      setBusyFlag('reorder', false);
    }
  }

  async function refreshProject() {
    if (!project) return;
    const snapshot = await request<ProjectSnapshot>(`/projects/${project.id}`);
    setProject(snapshot.project);
    setCards(snapshot.cards);
    await loadSuggestions(project.id);
    if (!snapshot.cards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(snapshot.cards[0]?.id ?? null);
    }
  }

  async function exportProject() {
    if (!project) {
      setError('先创建项目，再导出。');
      return;
    }
    setBusyFlag('export', true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/projects/${project.id}/export`, { method: 'POST' });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vcard-${project.id}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(`导出已生成：${Math.max(1, Math.round(blob.size / 1024))} KB`);
    } catch (err) {
      showError(err);
    } finally {
      setBusyFlag('export', false);
    }
  }

  async function loadSuggestions(projectId = project?.id) {
    if (!projectId) return;
    const body = await request<{ suggestions: Suggestion[] }>(`/projects/${projectId}/suggestions`);
    setSuggestions(body.suggestions);
  }

  async function updateSuggestion(id: string, action: 'accept' | 'ignore') {
    setError('');
    try {
      const updated = await request<Suggestion>(`/suggestions/${id}/${action}`, { method: 'POST' });
      setSuggestions((current) => current.map((suggestion) => (suggestion.id === id ? updated : suggestion)));
      setNotice(action === 'accept' ? '建议已采纳标记' : '建议已忽略');
    } catch (err) {
      showError(err);
    }
  }

  function toggleSkill(skillId: string) {
    setSelectedSkillIds((current) =>
      current.includes(skillId) ? current.filter((id) => id !== skillId) : [...current, skillId],
    );
  }

  function toggleLock(lock: (typeof lockOptions)[number]['value']) {
    setLocks((current) => (current.includes(lock) ? current.filter((item) => item !== lock) : [...current, lock]));
  }

  function setBusyFlag(key: BusyKey, value: boolean) {
    setBusy((current) => ({ ...current, [key]: value }));
  }

  function showError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
    setNotice('流程暂停，查看右上角错误');
  }

  const anyBusy = Object.values(busy).some(Boolean);

  return (
    <main className="studio-product">
      <header className="studio-statusbar">
        <div>
          <div className="mono muted">REDBOOK STUDIO · 4:5 · 9 CARDS</div>
          <h1>{project ? project.topic : '新建小红书图文'}</h1>
        </div>
        <div className="studio-statusbar__meta">
          <span className="status-pill">{project?.status ?? 'draft'}</span>
          <span>{cards.length}/9 cards</span>
          <span>{images.length}/9 images</span>
          <button className="studio-button studio-button--dark" onClick={exportProject} disabled={busy.export}>
            {busy.export ? '导出中' : '导出 ZIP'}
          </button>
        </div>
      </header>

      {error && (
        <div className="studio-alert" role="alert">
          <strong>需要处理</strong>
          <span>{error}</span>
          <button onClick={() => setError('')}>关闭</button>
        </div>
      )}

      <section className="studio-layout">
        <aside className="studio-left">
          <section className="studio-panel studio-panel--project">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Project</span>
                <h2>入口</h2>
              </div>
              <span className="status-dot status-dot--red" />
            </div>
            <label className="studio-field">
              <span>主题</span>
              <textarea value={topic} onChange={(event) => setTopic(event.target.value)} />
            </label>
            <div className="platform-row">
              <button className="platform-tab is-active">小红书</button>
              <button className="platform-tab" disabled>小绿书</button>
            </div>
            <div className="panel-actions">
              <button className="studio-button" onClick={createProject} disabled={busy.project || !topic.trim()}>
                {busy.project ? '创建中' : project ? '新建项目' : '创建项目'}
              </button>
              <button className="studio-button studio-button--primary" onClick={runPlan} disabled={busy.plan || !topic.trim()}>
                {busy.plan ? 'Plan 中' : cards.length > 0 ? '重跑 Plan' : '开始 Plan'}
              </button>
            </div>
          </section>

          <section className="studio-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Skills</span>
                <h2>能力栈</h2>
              </div>
              <span className="skill-count">{selectedSkillIds.length}</span>
            </div>
            <div className="skill-list">
              {skills.length === 0 && (
                <div className="studio-empty compact">{busy.skills ? '加载 Skills 中' : '暂无 Skills'}</div>
              )}
              {skills.map((skill, index) => {
                const selected = selectedSkillIds.includes(skill.id);
                return (
                  <button
                    className={selected ? 'skill-item is-selected' : 'skill-item'}
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    <span className="skill-rank">{selected ? selectedSkillIds.indexOf(skill.id) + 1 : index + 1}</span>
                    <span>
                      <strong>{skill.name}</strong>
                      <small>{skill.appliesTo.stages.join(' / ')}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="studio-main">
          <div className="workspace-toolbar">
            <div>
              <span className="panel-kicker">Workspace</span>
              <h2>Plan / 图片卡片</h2>
            </div>
            <div className="workspace-progress" aria-label={`image progress ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="studio-empty studio-empty--hero">
              <span>01</span>
              <h3>先用主题生成 9 张 Plan</h3>
              <p>左侧挂好 Skills 后开始 Plan。完成后这里会变成可编辑卡片工作区。</p>
              <button className="studio-button studio-button--primary" onClick={runPlan} disabled={busy.plan}>
                {busy.plan ? '生成中' : '开始 Plan'}
              </button>
            </div>
          ) : (
            <div className="card-board">
              {cards
                .slice()
                .sort((a, b) => a.index - b.index)
                .map((card) => {
                  const image = imageByCardId.get(card.id);
                  const active = selectedCard?.id === card.id;
                  return (
                    <article
                      className={active ? 'studio-card is-active' : 'studio-card'}
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                    >
                      <div className="card-visual">
                        {image ? (
                          <img src={`${API_BASE}/images/${image.url}`} alt={card.title} />
                        ) : (
                          <div className={`image-placeholder ${roleClass[card.role]}`}>
                            <span>{String(card.index + 1).padStart(2, '0')}</span>
                          </div>
                        )}
                      </div>
                      <div className="card-copy">
                        <div className="card-meta">
                          <span className={`role-tag ${roleClass[card.role]}`}>{roleLabel[card.role]}</span>
                          {card.userEdited && <span className="edited-tag">用户改过</span>}
                        </div>
                        <h3>{card.title}</h3>
                        <p>{card.body}</p>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </section>

        <aside className="studio-right">
          <section className="studio-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Image</span>
                <h2>生成控制</h2>
              </div>
              <span className="status-pill">{progress}%</span>
            </div>
            <label className="studio-field">
              <span>主体锚点</span>
              <textarea value={imageSubject} onChange={(event) => setImageSubject(event.target.value)} />
            </label>
            <label className="studio-field">
              <span>画面风格</span>
              <input value={artStyle} onChange={(event) => setArtStyle(event.target.value)} />
            </label>
            <div className="segmented-grid">
              {layoutOptions.map((option) => (
                <button
                  className={textLayout === option.value ? 'segment is-active' : 'segment'}
                  key={option.value}
                  onClick={() => setTextLayout(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="lock-grid">
              {lockOptions.map((option) => (
                <button
                  className={locks.includes(option.value) ? 'lock-chip is-active' : 'lock-chip'}
                  key={option.value}
                  onClick={() => toggleLock(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button className="studio-button studio-button--primary full" onClick={generateSelectedImage} disabled={busy.image || !selectedCard}>
              {busy.image ? '生成当前卡中' : selectedCardHasImage ? '重生当前卡' : '生成当前卡'}
            </button>
          </section>

          <section className="studio-panel editor-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Editor</span>
                <h2>{selectedCard ? `第 ${selectedCard.index + 1} 张` : '未选择'}</h2>
              </div>
              {selectedCard && <span className={`role-tag ${roleClass[selectedCard.role]}`}>{roleLabel[selectedCard.role]}</span>}
            </div>
            {selectedCard ? (
              <>
                <div className="reorder-row">
                  <button className="studio-button ghost" onClick={() => moveSelectedCard(-1)} disabled={busy.reorder || selectedCard.index === 0}>
                    上移
                  </button>
                  <button className="studio-button ghost" onClick={() => moveSelectedCard(1)} disabled={busy.reorder || selectedCard.index === cards.length - 1}>
                    下移
                  </button>
                </div>
                <label className="studio-field">
                  <span>标题</span>
                  <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                </label>
                <label className="studio-field">
                  <span>正文</span>
                  <textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} />
                </label>
                <button className="studio-button studio-button--dark full" onClick={saveSelectedCard} disabled={busy.save}>
                  {busy.save ? '保存中' : `保存 v${selectedCard.version}`}
                </button>
                <div className="command-box">
                  <div className="command-head">
                    <span className="k-badge">K</span>
                    <strong>Agent 改写</strong>
                  </div>
                  <div className="field-switch">
                    <button className={editField === 'title' ? 'segment is-active' : 'segment'} onClick={() => setEditField('title')}>标题</button>
                    <button className={editField === 'body' ? 'segment is-active' : 'segment'} onClick={() => setEditField('body')}>正文</button>
                  </div>
                  <textarea value={editInstruction} onChange={(event) => setEditInstruction(event.target.value)} />
                  <button className="studio-button studio-button--primary full" onClick={proposeEdit} disabled={busy.edit}>
                    {busy.edit ? '改写中' : '生成候选'}
                  </button>
                  {proposal && (
                    <div className="proposal-card">
                      <span>{proposal.field === 'title' ? '标题候选' : '正文候选'}</span>
                      <p>{proposal.newValue}</p>
                      <small>{proposal.rationale}</small>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="studio-empty compact">选择一张卡片后开始编辑</div>
            )}
          </section>

          <section className="studio-panel suggestion-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Reflect</span>
                <h2>Agent 建议</h2>
              </div>
              <button className="studio-button ghost" onClick={() => void loadSuggestions()} disabled={!project}>
                刷新
              </button>
            </div>
            {suggestions.length === 0 ? (
              <div className="suggestion-card">
                <span>结构检查</span>
                <p>{project ? '暂无待处理建议。编辑、重排或生成图片后可刷新查看。' : '创建项目后启用。'}</p>
              </div>
            ) : (
              <div className="suggestion-list">
                {suggestions.map((suggestion) => (
                  <article className={`suggestion-card suggestion-${suggestion.type}`} key={suggestion.id}>
                    <span>{suggestionLabel[suggestion.type]} · {suggestion.status}</span>
                    <p>{suggestion.message}</p>
                    <div className="suggestion-actions">
                      <button
                        className="studio-button ghost"
                        onClick={() => void updateSuggestion(suggestion.id, 'accept')}
                        disabled={suggestion.status !== 'pending'}
                      >
                        {suggestion.actionLabel}
                      </button>
                      <button
                        className="studio-button ghost"
                        onClick={() => void updateSuggestion(suggestion.id, 'ignore')}
                        disabled={suggestion.status !== 'pending'}
                      >
                        忽略
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>

      <footer className="studio-footer">
        <span>{notice}</span>
        {anyBusy && <span className="busy-dot">处理中</span>}
      </footer>
    </main>
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    throw new ApiError(res.status, payload);
  }
  return res.json() as Promise<T>;
}

async function pollJob(jobId: string, expectedCount: number, onTick: (status: JobStatus) => void): Promise<JobStatus> {
  let latest: JobStatus | null = null;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    latest = await request<JobStatus>(`/gen-jobs/${jobId}/status`);
    onTick(latest);
    if (latest.job.status === 'done' || latest.images.length >= expectedCount || latest.job.status === 'failed') {
      return latest;
    }
    await sleep(5000);
  }
  if (!latest) throw new Error('Job status unavailable');
  return latest;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mergeImages(nextImages: CardImage[], setImages: Dispatch<SetStateAction<CardImage[]>>) {
  setImages((current) => {
    const byCardId = new Map(current.map((image) => [image.cardId, image]));
    for (const image of nextImages) byCardId.set(image.cardId, image);
    return Array.from(byCardId.values()).sort((a, b) => a.cardIndex - b.cardIndex);
  });
}

function parseEditProposal(streamText: string, fallbackField: 'title' | 'body'): EditProposal | null {
  const newValue = extractJsonString(streamText, 'newValue');
  if (!newValue) return null;
  const field = extractJsonString(streamText, 'field');
  const rationale = extractJsonString(streamText, 'rationale') ?? '按当前指令生成的候选。';
  return {
    field: field === 'body' || field === 'title' ? field : fallbackField,
    newValue,
    rationale,
  };
}

function extractJsonString(source: string, key: string) {
  const match = source.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

class ApiError extends Error {
  status: number;

  constructor(status: number, payload: unknown) {
    const detail =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed: ${status}`;
    super(detail);
    this.status = status;
  }
}
