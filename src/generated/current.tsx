// 本文件由 video-agent 生成,请勿手改(下次运行会被覆盖)。
import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, random } from '../core';

export const meta = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 240,
};

// ---------- utils ----------
const codeWords = [
  'API', 'Agent', 'Skill[]', '{}', '()', '=>', 'class AI', 'data',
  'model', 'token', 'param', 'training', 'import', 'export', 'const',
  'function', 'async', 'await', 'Promise', 'Tensor', 'Neuron', 'GPU',
  'Cloud', 'Server', 'GET', 'POST', 'GraphQL', 'REST', 'Socket', 'Stream',
  'Event', 'Hook', 'State', 'Reducer', '0x1A', 'Deep', 'Learn', 'Inference',
];

const guiIcons = ['📱', '💬', '📷', '🔔', '📅', '⚙️', '🎵', '📁'];
const guiButtons = ['Yes', 'No', 'Send', 'OK', 'Cancel', 'Continue'];
const guiMenus = ['Home', 'Settings', 'Profile', 'Help', 'About'];

// ---------- types ----------
interface Fragment {
  id: number;
  initialX: number;
  initialY: number;
  width: number;
  height: number;
  color: string;
  guiType: 'icon' | 'button' | 'slider' | 'menu' | 'balloon';
  appearDelay: number;
  angle: number;
  speed: number;
  ampX: number;
  ampY: number;
  freq: number;
  phase: number;
  flowCenterX: number;
  flowCenterY: number;
  targetX: number;
  targetY: number;
  codeWord: string;
  isEnergyBall: boolean;
}

// ---------- constants ----------
const FRAGMENT_COUNT = 42;
const INPUT_BOX_X = 340;
const INPUT_BOX_Y = 330;
const INPUT_BOX_W = 600;
const INPUT_BOX_H = 60;

const guiTypes: Fragment['guiType'][] = ['icon', 'button', 'slider', 'menu', 'balloon'];

