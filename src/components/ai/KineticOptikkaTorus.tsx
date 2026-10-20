'use client';

import React, { useEffect, useRef } from 'react';

interface Props {
  size?: number;
}

export function KineticOptikkaTorus({ size = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angleOffset = 0;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const majorRadius = size * 0.28;
    const minorRadius = size * 0.085;
    const totalFins = 120;

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // Collect all fins with depth for painter's algorithm
      const fins: Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        depth: number;
        color: string;
        alpha: number;
      }> = [];

      for (let i = 0; i < totalFins; i++) {
        const u = (i / totalFins) * Math.PI * 2;
        // The mobius twist around the ring
        const twist = u * 1.5 + angleOffset;

        // Position of the center of this fin on the ring
        const rx = majorRadius * Math.cos(u + angleOffset * 0.4);
        const ry = majorRadius * Math.sin(u + angleOffset * 0.4) * 0.88; // subtle tilt

        // Fin orientation vectors
        const dx = Math.cos(twist) * minorRadius;
        const dy = Math.sin(twist) * minorRadius;
        const dz = Math.sin(twist + u);

        const x1 = centerX + rx - dx;
        const y1 = centerY + ry - dy;
        const x2 = centerX + rx + dx;
        const y2 = centerY + ry + dy;

        // Depth for sorting (simulating 3D rotation)
        const depth = Math.sin(u + angleOffset * 0.4) * 100 + dz * 50;

        // Color interpolation: orange on one side, slate/charcoal on the other
        const normalizedAngle = (u % (Math.PI * 2)) / (Math.PI * 2);
        let color: string;
        let alpha = 0.85;

        if (normalizedAngle < 0.48) {
          // Vibrant brand orange gradient
          const t = normalizedAngle / 0.48;
          const r = Math.round(234 + (249 - 234) * t);
          const g = Math.round(88 + (115 - 88) * t);
          const b = Math.round(12 + (22 - 12) * t);
          color = `rgb(${r}, ${g}, ${b})`;
          alpha = 0.95;
        } else if (normalizedAngle < 0.52) {
          // Blend zone
          color = '#ea580c';
        } else {
          // Charcoal to light slate
          const t = (normalizedAngle - 0.52) / 0.48;
          const r = Math.round(51 + (148 - 51) * t);
          const g = Math.round(65 + (163 - 65) * t);
          const b = Math.round(85 + (184 - 85) * t);
          color = `rgb(${r}, ${g}, ${b})`;
          alpha = 0.75;
        }

        fins.push({ x1, y1, x2, y2, depth, color, alpha });
      }

      // Sort by depth (farthest first)
      fins.sort((a, b) => a.depth - b.depth);

      // Draw each fin
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';

      fins.forEach((fin) => {
        ctx.beginPath();
        ctx.strokeStyle = fin.color;
        ctx.globalAlpha = fin.alpha;
        ctx.moveTo(fin.x1, fin.y1);
        ctx.lineTo(fin.x2, fin.y2);
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      angleOffset += 0.016;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size]);

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: 'block',
          filter: 'drop-shadow(0 14px 28px rgba(234, 88, 12, 0.12))',
        }}
      />
    </div>
  );
}
