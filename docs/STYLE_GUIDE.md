# Stream Gate Style Guide

This document outlines the design principles, typography, color system, and component standards used in Stream Gate. We strive for a "Premium, Glassmorphism" aesthetic that bridges the gap between complex networking tools and a beautiful consumer experience.

## 🎨 Design Philosophy

*   **Glassmorphism**: Enhanced depth using translucent backgrounds (`backdrop-blur`), subtle borders, and layered elements.
*   **Vibrant & Deep**: We rely on a "Deep Blue" theme (`hsl(224, 71%, 4%)`) rather than standard flat black for dark mode to create a richer atmosphere.
*   **Bilingual Mastery**: The application is first-class for both English (LTR) and Persian (RTL). All components must handle directionality gracefully without disjointed layouts.

---

## 🅰️ Typography

We use **Vazirmatn** for all text (English and Persian) to ensure visual consistency and seamless mixing of languages.

*   **Font Family**: `Vazirmatn`, sans-serif
*   **Weights**:
    *   **Regular (400)**: Body text
    *   **Medium (500)**: Button labels, navigation
    *   **Bold (700)**: Headings, emphasized stats
*   **Letter Spacing**: Set to `0` specifically to prevent disjointed ligatures in Persian script.

> **Note**: Monospace fonts are overridden for Persian text to ensure readability, except in specific system log containers.

---

## 🍭 Color Palette

We use CSS variables with HSL values for dynamic theming (Light/Dark).

### Dark Mode (Default)
The dark mode is a carefully curated "Deep Space" palette.

| Token | HSL Value | Use Case |
|-------|-----------|----------|
| `background` | `224 71% 4%` | Main app background (Very dark blue) |
| `foreground` | `213 31% 91%` | Primary text color (Off-white) |
| `primary` | `217 91% 60%` | Call-to-action buttons, active states (Vibrant Blue) |
| `muted` | `223 47% 11%` | Secondary backgrounds, inactive items |
| `border` | `216 34% 17%` | Subtle borders for separation |

### Light Mode
The light mode maintains the blue identity but shifts to a crisp, clean brightness.

| Token | HSL Value | Use Case |
|-------|-----------|----------|
| `background` | `0 0% 100%` | Pure white background |
| `foreground` | `222.2 84% 4.9%` | Primary text (Dark Navy) |
| `primary` | `221.2 83.2% 53.3%` | Primary Blue |
| `muted` | `210 40% 96.1%` | Light gray/blue backgrounds |

---

## 🧩 Components & Radius

We use **Shadcn UI** (Radix Primitives + Tailwind) as our base component library.

*   **Radius**: `0.75rem` (12px). We prefer softer, friendlier corners over sharp edges.
*   **Transitions**: All theme changes animate smoothly (`0.5s ease-in-out`).
*   **Scrollbars**: Custom "Premium" scrollbar:
    *   Thin (10px)
    *   Translucent track
    *   Hover-aware thumb

---

## 🌐 Layout & Spacing

*   **Container**: We often center content with a max-width of `1400px`.
*   **Spacing Scale**: Standard Tailwind spacing (rem-based).
*   **RTL Support**:
    *   Use `flex-start` / `flex-end` conceptual positioning.
    *   Avoid hardcoded `left-*` or `right-*` utilities; strict usage of `ms-*` (margin-start) and `me-*` (margin-end).

## 🖱️ Micro-Interactions

*   **Hover States**: Interactive elements should have immediate, clear feedback (brightness bump or subtle scale).
*   **Active States**: "Press" effects (scale down 0.98) on major buttons give a tactile feel.

---

## 💻 Tech Stack

*   **Tailwind CSS**: Utility-first styling.
*   **Tailwind Animate**: For easy entry/exit animations.
*   **Framer Motion**: For complex layout transitions.
*   **Lucide React**: For consistent, clean SVG iconography.
