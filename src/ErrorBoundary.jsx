import React, { Component } from "react";
import Header from "./Header";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("App error boundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="App">
          <Header />
          <div className="restPage">
            <p>Something went wrong. Please refresh the page.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
