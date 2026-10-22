'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';

export interface AmaraAvatarProps {
  userName?: string;
  userRole?: string;
  statusText?: string;
  metricBadge?: { label: string; text: string; color?: string };
  isDissolving?: boolean;
  onReady?: () => void;
  interactive?: boolean;
  size?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  size: number;
  alpha: number;
  color: string;
  phase: number;
  speed: number;
  layer: number;
}

export function AmaraHologramAvatar({
  userName = 'Dr Pastra',
  userRole = 'GMD',
  statusText,
  metricBadge,
  isDissolving = false,
  onReady,
  interactive = true,
  size = 520,
}: AmaraAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<'awakening' | 'active' | 'speaking' | 'dissolving'>('awakening');
  const [subtitle, setSubtitle] = useState<string>('');
  const [isBlinking, setIsBlinking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.2);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  // Formulate dynamic greeting based on time of day
  const greetingSubtitle = useMemo(() => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const cleanName = userName?.trim() || 'Dr Pastra';
    return `${timeOfDay}, ${cleanName}. I'm listening...`;
  }, [userName]);

  // Handle avatar lifecycle transitions
  useEffect(() => {
    if (isDissolving) {
      setState('dissolving');
      setSubtitle('Goodbye...');
      return;
    }

    // Step 1: Awakening (particles surge upward)
    const t1 = setTimeout(() => {
      setState('active');
      setSubtitle(greetingSubtitle);
      if (onReady) onReady();
    }, 1800);

    // Step 2: Speaking briefing
    const t2 = setTimeout(() => {
      setState('speaking');
      if (statusText) {
        setSubtitle(statusText);
      }
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [greetingSubtitle, statusText, isDissolving, onReady]);

  // Natural eye blinking loop
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        blinkTimeout = setTimeout(triggerBlink, 3000 + Math.random() * 4000);
      }, 140);
    };
    blinkTimeout = setTimeout(triggerBlink, 2200);
    return () => clearTimeout(blinkTimeout);
  }, []);

  // Mouse parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouseOffset({ x: x * 12, y: y * 8 });
  };

  // Canvas GPU Particle & Terrain Waveform Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = size * 2);
    let height = (canvas.height = size * 2);

    const centerX = width / 2;
    const centerY = height * 0.52;

    // Define silhouette shape targets for particles (head, neck, shoulders)
    const particleCount = 1200;
    const particles: Particle[] = [];
    const colors = ['#f59e0b', '#ea580c', '#38bdf8', '#60a5fa', '#fed7aa', '#0284c7'];

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const angle = Math.random() * Math.PI * 2;
      let targetX = centerX;
      let targetY = centerY;

      if (i < 400) {
        // Head / Face ellipse
        const r = (35 + Math.random() * 55) * (size / 300);
        const theta = Math.random() * Math.PI * 2;
        targetX = centerX + Math.cos(theta) * (r * 0.75);
        targetY = centerY - 65 * (size / 300) + Math.sin(theta) * r;
      } else if (i < 800) {
        // Shoulders & Chest curve
        const shoulderSpread = (Math.random() - 0.5) * 240 * (size / 300);
        targetX = centerX + shoulderSpread;
        const arch = Math.pow(Math.abs(shoulderSpread) / (120 * (size / 300)), 1.8) * 45;
        targetY = centerY + 45 * (size / 300) + arch + (Math.random() - 0.5) * 25;
      } else {
        // Luminous aura wings
        const wingT = Math.random() * Math.PI;
        const side = Math.random() > 0.5 ? 1 : -1;
        targetX = centerX + side * (Math.sin(wingT) * 160 + Math.random() * 30) * (size / 300);
        targetY = centerY - 100 * (size / 300) + Math.cos(wingT) * 140 * (size / 300);
      }

      particles.push({
        x: centerX + (Math.random() - 0.5) * width * 0.8,
        y: height + Math.random() * 200, // Start below bottom
        vx: 0,
        vy: -2 - Math.random() * 3,
        originX: centerX,
        originY: height,
        targetX,
        targetY,
        size: 1.2 + Math.random() * 2.2,
        alpha: 0.1 + Math.random() * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.04,
        layer: Math.random(),
      });
    }

    let time = 0;

    const render = () => {
      time += 0.025;
      ctx.clearRect(0, 0, width, height);

      // ----------------------------------------------------
      // 1. Audio Frequency Terrain Waveform (Behind Avatar)
      // ----------------------------------------------------
      const waveCount = 5;
      const baseWaveY = centerY + 10 * (size / 300);

      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const waveProgress = w / waveCount;
        const alpha = (0.28 - waveProgress * 0.04) * (state === 'awakening' ? Math.min(time * 0.6, 1) : 1);
        ctx.strokeStyle = w % 2 === 0 ? `rgba(56, 189, 248, ${alpha})` : `rgba(234, 88, 12, ${alpha * 0.8})`;
        ctx.lineWidth = 1.4;

        const freq = 0.007 + w * 0.002;
        const amp = (16 + w * 8) * (state === 'speaking' ? 1.6 : 1.0);

        for (let x = 0; x <= width; x += 6) {
          const distFromCenter = Math.abs(x - centerX) / (width * 0.5);
          const damping = Math.exp(-Math.pow(distFromCenter * 1.8, 2));
          const noise = Math.sin(x * freq + time * 1.8 + w) * Math.cos(x * 0.003 - time * 0.8);
          const y = baseWaveY + noise * amp * damping + w * 18 * (size / 300);

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // ----------------------------------------------------
      // 2. GPU Particle Swarm (Amara Awakening / Ambient)
      // ----------------------------------------------------
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += p.speed;

        if (state === 'awakening') {
          // Surge toward target silhouette
          p.x += (p.targetX - p.x) * 0.045;
          p.y += (p.targetY - p.y) * 0.045;
        } else if (state === 'dissolving') {
          // Scatter down and fade
          p.vy += 0.2;
          p.y += p.vy;
          p.x += Math.sin(p.phase) * 3;
          p.alpha = Math.max(0, p.alpha - 0.025);
        } else {
          // Active & Speaking: harmonic vibration around silhouette
          const floatOffset = Math.sin(p.phase + time) * 6;
          const targetWithFloatX = p.targetX + Math.cos(p.phase) * 4;
          const targetWithFloatY = p.targetY + floatOffset;
          p.x += (targetWithFloatX - p.x) * 0.08;
          p.y += (targetWithFloatY - p.y) * 0.08;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1.0;

      // ----------------------------------------------------
      // 3. Central Energy Core (Pulsing Chest Reactor)
      // ----------------------------------------------------
      if (state !== 'dissolving') {
        const coreX = centerX;
        const coreY = centerY + 65 * (size / 300);
        const coreRadius = (16 + Math.sin(time * 3) * 3) * (size / 300);

        const coreGradient = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreRadius * 2.5);
        coreGradient.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
        coreGradient.addColorStop(0.3, 'rgba(234, 88, 12, 0.85)');
        coreGradient.addColorStop(0.7, 'rgba(14, 165, 233, 0.3)');
        coreGradient.addColorStop(1, 'rgba(14, 165, 233, 0)');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(coreX, coreY, coreRadius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size, state]);

  // Breathing animation style
  const breathingOffset = Math.sin(Date.now() / 800) * 4;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: `${size}px`,
        maxWidth: '100vw',
        height: `${size * 1.05}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* Background Particle & Audio Terrain Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Cybernetic Amara Holographic SVG Model */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: `${size * 0.72}px`,
          height: `${size * 0.82}px`,
          transform: `translate3d(${mouseOffset.x}px, ${mouseOffset.y + breathingOffset}px, 0) scale(${state === 'awakening' ? 0.95 : 1.0})`,
          opacity: state === 'dissolving' ? 0.1 : 1,
          transition: 'transform 0.25s ease-out, opacity 0.5s ease',
          filter: 'drop-shadow(0 0 35px rgba(56, 189, 248, 0.35)) drop-shadow(0 15px 45px rgba(234, 88, 12, 0.25))',
        }}
      >
        <svg
          viewBox="0 0 400 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            {/* Holographic Gradients */}
            <radialGradient id="amaraSkin" cx="50%" cy="38%" r="60%">
              <stop offset="0%" stopColor="#2c1a16" />
              <stop offset="55%" stopColor="#190e0c" />
              <stop offset="90%" stopColor="#0b0808" />
              <stop offset="100%" stopColor="#050508" />
            </radialGradient>

            <linearGradient id="cyberBronze" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="35%" stopColor="#92400e" />
              <stop offset="70%" stopColor="#451a03" />
              <stop offset="100%" stopColor="#1c1917" />
            </linearGradient>

            <linearGradient id="neonCyanGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Shoulders & Cybernetic Torso Armor */}
          <path
            d="M80 470 C 95 380, 140 330, 175 320 L 225 320 C 260 330, 305 380, 320 470 Z"
            fill="url(#cyberBronze)"
            stroke="#f59e0b"
            strokeWidth="1.2"
            opacity="0.9"
          />

          {/* Cybernetic Neck & Collar Mesh */}
          <path
            d="M172 260 C 168 285, 168 310, 175 325 L 225 325 C 232 310, 232 285, 228 260 Z"
            fill="#1e1b18"
            stroke="url(#neonCyanGlow)"
            strokeWidth="1.2"
          />
          {/* Neck conduits */}
          <line x1="188" y1="265" x2="188" y2="320" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
          <line x1="212" y1="265" x2="212" y2="320" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />

          {/* Head & Facial Sculpt (Black African Android Feature Aesthetics) */}
          <ellipse cx="200" cy="180" rx="68" ry="86" fill="url(#amaraSkin)" stroke="#78350f" strokeWidth="0.8" />

          {/* Specular Cheek & Brow Bone Highlights */}
          <path
            d="M152 170 C 158 190, 168 206, 185 214"
            stroke="#ea580c"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.45"
            fill="none"
          />
          <path
            d="M248 170 C 242 190, 232 206, 215 214"
            stroke="#ea580c"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.45"
            fill="none"
          />

          {/* Sculpted Lips with Subtle Motion */}
          <path
            d={
              state === 'speaking'
                ? "M182 226 Q 200 234 218 226 Q 200 240 182 226" // open expressive speaking
                : "M184 228 Q 200 233 216 228 Q 200 236 184 228" // serene warm smile
            }
            fill="#831843"
            stroke="#fb7185"
            strokeWidth="0.8"
            opacity="0.85"
            style={{ transition: 'd 0.2s ease' }}
          />

          {/* Cybernetic Forehead Circuit Inlay */}
          <path
            d="M194 116 L 200 124 L 206 116 L 200 108 Z"
            fill="#38bdf8"
            filter="url(#eyeGlow)"
            opacity="0.9"
          />

          {/* Luminous Electric-Blue Eyes */}
          {/* Left Eye */}
          <g transform="translate(162, 165)">
            <ellipse cx="0" cy="0" rx="16" ry="7.5" fill="#080c14" stroke="#0284c7" strokeWidth="0.8" />
            {!isBlinking && state !== 'dissolving' ? (
              <>
                <circle cx="0" cy="0" r="6.5" fill="#38bdf8" filter="url(#eyeGlow)" />
                <circle cx="0" cy="0" r="3.2" fill="#0f172a" />
                <circle cx="2" cy="-2" r="1.4" fill="#ffffff" />
              </>
            ) : (
              <line x1="-15" y1="0" x2="15" y2="0" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
            )}
          </g>

          {/* Right Eye */}
          <g transform="translate(238, 165)">
            <ellipse cx="0" cy="0" rx="16" ry="7.5" fill="#080c14" stroke="#0284c7" strokeWidth="0.8" />
            {!isBlinking && state !== 'dissolving' ? (
              <>
                <circle cx="0" cy="0" r="6.5" fill="#38bdf8" filter="url(#eyeGlow)" />
                <circle cx="0" cy="0" r="3.2" fill="#0f172a" />
                <circle cx="2" cy="-2" r="1.4" fill="#ffffff" />
              </>
            ) : (
              <line x1="-15" y1="0" x2="15" y2="0" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
            )}
          </g>

          {/* Central Holographic Heart Core Glow */}
          <circle cx="200" cy="380" r="22" fill="#0284c7" opacity="0.3" filter="url(#eyeGlow)" />
          <circle cx="200" cy="380" r="10" fill="#38bdf8" filter="url(#eyeGlow)" />
          <circle cx="200" cy="380" r="4" fill="#ffffff" />
        </svg>
      </div>

      {/* Interactive Subtitle Bar (Kingsley Orji Style) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          marginTop: '-15px',
          width: 'min(580px, 92vw)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Metric Pill Badge if supplied */}
        {metricBadge && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '3px 12px',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              marginBottom: '10px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: metricBadge.color || '#ea580c',
                boxShadow: `0 0 8px ${metricBadge.color || '#ea580c'}`,
              }}
            />
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: '#94a3b8', textTransform: 'uppercase' }}>
              {metricBadge.label}
            </span>
          </div>
        )}

        {/* Subtitle Glass Container */}
        <div
          style={{
            padding: '12px 24px',
            borderRadius: '16px',
            background: 'rgba(11, 18, 32, 0.82)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
            minHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            transition: 'all 0.3s ease',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 650,
              color: '#f8fafc',
              letterSpacing: '-0.015em',
              lineHeight: 1.45,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
            }}
          >
            {subtitle || `Hi ${userName || 'Dr Pastra'}, I'm listening...`}
          </p>
        </div>
      </div>
    </div>
  );
}
