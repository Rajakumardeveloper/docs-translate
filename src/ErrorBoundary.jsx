import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Top-Level Application Error Boundary
 *
 * Prevents blank white screens by intercepting any unexpected runtime exceptions,
 * providing clear Hindi feedback to the student with one-tap recovery options.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ReadHindi ErrorBoundary caught an exception:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f7fbff",
            padding: "20px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: "#0f172a"
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "28px 24px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px"
              }}
            >
              <AlertCircle size={28} />
            </div>

            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>
              ReadHindi — पेज लोड करने में समस्या आई
            </h1>

            <p style={{ fontSize: "0.95rem", color: "#64748b", margin: "0 0 20px", lineHeight: 1.5 }}>
              एक अप्रत्याशित त्रुटि के कारण पेज लोड नहीं हो सका। कृपया नीचे दिए गए बटन से पुनः प्रयास करें।
            </p>

            {this.state.error && (
              <pre
                style={{
                  backgroundColor: "#f8fafc",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  overflowX: "auto",
                  textAlign: "left",
                  marginBottom: "20px",
                  border: "1px solid #e2e8f0"
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer"
                }}
              >
                <RotateCcw size={16} />
                पेज रीलोड करें (Reload)
              </button>

              <button
                onClick={this.handleReset}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer"
                }}
              >
                रीसेट करें (Reset & Reload)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
