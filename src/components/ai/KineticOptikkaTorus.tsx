'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Props {
  size?: number;
}

export function KineticOptikkaTorus({ size = 420 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let angleOffset = 0;
    let isRunning = true;

    // Set resolution for sharp rendering
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    setHasStarted(true);

    const centerX = (size * dpr) / 2;
    const centerY = (size * dpr) / 2;
    const majorRadius = (size * dpr) * 0.31;
    const minorRadius = (size * dpr) * 0.105;
    const totalFins = 160;

    const render = () => {
      if (!isRunning) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Collect all fins with depth for 3D painter's algorithm
      const fins: Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        depth: number;
        color: string;
        alpha: number;
        lineWidth: number;
      }> = [];

      for (let i = 0; i < totalFins; i++) {
        const u = (i / totalFins) * Math.PI * 2;
        // The mobius twist along the torus
        const twist = u * 1.5 + angleOffset;

        // Position of the center of this fin on the ring
        const rx = majorRadius * Math.cos(u + angleOffset * 0.4);
        const ry = majorRadius * Math.sin(u + angleOffset * 0.4) * 0.88; // subtle 3D tilt

        // Fin orientation vectors in 3D
        const dx = Math.cos(twist) * minorRadius;
        const dy = Math.sin(twist) * minorRadius;
        const dz = Math.sin(twist + u);

        const x1 = centerX + rx - dx;
        const y1 = centerY + ry - dy;
        const x2 = centerX + rx + dx;
        const y2 = centerY + ry + dy;

        // Depth for sorting (simulating 3D rotation)
        const depth = Math.sin(u + angleOffset * 0.4) * 100 + dz * 50;

        // Color interpolation: vibrant brand orange on one side, deep executive charcoal/slate on the other
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
          alpha = 0.95;
        } else {
          // Charcoal to light slate
          const t = (normalizedAngle - 0.52) / 0.48;
          const r = Math.round(45 + (130 - 45) * t);
          const g = Math.round(55 + (145 - 55) * t);
          const b = Math.round(72 + (165 - 72) * t);
          color = `rgb(${r}, ${g}, ${b})`;
          alpha = 0.78;
        }

        fins.push({
          x1,
          y1,
          x2,
          y2,
          depth,
          color,
          alpha,
          lineWidth: 2.2 * dpr,
        });
      }

      // Sort by depth (farthest first)
      fins.sort((a, b) => a.depth - b.depth);

      // Draw subtle luminous core glow at center
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, majorRadius * 0.9);
      coreGradient.addColorStop(0, 'rgba(249, 115, 22, 0.12)');
      coreGradient.addColorStop(0.5, 'rgba(234, 88, 12, 0.05)');
      coreGradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, majorRadius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Draw each fin
      ctx.lineCap = 'round';

      fins.forEach((fin) => {
        ctx.beginPath();
        ctx.lineWidth = fin.lineWidth;
        ctx.strokeStyle = fin.color;
        ctx.globalAlpha = fin.alpha;
        ctx.moveTo(fin.x1, fin.y1);
        ctx.lineTo(fin.x2, fin.y2);
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      angleOffset += 0.018;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [size]);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        style={{
          width: size,
          height: size,
          display: 'block',
          filter: 'drop-shadow(0 18px 36px rgba(234, 88, 12, 0.18))',
          transition: 'opacity 0.3s ease',
          opacity: hasStarted ? 1 : 0.8,
        }}
      />
    </div>
  );
}
