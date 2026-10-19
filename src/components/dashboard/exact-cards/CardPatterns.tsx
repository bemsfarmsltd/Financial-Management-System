'use client';

import React from 'react';

/**
 * Reusable SVG definitions for diagonal hatched patterns,
 * topographic wave contours, and custom geometric vector icons.
 */
export function CardPatternDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
      <defs>
        {/* Grey diagonal hatched pattern for incomplete bars and inactive arc */}
        <pattern id="diagonalHatchGrey" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="2.5" />
        </pattern>

        {/* Dark grey diagonal hatched pattern */}
        <pattern id="diagonalHatchDark" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2.5" />
        </pattern>

        {/* Blue diagonal hatched pattern for Reference 1 Funnel bars */}
        <pattern id="diagonalHatchBlue" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#93c5fd" strokeWidth="2.5" />
        </pattern>

        {/* Green diagonal hatched pattern for Gross Volume row */}
        <pattern id="diagonalHatchGreen" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#86efac" strokeWidth="2.2" />
        </pattern>

        {/* Pink diagonal hatched pattern for In-Store Sales row */}
        <pattern id="diagonalHatchPink" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#f472b6" strokeWidth="2.2" />
        </pattern>
      </defs>
    </svg>
  );
}

/**
 * Topographic wavy 3D contour lines for the Time Tracker card background
 */
export function TopographicBackground({ strokeColor }: { strokeColor?: string } = {}) {
  const stroke = strokeColor || '#fb923c';
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.35,
        borderRadius: '24px',
        overflow: 'hidden',
      }}
      viewBox="0 0 300 200"
      preserveAspectRatio="none"
    >
      <path
        d="M -20,30 Q 80,10 160,50 T 320,30"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <path
        d="M -20,60 Q 90,30 180,80 T 320,60"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <path
        d="M -20,90 Q 100,60 200,110 T 320,90"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <path
        d="M -20,120 Q 110,90 220,140 T 320,120"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <path
        d="M -20,150 Q 120,120 240,170 T 320,150"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <path
        d="M -20,180 Q 130,150 260,195 T 320,180"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      {/* Concentric oval curves on the right */}
      <ellipse cx="260" cy="70" rx="70" ry="40" fill="none" stroke={stroke} strokeWidth="1.2" />
      <ellipse cx="260" cy="70" rx="55" ry="30" fill="none" stroke={stroke} strokeWidth="1.2" />
      <ellipse cx="260" cy="70" rx="40" ry="20" fill="none" stroke={stroke} strokeWidth="1.2" />
      <ellipse cx="260" cy="70" rx="25" ry="12" fill="none" stroke={stroke} strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Geometric Vector Glyphs from Image 2 Project list
 */
export function ProjectGlyph({ type }: { type: 'endpoints' | 'onboarding' | 'dashboard' | 'optimize' | 'testing' }) {
  if (type === 'endpoints') {
    // 45-deg angled brand orange dual pills
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="8" width="16" height="5" rx="2.5" transform="rotate(-45 4 8)" fill="#ea580c" />
        <rect x="9" y="15" width="14" height="5" rx="2.5" transform="rotate(-45 9 15)" fill="#fb923c" />
      </svg>
    );
  }
  if (type === 'onboarding') {
    // Cyan 3-petal clover / connected arc
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="7" r="4.5" stroke="#0d9488" strokeWidth="2.5" />
        <circle cx="7" cy="15" r="4.5" stroke="#0d9488" strokeWidth="2.5" />
        <circle cx="17" cy="15" r="4.5" stroke="#0d9488" strokeWidth="2.5" />
      </svg>
    );
  }
  if (type === 'dashboard') {
    // 4-color propeller / cross
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 4V12H4" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 4V12H20" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 20V12H4" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 20V12H20" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'optimize') {
    // Yellow/orange crescent curve
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M5 19 C 5 10, 14 5, 20 5 C 17 14, 11 19, 5 19 Z" fill="#f59e0b" />
      </svg>
    );
  }
  // testing: clustered circular dots
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3.5" fill="#8b5cf6" />
      <circle cx="16" cy="9" r="3" fill="#a78bfa" />
      <circle cx="11" cy="16" r="4" fill="#6366f1" />
    </svg>
  );
}
