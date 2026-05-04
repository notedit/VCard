import { useState } from 'react';

type Card = {
  id: string;
  index: number;
  role: string;
  title: string;
  body: string;
};

type Skill = {
  id: string;
  name: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

export function ScreenP0Console() {
  const [topic, setTopic] = useState('周末 200 块在胡同吃到撑');
  const [projectId, setProjectId] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [jobStatus, setJobStatus] = useState('未开始');
  const [exportSize, setExportSize] = useState('');
  const [log, setLog] = useState<string[]>(['准备就绪：先启动 API，再跑 P0。']);
  const [busy, setBusy] = useState(false);

  async function runP0() {
    setBusy(true);
    setCards([]);
    setExportSize('');
    setJobStatus('运行中');
    setLog(['创建项目']);

    try {
      const skillsBody = await request<{ skills: Skill[] }>('/skills');
      setSkills(skillsBody.skills);
      pushLog(`加载 ${skillsBody.skills.length} 个官方 Skill`);

      const project = await request<{ id: string }>('/projects', {
        method: 'POST',
        body: JSON.stringify({ topic }),
      });
      setProjectId(project.id);
      pushLog(`项目已创建：${project.id.slice(0, 8)}`);

      const skillIds = skillsBody.skills.slice(0, 3).map((skill) => skill.id);
      await request(`/projects/${project.id}/skills`, {
        method: 'PATCH',
        body: JSON.stringify({ skillIds }),
      });
      pushLog('Skills 已挂载');

      const planRes = await fetch(`${API_BASE}/projects/${project.id}/plan`, {
        method: 'POST',
        body: JSON.stringify({ skillIds }),
      });
      if (!planRes.ok) throw new Error(`Plan failed: ${planRes.status}`);
      const events = parseSse(await planRes.text());
      const nextCards = events.filter((event) => event.event === 'card').map((event) => event.data as Card);
      setCards(nextCards);
      pushLog(`Plan 完成：${nextCards.length} 张卡`);

      const gen = await request<{ job: { id: string; status: string }; images: unknown[] }>(
        `/projects/${project.id}/gen-jobs`,
        {
          method: 'POST',
          body: JSON.stringify({
            mainSubject: { description: '胡同餐桌、自然光、真实烟火气', refImages: [], locks: ['lighting', 'props'] },
            artStyle: '真实摄影',
            textLayout: 'top',
          }),
        },
      );
      setJobStatus(`${gen.job.status} · ${gen.images.length}/9`);
      pushLog(`图片记录完成：${gen.images.length}/9`);

      const archive = await fetch(`${API_BASE}/projects/${project.id}/export`, { method: 'POST' });
      if (!archive.ok) throw new Error(`Export failed: ${archive.status}`);
      const blob = await archive.blob();
      setExportSize(`${Math.round(blob.size / 1024)} KB ZIP`);
      pushLog('ZIP 导出已生成');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setJobStatus('失败');
      pushLog(message);
    } finally {
      setBusy(false);
    }
  }

  function pushLog(line: string) {
    setLog((current) => [`${new Date().toLocaleTimeString()} · ${line}`, ...current].slice(0, 8));
  }

  return (
    <div className="p0-console">
      <div className="p0-hero">
        <div>
          <div className="mono muted">P0 RUNBOOK · REAL API</div>
          <h2>主题到导出，一次跑完</h2>
          <p>这个控制台直接调用本地 API，覆盖 Skills、Plan、9 图记录和 ZIP 导出。它不是设计稿，是 M1 P0 的验收入口。</p>
        </div>
        <button className="btn primary" onClick={runP0} disabled={busy}>
          {busy ? '运行中…' : '跑 P0'}
        </button>
      </div>

      <div className="p0-grid">
        <label className="p0-topic">
          <span className="label">主题</span>
          <textarea value={topic} onChange={(event) => setTopic(event.target.value)} />
        </label>

        <div className="wf p0-panel">
          <div className="label">状态</div>
          <div className="p0-status">{jobStatus}</div>
          <div className="mono muted">{projectId ? `project ${projectId}` : '尚未创建项目'}</div>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 12 }}>
            {skills.map((skill, index) => (
              <span className="chip sel" key={skill.id}>
                {index + 1} · {skill.name}
              </span>
            ))}
          </div>
          {exportSize && <div className="pill hi" style={{ marginTop: 14 }}>{exportSize}</div>}
        </div>
      </div>

      <div className="p0-cards">
        {cards.length === 0 ? (
          <div className="placeholder">Plan 生成后，9 张卡会出现在这里</div>
        ) : (
          cards.map((card) => (
            <article className="wf wf-tight p0-card" key={card.id}>
              <div className="mono muted">{String(card.index + 1).padStart(2, '0')} · {card.role}</div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))
        )}
      </div>

      <div className="wf p0-log">
        <div className="label">事件</div>
        {log.map((line, index) => (
          <div className="mono" key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

function parseSse(text: string) {
  return text
    .trim()
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => {
      const event = chunk.match(/^event: (.+)$/m)?.[1] ?? 'message';
      const data = chunk.match(/^data: (.+)$/m)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}
