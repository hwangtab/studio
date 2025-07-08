# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Studio Nol is a React-based music studio website featuring:
- **Main Frontend**: React SPA with React Router for navigation
- **Backend Server**: Express.js server for booking and data management
- **Static Story System**: Markdown-based content management that compiles to JSON
- **Deployment**: Vercel hosting with GitHub Pages support

## Key Technologies

- **Frontend**: React 18, React Router, Material-UI, Tailwind CSS, Framer Motion
- **Backend**: Express.js, LowDB, CORS
- **Content**: Markdown with gray-matter for frontmatter parsing
- **Styling**: Tailwind CSS with custom theme, PostCSS
- **Internationalization**: i18next with Korean/English support
- **Audio**: react-h5-audio-player for music playback

## Development Commands

```bash
# Frontend development
npm start                    # Start development server (localhost:3000)
npm run build               # Build for production (includes story generation)
npm test                    # Run tests
npm run generate-stories    # Generate stories.json from markdown files

# Backend development (in server/ directory)
cd server && npm run dev    # Start backend with nodemon
cd server && npm start      # Start backend server
```

## Architecture & Data Flow

### Story Management System
The project uses a unique static story publishing system:

1. **Content Creation**: Stories are written in Markdown format in `content/stories/`
2. **Build Process**: `scripts/generateStories.js` parses markdown files and generates `public/data/stories.json`
3. **Frontend Consumption**: `src/utils/localDataUtils.js` fetches and manages story data
4. **Pre-build Hook**: `prebuild` script automatically generates stories before building

### Key Architecture Patterns

- **Component Structure**: Pages in `src/pages/`, reusable components in `src/components/`
- **Data Management**: Static JSON files for stories, utils for data fetching
- **Routing**: React Router with Layout wrapper component
- **State Management**: React hooks, no external state management
- **Styling**: Tailwind CSS with custom color palette and typography system

### Content Structure

Story markdown files must include frontmatter:
```markdown
---
title: "Story Title"
date: 2025-01-01
author: "Author Name"
category: "Category"
tags: ["tag1", "tag2"]
---

Content here...
```

## Important Files & Directories

- `src/App.js` - Main application router and layout
- `src/components/Layout.js` - Main layout wrapper with navigation
- `src/utils/localDataUtils.js` - Story data management utilities
- `scripts/generateStories.js` - Markdown to JSON conversion script
- `src/i18n.js` - Internationalization configuration
- `server/server.js` - Backend API server
- `public/data/stories.json` - Generated story data (build artifact)

## Styling System

The project uses Tailwind CSS with custom configuration:
- **Colors**: Primary (purple), secondary (pink), accent (emerald)
- **Typography**: Custom font sizes and Korean font support (Pretendard, Noto Sans KR)
- **Dark Mode**: Class-based dark mode support
- **Responsive**: Mobile-first responsive design

## Deployment Notes

- **Production Build**: Automatically generates CNAME file for custom domain
- **Story Generation**: Always runs before build via `prebuild` script
- **Assets**: Images stored in `public/images/` directory
- **Backend**: Separate deployment for server component