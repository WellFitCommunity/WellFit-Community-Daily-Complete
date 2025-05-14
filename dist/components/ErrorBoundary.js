"use strict";
// src/components/ErrorBoundary.tsx
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
class ErrorBoundary extends react_1.default.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('🔥 ErrorBoundary caught:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (<div style={{
                    backgroundColor: '#003865',
                    color: '#fff',
                    padding: '2rem',
                    fontFamily: 'Arial, sans-serif',
                    minHeight: '100vh',
                }}>
          <h2>🚨 A critical error occurred in the app.</h2>
          <p>{this.state.error?.message}</p>
          <p>Check the browser console for technical details.</p>
        </div>);
        }
        return this.props.children;
    }
}
exports.default = ErrorBoundary;
