'use client';

import React from 'react';

interface DownloadButtonProps {
  href: string;
  fileName: string;
  label: string;
  gradient: string;
  shadow: string;
  textColor?: string;
}

export function DownloadButton({
  href,
  fileName,
  label,
  gradient,
  shadow,
  textColor = '#ffffff',
}: DownloadButtonProps) {
  return (
    <a
      href={href}
      download={fileName}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        padding: '14px',
        borderRadius: 12,
        background: gradient,
        color: textColor,
        fontSize: 14,
        fontWeight: 900,
        textDecoration: 'none',
        boxShadow: shadow,
        cursor: 'pointer',
      }}
    >
      {label}
    </a>
  );
}