// ---------- main component ----------
export const VideoComposition: React.FC = () => {
  const frame = useCurrentFrame();

  const fragments = useMemo(() => {
    const items: Fragment[] = [];
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      // Deterministic random with seed based on fragment index
      const r = (key: string) => random(`frag_${i}_${key}`);

      const guiType = guiTypes[Math.floor(r('type') * guiTypes.length)];
      const appearDelay = Math.floor(r('appear') * 48);
      const initialX = 80 + r('ix') * 1120;
      const initialY = 80 + r('iy') * 560;

      let width = 70;
      let height = 70;
      let color = '#ddd';

      if (guiType === 'icon') {
        width = 60 + r('w') * 30;
        height = width;
        const colors = ['#f8f8f8', '#e0e0e0', '#f0f0f0'];
        color = colors[Math.floor(r('col') * colors.length)];
      } else if (guiType === 'button') {
        width = 90 + r('w') * 80;
        height = 36 + r('h') * 16;
        const colors = ['#007aff', '#34c759', '#ff9500', '#ff3b30'];
        color = colors[Math.floor(r('col') * colors.length)];
      } else if (guiType === 'slider') {
        width = 160 + r('w') * 100;
        height = 30;
        color = '#e5e5ea';
      } else if (guiType === 'menu') {
        width = 100 + r('w') * 120;
        height = 28;
        color = 'rgba(255,255,255,0.6)';
      } else {
        width = 100 + r('w') * 80;
        height = 50 + r('h') * 30;
        color = '#007aff';
      }

      const angle = r('angle') * Math.PI * 2;
      const speed = 5 + r('speed') * 12;
      const ampX = 70 + r('ampX') * 180;
      const ampY = 70 + r('ampY') * 180;
      const freq = 0.4 + r('freq') * 1.2;
      const phase = r('phase') * Math.PI * 2;

      const side = Math.floor(r('side') * 4);
      let targetX: number;
      let targetY: number;
      if (side === 0) {
        targetX = INPUT_BOX_X;
        targetY = INPUT_BOX_Y + r('ty') * INPUT_BOX_H;
      } else if (side === 1) {
        targetX = INPUT_BOX_X + INPUT_BOX_W;
        targetY = INPUT_BOX_Y + r('ty') * INPUT_BOX_H;
      } else if (side === 2) {
        targetX = INPUT_BOX_X + r('tx') * INPUT_BOX_W;
        targetY = INPUT_BOX_Y;
      } else {
        targetX = INPUT_BOX_X + r('tx') * INPUT_BOX_W;
        targetY = INPUT_BOX_Y + INPUT_BOX_H;
      }

      const flowCenterX = targetX + (r('fcx') - 0.5) * 300;
      const flowCenterY = targetY + (r('fcy') - 0.5) * 260;

      const codeWord = codeWords[Math.floor(r('code') * codeWords.length)];
      const isEnergyBall = r('energy') > 0.55;

      items.push({
        id: i,
        initialX,
        initialY,
        width,
        height,
        color,
        guiType,
        appearDelay,
        angle,
        speed,
        ampX,
        ampY,
        freq,
        phase,
        flowCenterX,
        flowCenterY,
        targetX,
        targetY,
        codeWord,
        isEnergyBall,
      });
    }
    return items;
  }, []);

  // ---- background color ----
  const bgR = interpolate(frame, [60, 90], [240, 18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bgG = interpolate(frame, [60, 90], [240, 18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bgB = interpolate(frame, [60, 90], [245, 24], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const bgStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: `rgb(${bgR},${bgG},${bgB})`,
    fontFamily: 'system-ui',
    overflow: 'hidden',
  };

  // ---- menu bar ----
  const menuOpacity = interpolate(frame, [50, 70], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ---- dock ----
  const dockEmojis = ['📱', '💬', '📷', '⚙️', '🎵', '📅', '📁', '🌐'];

  // ---- input box ----
  const inputScale = interpolate(frame, [180, 200], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inputOpacity = interpolate(frame, [180, 200], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const inputStyle: React.CSSProperties = {
    position: 'absolute',
    left: INPUT_BOX_X,
    top: INPUT_BOX_Y,
    width: INPUT_BOX_W,
    height: INPUT_BOX_H,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    boxShadow: '0 0 30px rgba(0,200,255,0.6), 0 10px 25px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    transform: `scale(${inputScale})`,
    opacity: inputOpacity,
    backdropFilter: 'blur(10px)',
    zIndex: 20,
  };

  // ---- title "剪映" ----
  const titleOpacity = interpolate(frame, [210, 230], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleTranslateY = interpolate(frame, [210, 230], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 270,
    left: '50%',
    transform: `translateX(-50%) translateY(${titleTranslateY}px)`,
    opacity: titleOpacity,
    fontSize: 96,
    fontWeight: 900,
    fontFamily: 'system-ui, sans-serif',
    background: 'linear-gradient(135deg, #00c6ff, #0072ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 0 40px rgba(0,200,255,0.5)',
    letterSpacing: '0.08em',
    userSelect: 'none',
    zIndex: 30,
  };

  // ---- render fragments ----
  const renderFragments = () =>
    fragments.map((frag) => {
      const {
        id,
        initialX,
        initialY,
        width,
        height,
        color,
        guiType,
        appearDelay,
        angle,
        speed,
        ampX,
        ampY,
        freq,
        phase,
        flowCenterX,
        flowCenterY,
        targetX,
        targetY,
        codeWord,
        isEnergyBall,
      } = frag;

      // ---- shake (60-75) ----
      let shakeX = 0;
      let shakeY = 0;
      if (frame >= 60 && frame < 75) {
        const shakeProgress = (frame - 60) / 15;
        shakeX = Math.sin(frame * 0.8 + phase) * 8 * shakeProgress;
        shakeY = Math.cos(frame * 0.7 + phase + 1) * 8 * shakeProgress;
      }

      // ---- explosion flight (75-90) ----
      let explosionDist = 0;
      if (frame >= 75) {
        explosionDist = Math.min(frame - 75, 15) * speed;
      }
      const explosionX = initialX + shakeX + Math.cos(angle) * explosionDist;
      const explosionY = initialY + shakeY + Math.sin(angle) * explosionDist;

      // ---- transition mix 80-100 ----
      const transProgress = interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

      // ---- flow position (90-150) ----
      let flowX: number, flowY: number;
      if (frame < 90) {
        flowX = explosionX;
        flowY = explosionY;
      } else {
        const t = (frame - 90) * 0.1;
        flowX = flowCenterX + ampX * Math.sin(freq * t + phase);
        flowY = flowCenterY + ampY * Math.cos(freq * t + phase + 1);
      }

      const mixedX = explosionX * (1 - transProgress) + flowX * transProgress;
      const mixedY = explosionY * (1 - transProgress) + flowY * transProgress;

      // ---- gather (150-200) ----
      const gatherProgress = interpolate(frame, [150, 190], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const gatherX = mixedX + (targetX - mixedX) * gatherProgress;
      const gatherY = mixedY + (targetY - mixedY) * gatherProgress;

      const displayX = frame < 150 ? mixedX : gatherX;
      const displayY = frame < 150 ? mixedY : gatherY;

      // ---- morph to code/energy ----
      const codeW = isEnergyBall ? 40 : 100;
      const codeH = isEnergyBall ? 40 : 30;
      const currentW = interpolate(frame, [80, 100], [width, codeW], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const currentH = interpolate(frame, [80, 100], [height, codeH], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const currentRadius = isEnergyBall
        ? '50%'
        : `${interpolate(frame, [80, 100], [guiType === 'icon' ? 12 : 6, 6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px`;
      const codeBg = interpolate(frame, [80, 100], [0, 0.92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const glowColor = '#0ff';

      // ---- opacity ----
      let opacity = 1;
      if (frame < appearDelay) opacity = 0;
      else if (frame >= 60 && frame < appearDelay + 10)
        opacity = interpolate(frame, [appearDelay, appearDelay + 10], [0, 1], { extrapolateLeft: 'clamp' });
      if (frame > 190) opacity = interpolate(frame, [190, 200], [1, 0], { extrapolateRight: 'clamp' });

      // ---- fragment style ----
      const fragStyle: React.CSSProperties = {
        position: 'absolute',
        left: displayX - currentW / 2,
        top: displayY - currentH / 2,
        width: currentW,
        height: currentH,
        borderRadius: currentRadius,
        backgroundColor: codeBg > 0.1 ? `rgba(10,25,50,${codeBg})` : color,
        boxShadow: codeBg > 0.1 ? `0 0 18px ${glowColor}` : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        fontFamily: codeBg > 0.5 ? 'monospace' : 'system-ui',
        fontSize: codeBg > 0.5 ? 14 : 16,
        color: codeBg > 0.5 ? glowColor : '#111',
        border: codeBg > 0.3 ? `1px solid ${glowColor}` : 'none',
        backdropFilter: codeBg > 0.1 ? 'blur(2px)' : undefined,
        zIndex: 5 + (codeBg > 0.1 ? 10 : 0),
      };

      // ---- inner content ----
      let content: React.ReactNode;
      if (codeBg > 0.5) {
        if (isEnergyBall) {
          content = (
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#0ff',
                boxShadow: '0 0 14px #0ff',
              }}
            />
          );
        } else {
          content = (
            <span style={{ textShadow: `0 0 12px ${glowColor}`, whiteSpace: 'nowrap' }}>
              {codeWord}
            </span>
          );
        }
      } else {
        if (guiType === 'icon') {
          content = <span style={{ fontSize: width > 50 ? 28 : 20 }}>{guiIcons[id % guiIcons.length]}</span>;
        } else if (guiType === 'button') {
          content = (
            <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>
              {guiButtons[id % guiButtons.length]}
            </span>
          );
        } else if (guiType === 'slider') {
          content = (
            <div style={{ display: 'flex', alignItems: 'center', width: '80%', height: '100%' }}>
              <div style={{ flex: 1, height: 4, backgroundColor: '#b0b0b0', borderRadius: 2, marginRight: 6 }} />
              <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#007aff' }} />
            </div>
          );
        } else if (guiType === 'menu') {
          content = (
            <span style={{ padding: '2px 8px', color: '#333', fontSize: 14 }}>
              {guiMenus[id % guiMenus.length]}
            </span>
          );
        } else if (guiType === 'balloon') {
          const tailDir = id % 2 === 0 ? 'left' : 'right';
          content = (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div
                style={{
                  backgroundColor: '#007aff',
                  borderRadius: 10,
                  padding: '6px 10px',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Hello
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: -6,
                  [tailDir === 'left' ? 'left' : 'right']: 10,
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid #007aff',
                }}
              />
            </div>
          );
        }
      }

      return (
        <div key={id} style={fragStyle}>
          {content}
        </div>
      );
    });

  return (
    <div style={bgStyle}>
      {/* ---- GUI Desktop Background Elements ---- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 30,
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
          opacity: menuOpacity,
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 18 }}>🍎</span>
        {['File', 'Edit', 'View', 'Go', 'Window', 'Help'].map((item) => (
          <span key={item} style={{ marginLeft: 24, fontSize: 14, color: '#333' }}>
            {item}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 14 }}>🔋 100% 🔉 📶</span>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 16,
          background: 'rgba(255,255,255,0.3)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          padding: '10px 20px',
          opacity: menuOpacity,
          zIndex: 2,
        }}
      >
        {dockEmojis.map((emoji, idx) => (
          <div
            key={idx}
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            {emoji}
          </div>
        ))}
      </div>

      {/* ---- Fragments (GUI/CUI transition) ---- */}
      {renderFragments()}

      {/* ---- Final input box (Claude style) ---- */}
      <div style={inputStyle}>
        <span style={{ color: '#888', fontSize: 18, flex: 1 }}>Ask anything...</span>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            backgroundColor: '#007aff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(0,122,255,0.5)',
          }}
        >
          <span style={{ color: 'white', fontSize: 20 }}>↑</span>
        </div>
      </div>

      {/* ---- Title "剪映" ---- */}
      <div style={titleStyle}>剪映</div>
    </div>
  );
};
