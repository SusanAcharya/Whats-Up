# Design System: What's Up

## 1. Visual Theme & Atmosphere

A mobile-first news chat PWA. The mood is **iOS-native dark messaging**: quiet void canvas, hairline structure, bot color as the only chromatic energy. Density is conversational (4/10), not dashboard. Motion is subtle spring-like CSS (5/10). Variance is low (3/10) because chat UX must feel familiar, not experimental.

Inspired by Linear's precision ([awesome-design-md](https://github.com/VoltAgent/awesome-design-md)) and Superhuman's editorial weight, adapted for DM-style news delivery.

## 2. Color Palette & Roles

- **Void Canvas** (`#0a0a0c`) - App background, status bar blend
- **Panel** (`#121214`) - Chat list, settings base
- **Elevated** (`#1a1a1e`) - Active row, composer field
- **Hairline** (`rgba(255,255,255,0.07)`) - Dividers, borders
- **Hairline Strong** (`rgba(255,255,255,0.12)`) - Focus, active borders
- **Ink** (`#f4f4f5`) - Primary text
- **Ink Muted** (`#a1a1aa`) - Preview text, subtitles
- **Ink Faint** (`#71717a`) - Timestamps, meta
- **Timeline Signal** (`#e8956f`) - Group chat accent only (desaturated coral)
- **Sent Bubble** (`#0a84ff`) - User messages (iOS blue)
- **Sent Text** (`#ffffff`) - Text on sent bubble
- **System Pill** (`rgba(255,255,255,0.06)`) - Day chips, system messages

Bot accent colors stay per-bot for avatars and news cards. UI chrome uses neutrals only.

## 3. Typography Rules

- **UI**: Geist Sans - weights 400 (body), 500 (labels), 600 (titles)
- **Meta**: Geist Mono - timestamps, counts, tabular nums
- **Scale**: 11px meta, 13px preview, 15px body/chat, 17px screen title, 28px onboarding headline
- **Tracking**: -0.02em on titles only
- **Banned**: Syne, Inter as hero, all-caps section labels, em-dashes

## 4. Component Stylings

- **List row**: 72px min-height, 48px avatar, 2-line preview, hairline separator inset from avatar
- **Chat bubble**: 18px radius, clustered tails, inline timestamp
- **News card**: Full-width inset card, 3px left accent bar in bot color, link row below
- **Composer**: 44px min field, 36px send button, safe-area bottom padding
- **Primary button**: Full-width 48px, white fill, black label, 12px radius
- **Toggle**: 51x31px iOS-style switch
- **Tab bar (settings)**: Segmented control in elevated surface

## 5. Layout Principles

- Mobile-first: single column, 100dvh shell, no horizontal scroll
- Safe areas: `env(safe-area-inset-*)` on header and composer
- Desktop (768px+): 320px fixed list + flexible thread
- Touch targets: minimum 44px
- Spacing scale: 4, 8, 12, 16, 20, 24, 32

## 6. Motion & Interaction

- Message enter: 180ms opacity + 4px translateY
- Press: scale(0.98) on buttons
- Reduced motion: disable all animation
- Focus: 2px white/40 outline offset 2px

## 7. Anti-Patterns (Banned)

- Purple/blue AI gradients
- Glassmorphism on every surface
- Syne display font everywhere
- Arbitrary font sizes (no 10.5px, 13.7px)
- Full-screen settings on desktop without side panel
- Orange `#fb923c` group accent (use Timeline Signal instead)
- Em-dashes in UI copy

## 8. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| < 768px | Single view: list OR thread |
| >= 768px | Split: list + thread, settings as 380px side sheet |
