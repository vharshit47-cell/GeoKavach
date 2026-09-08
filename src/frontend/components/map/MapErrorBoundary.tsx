"use client";
import { Component, type ReactNode } from "react";

export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="atlas-map-failure" role="alert"><strong>Map rendering temporarily unavailable.</strong><p>Your assessments and relocation workflow remain available.</p><button onClick={() => this.setState({ failed: false })}>Reload map</button></div> : this.props.children;
  }
}
