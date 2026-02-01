# Contributing to Stream Gate

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to Stream Gate. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 📚 Documentation

Before diving into the code, please read our [Architecture Guide](docs/ARCHITECTURE.md) to understand the system design, components, and data flow.

We also maintain a [Style Guide](docs/STYLE_GUIDE.md) to ensure consistent UI/UX design across the application. Please review it before making frontend changes.

## 🛠 Development Setup

### Prerequisites

*   **Node.js**: v18 or higher
*   **npm**: v9 or higher
*   **Git**

### Installation

1.  **Fork** the repository on GitHub.
2.  **Clone** your fork locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/Stream-Gate.git
    cd Stream-Gate
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    # This installs dependencies for both the Electron main process and the React UI
    ```

### Running Locally

To start the application in development mode with hot-reloading:

```bash
npm run dev
```

This command will:
1.  Start the Vite development server for the UI.
2.  Launch the Electron application pointing to the local Vite server.

### Building

To build the application for production:

```bash
# Build for your current platform
npm run build:mac   # For macOS
npm run build:win   # For Windows
npm run build:linux # For Linux
```

## 📂 Project Structure

*   `main.js`: Electron main process entry point.
*   `services/`: Backend logic (Service Layer Pattern).
*   `ui/`: React frontend application.
*   `binaries/`: Pre-compiled binaries for the core VPN engine.
*   `scripts/`: Build and utility scripts.

## 🧪 Testing

*   **Manual Testing**: Please manually verify your changes.
    *   Check light/dark mode.
    *   Check English/Persian (RTL) layouts.
    *   Verify connection toggling.
    *   Verify System Proxy settings.

## 🤝 Pull Request Process

1.  Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2.  Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3.  Increase the version numbers in any examples files and the README.md to the new version that this Pull Request would represent.
4.  You may merge the Pull Request in once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.

## 🐛 Reporting Bugs

Bugs are tracked as GitHub issues. When filing an issue, explain the problem and include additional details to help maintainers reproduce the problem:

*   Use a clear and descriptive title.
*   Describe the exact steps which reproduce the problem.
*   Provide specific examples to demonstrate the steps.
*   Describe the behavior you observed after following the steps.
*   Explain which behavior you expected to see instead and why.
*   Include screenshots if possible.

Thank you for contributing!
