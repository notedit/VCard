import { useEffect, useState } from 'react';
import { Artboard } from './components/Artboard';
import { TweakRadio, TweakSection, TweakSwitch, TweaksPanel } from './components/TweaksPanel';
import { ScreenEntry } from './screens/ScreenEntry';
import type { EntryVariant } from './screens/ScreenEntry';
import { ScreenPlan } from './screens/ScreenPlan';
import { ScreenSkills } from './screens/ScreenSkills';
import { ScreenImageGen } from './screens/ScreenImageGen';
import { ScreenEditor } from './screens/ScreenEditor';
import { ScreenPositioning } from './screens/ScreenPositioning';
import { ScreenStyleGuide } from './screens/ScreenStyleGuide';

export default function App() {
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showPositioning, setShowPositioning] = useState(true);
  const [entryVariant, setEntryVariant] = useState<EntryVariant>('A');

  useEffect(() => {
    document.body.dataset.annotations = showAnnotations ? 'on' : 'off';
  }, [showAnnotations]);

  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="brand">
          卡片 <span style={{ color: 'var(--accent)', fontSize: 18 }}>·</span>
          <span style={{ fontSize: 16, fontFamily: 'var(--font-hand)' }}>社媒 Studio</span>
        </div>
        <nav className="nav-list">
          {showPositioning && <a href="#positioning">0 · 定位</a>}
          <a href="#style">0.5 · 设计风格</a>
          <a href="#entry">1 · 入口</a>
          <a href="#plan">2 · Plan</a>
          <a href="#skills">3 · Skills</a>
          <a href="#image">4 · 视觉</a>
          <a href="#editor">5 · 编辑器</a>
          <a className="prd-link" href="prd.html" target="_blank" rel="noreferrer">
            📄 完整 PRD
          </a>
        </nav>
      </header>

      <section className="section">
        <div className="section-header">
          <div className="title">
            <span style={{ color: 'var(--accent)' }}>0.</span> 产品定位 + 设计系统
          </div>
          <div className="subtitle">参考 Gamma 社媒，做更 AI native、Skills 驱动的版本</div>
        </div>
        {showPositioning && (
          <Artboard id="positioning" label="0 · 定位 + 用户旅程">
            <ScreenPositioning />
          </Artboard>
        )}
        <Artboard id="style" label="0.5 · Visual System · 设计风格">
          <ScreenStyleGuide />
        </Artboard>
      </section>

      <section className="section">
        <div className="section-header">
          <div className="title">
            <span style={{ color: 'var(--accent)' }}>1.</span> 主流程 · 5 个核心场景
          </div>
          <div className="subtitle">入口 → Plan → Skills → 视觉 → 编辑器</div>
        </div>

        <Artboard id="entry" label="1 · 入口 · 平台优先">
          <ScreenEntry variant={entryVariant} />
        </Artboard>
        <Artboard id="plan" label="2 · Plan · 可对话的 AI 大纲">
          <ScreenPlan />
        </Artboard>
        <Artboard id="skills" label="3 · Skills · 能力市场 + 叠加">
          <ScreenSkills />
        </Artboard>
        <Artboard id="image" label="4 · 视觉 · gpt-image-2 一致性 + 烧字">
          <ScreenImageGen />
        </Artboard>
        <Artboard id="editor" label="5 · 编辑器 · Agent 评审 + ⌘K">
          <ScreenEditor />
        </Artboard>
      </section>

      <TweaksPanel title="Wireframe 选项">
        <TweakSection title="标注">
          <TweakSwitch label="显示便签注释" value={showAnnotations} onChange={setShowAnnotations} />
          <TweakSwitch label="显示定位页" value={showPositioning} onChange={setShowPositioning} />
        </TweakSection>
        <TweakSection title="入口变体">
          <TweakRadio
            value={entryVariant}
            onChange={setEntryVariant}
            options={[
              { value: 'A', label: 'A · 选小红书' },
              { value: 'B', label: 'B · 选小绿书' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}
