import { Component } from "react";
import { ErrorState } from "./States";

/** Keeps a rendering bug in one page from blanking the whole app. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="card">
          <ErrorState title="This page ran into a problem." message="Please reload the page. If it keeps happening, contact support."
            onRetry={() => this.setState({ failed: false })} />
        </div>
      );
    }
    return this.props.children;
  }
}
