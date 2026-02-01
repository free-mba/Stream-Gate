# Contributing to Stream Gate

Thank you for your interest in contributing to Stream Gate! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Stream-Gate.git
   cd Stream-Gate
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

1. Make your changes
2. Test your changes:
   ```bash
   npm start  # Test in development mode
   ```
3. Ensure code quality:
   - Follow existing code style
   - Test on both macOS and Windows if possible
   - Check that the app builds successfully

## Submitting Changes

1. **Commit your changes**:
   ```bash
   git commit -m "Add: Description of your changes"
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub

## Code Style

- Use consistent indentation (spaces, not tabs)
- Follow JavaScript best practices
- Comment complex logic
- Keep functions focused and small

## Testing

Before submitting:
- [ ] Test on your platform (macOS/Windows)
- [ ] Test VPN start/stop functionality
- [ ] Test system proxy configuration
- [ ] Verify no console errors
- [ ] Check that the app builds successfully

## Reporting Issues

When reporting bugs:
- Include OS version and app version
- Describe steps to reproduce
- Include relevant logs
- Add screenshots if applicable

## Feature Requests

For new features:
- Explain the use case
- Describe the proposed solution
- Consider backward compatibility

Thank you for contributing! 🎉
