'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  tabName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TabErrorBoundary] Caught client-side tab error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.tabName !== this.props.tabName && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          margin: '20px 0',
          borderRadius: '14px',
          background: '#fff',
          border: '1px solid #fee2e2',
          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.08)',
          textAlign: 'center',
          maxWidth: '640px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#fef2f2',
            color: '#dc2626',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <AlertTriangle size={24} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
            Could not render {this.props.tabName || 'this section'}
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
            A temporary client-side error occurred while loading this view. You can reload this section or return to the main Overview.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              Retry Section
            </button>
            {this.props.onReset && (
              <button
                onClick={this.props.onReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0d8a70',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Home size={14} />
                Return to Overview
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
