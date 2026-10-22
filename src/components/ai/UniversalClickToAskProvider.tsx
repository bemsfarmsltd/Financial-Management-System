'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { harvestElementContext, ElementContextPayload } from './useUniversalContextHarvester';
import { ContextualAskPopover } from './ContextualAskPopover';

interface UniversalClickToAskContextType {
  isInspectMode: boolean;
  toggleInspectMode: () => void;
  inspectElement: (element: HTMLElement, x?: number, y?: number) => void;
}

const UniversalClickToAskContext = createContext<UniversalClickToAskContextType | undefined>(undefined);

export function useUniversalClickToAsk() {
  const ctx = useContext(UniversalClickToAskContext);
  if (!ctx) {
    throw new Error('useUniversalClickToAsk must be used within UniversalClickToAskProvider');
  }
  return ctx;
}

interface Props {
  children: React.ReactNode;
  currentPage: string;
  businessName: string;
  isInspectMode?: boolean;
  onToggleInspectMode?: () => void;
  onAskContextualQuestion: (question: string, context: ElementContextPayload) => void;
}

export function UniversalClickToAskProvider({
  children,
  currentPage,
  businessName,
  isInspectMode: controlledInspectMode,
  onToggleInspectMode: controlledToggleInspectMode,
  onAskContextualQuestion,
}: Props) {
  const [internalInspectMode, setInternalInspectMode] = useState(false);
  const isInspectMode = controlledInspectMode !== undefined ? controlledInspectMode : internalInspectMode;

  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string>('');
  const [activeContext, setActiveContext] = useState<ElementContextPayload | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const isInspectModeRef = useRef(isInspectMode);
  isInspectModeRef.current = isInspectMode;

  const toggleInspectMode = useCallback(() => {
    if (controlledToggleInspectMode) {
      controlledToggleInspectMode();
    } else {
      setInternalInspectMode((prev) => !prev);
    }
    setHoverRect(null);
  }, [controlledToggleInspectMode]);

  const inspectElement = useCallback(
    (element: HTMLElement, clientX?: number, clientY?: number) => {
      const payload = harvestElementContext(element, currentPage, businessName);
      const rect = element.getBoundingClientRect();
      const x = clientX ?? rect.left + rect.width / 2;
      const y = clientY ?? rect.bottom;
      setActiveContext(payload);
      setPopoverPos({ x, y });
      if (controlledInspectMode && controlledToggleInspectMode) {
        controlledToggleInspectMode();
      } else {
        setInternalInspectMode(false);
      }
      setHoverRect(null);
    },
    [currentPage, businessName, controlledInspectMode, controlledToggleInspectMode]
  );

  // Keyboard shortcut listener: Option+I or Alt+I to toggle inspect mode, Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleInspectMode();
      }
      if (e.key === 'Escape') {
        if (isInspectModeRef.current) {
          if (controlledToggleInspectMode) {
            controlledToggleInspectMode();
          } else {
            setInternalInspectMode(false);
          }
          setHoverRect(null);
        }
        setActiveContext(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleInspectMode]);

  // Global mousemove and click listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isInspectModeRef.current) return;
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!target || target.closest('.ambient-bottom-ai-wrapper') || target.closest('.universal-inspect-overlay')) {
        setHoverRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setHoverRect(rect);
      const text = (target.getAttribute('aria-label') || target.innerText || target.textContent || '').trim().slice(0, 32);
      setHoverLabel(text || target.tagName.toLowerCase());
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('*') as HTMLElement | null;
      if (!target) return;

      // Ignore clicks inside the AI bar or active popover
      if (target.closest('.ambient-bottom-ai-wrapper') || target.closest('.contextual-ask-popover-container')) {
        return;
      }

      // Case 1: Active inspection mode click
      if (isInspectModeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        inspectElement(target, e.clientX, e.clientY);
        return;
      }

      // Case 2: Option+Click or Alt+Click anytime
      if (e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        inspectElement(target, e.clientX, e.clientY);
        return;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('click', handleClick, true); // Capture phase to intercept clicks cleanly

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick, true);
    };
  }, [inspectElement]);

  return (
    <UniversalClickToAskContext.Provider
      value={{
        isInspectMode,
        toggleInspectMode,
        inspectElement,
      }}
    >
      {children}

      {/* Visual Hover Highlight Ring when Inspect Mode is Active */}
      {isInspectMode && hoverRect && (
        <div
          className="universal-inspect-overlay"
          style={{
            position: 'fixed',
            left: `${hoverRect.left}px`,
            top: `${hoverRect.top}px`,
            width: `${hoverRect.width}px`,
            height: `${hoverRect.height}px`,
            border: '2px solid #ea580c',
            backgroundColor: 'rgba(234, 88, 12, 0.10)',
            borderRadius: '6px',
            pointerEvents: 'none',
            zIndex: 9980,
            transition: 'all 0.05s ease-out',
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.8), 0 4px 16px rgba(234, 88, 12, 0.25)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 4px)',
              left: '0',
              background: '#ea580c',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>🎯 Click to Ask AI</span>
            {hoverLabel ? <span style={{ opacity: 0.85, fontWeight: 500 }}>· {hoverLabel}</span> : null}
          </span>
        </div>
      )}

      {/* Floating Contextual Ask Popover */}
      {activeContext && (
        <div className="contextual-ask-popover-container">
          <ContextualAskPopover
            context={activeContext}
            position={popoverPos}
            onClose={() => setActiveContext(null)}
            onSubmit={(query, ctxPayload) => {
              onAskContextualQuestion(query, ctxPayload);
            }}
          />
        </div>
      )}
    </UniversalClickToAskContext.Provider>
  );
}
