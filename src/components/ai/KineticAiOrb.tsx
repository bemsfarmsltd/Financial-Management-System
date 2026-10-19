'use client';

import React, { useEffect, useRef } from 'react';

interface Props {
  size?: 'compact' | 'hud' | 'hero';
  isTyping?: boolean;
  onClick?: () => void;
}

export function KineticAiOrb({ size = 'hud', isTyping = false, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const px = size === 'compact' ? 32 : size === 'hud' ? 44 : 110;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let rotation = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseRef.current.targetX = (e.clientX - cx) * 0.005;
      mouseRef.current.targetY = (e.clientY - cy) * 0.005;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      // Lerp mouse
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseRadius = canvas.width * 0.32;
      const tubeRadius = canvas.width * 0.14;

      const speed = isTyping ? 0.045 : 0.015;
      rotation += speed;

      const strands = size === 'compact' ? 36 : 64;
      const dTiltX = mouseRef.current.y;
      const dTiltY = mouseRef.current.x;

      for (let i = 0; i < strands; i++) {
        const u = (i / strands) * Math.PI * 2;
        const twistAngle = u * 2 + rotation;

        // 3D Toroidal Vortex point
        const r = baseRadius + tubeRadius * Math.cos(twistAngle);
        const z = tubeRadius * Math.sin(twistAngle);

        // Rotation around Y and tilt
        const rotU = u + rotation * 0.5;
        let x = r * Math.cos(rotU);
        let y = r * Math.sin(rotU) * 0.55 + z * 0.45;

        // Apply interactive tilt
        x += z * dTiltY;
        y += z * dTiltX;

        // Depth perspective
        const scale = 1 + z / (canvas.width * 1.5);
        const pxPos = cx + x * scale;
        const pyPos = cy + y * scale;

        // Filament length and angle
        const filamentLen = canvas.width * 0.18 * scale;
        const angle = rotU + Math.PI / 2 + Math.sin(twistAngle) * 0.4;

        const x2 = pxPos + Math.cos(angle) * filamentLen;
        const y2 = pyPos + Math.sin(angle) * filamentLen;

        // Color mapping from Optikka / Chromatic halo
        const colorRatio = (i / strands + rotation * 0.1) % 1;
        let strokeStyle: string;
        if (colorRatio < 0.33) {
          strokeStyle = `rgba(234, 88, 12, ${0.45 + scale * 0.35})`; // BEMS Orange
        } else if (colorRatio < 0.66) {
          strokeStyle = `rgba(245, 158, 11, ${0.4 + scale * 0.35})`; // Gold
        } else if (colorRatio < 0.85) {
          strokeStyle = `rgba(16, 185, 129, ${0.45 + scale * 0.35})`; // Emerald
        } else {
          strokeStyle = `rgba(113, 88, 222, ${0.4 + scale * 0.35})`; // Royal Purple
        }

        ctx.beginPath();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = size === 'compact' ? 1.2 : 1.6;
        ctx.lineCap = 'round';
        ctx.moveTo(pxPos, pyPos);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Center ambient glowing core
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 0.85);
      coreGrad.addColorStop(0, isTyping ? 'rgba(234, 88, 12, 0.4)' : 'rgba(234, 88, 12, 0.18)');
      coreGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.08)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 0.85, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [size, isTyping]);

  return (
    <div
      onClick={onClick}
      style={{
        width: `${px}px`,
        height: `${px}px`,
        display: 'grid',
        placeItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        filter: isTyping ? 'drop-shadow(0 0 12px rgba(234, 88, 12, 0.6))' : 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.35))',
        transition: 'filter 0.3s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <canvas
        ref={canvasRef}
        width={px * 2}
        height={px * 2}
        style={{
          width: `${px}px`,
          height: `${px}px`,
          display: 'block',
        }}
      />
    </div>
  );
}
