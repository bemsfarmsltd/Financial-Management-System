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
  const triggerDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    try {
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (_) {
      window.location.href = href;
    }
  };

  return (
    <a
      href={href}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      onClick={triggerDownload}
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
      <span>{label}</span>
    </a>
  );
}
