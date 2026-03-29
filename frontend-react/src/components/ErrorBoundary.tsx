import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#ffebee',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h1 style={{ color: '#c62828' }}>Er is iets misgegaan</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            {this.state.error?.message || 'Onbekende fout'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/login';
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Terug naar login
          </button>
          <details style={{ marginTop: '20px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#666' }}>
              Technische details
            </summary>
            <pre style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              overflow: 'auto',
              maxWidth: '800px',
              fontSize: '12px'
            }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
