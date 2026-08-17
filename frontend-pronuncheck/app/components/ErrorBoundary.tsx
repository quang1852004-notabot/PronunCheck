"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Gui truc tiep loi UI ve Sentry de kich hoat canh bao tuc thi
    Sentry.withScope((scope) => {
      scope.setExtra("componentStack", errorInfo.componentStack);
      Sentry.captureException(error);
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-red-950/40 border border-red-800/50 text-white my-4 flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-red-500/20 rounded-full text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-200">
              {this.props.fallbackTitle || "Đã xảy ra lỗi giao diện"}
            </h3>
            <p className="text-sm text-gray-300 mt-1 max-w-md">
              {this.props.fallbackMessage ||
                "Hệ thống đã ghi nhận lỗi và gửi cảnh báo về đội ngũ phát triển. Vui lòng thử lại."}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition"
          >
            <RotateCcw className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
