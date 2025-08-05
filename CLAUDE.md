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
cd server && npm run dev    # Start backend with nodemon (ignores db.json changes)
cd server && npm start      # Start backend server
cd server && npm test       # Backend tests (currently no tests specified)

# Deployment
npm run predeploy           # Runs build automatically
npm run deploy              # Deploy to GitHub Pages
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
- **Internationalization**: i18next setup with comprehensive Korean/English translations in `src/i18n.js`
- **Dark Mode**: Time-based auto-switching (6:00-18:00 light mode) with manual toggle, uses class-based Tailwind dark mode

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

- `src/App.js` - Main application router with React Router setup
- `src/components/Layout.js` - Layout wrapper with navigation, dark mode toggle, responsive design
- `src/utils/localDataUtils.js` - Story data management utilities and sorting logic  
- `scripts/generateStories.js` - Markdown to JSON conversion script with frontmatter parsing
- `src/i18n.js` - Internationalization configuration (Korean default, English fallback)
- `server/server.js` - Express backend server with CORS and LowDB
- `public/data/stories.json` - Generated story data (build artifact, auto-generated from markdown)
- `public/data/portfolio.json` - Portfolio data for projects display
- `tailwind.config.js` - Custom Tailwind configuration with Korean fonts and extended color palette

## Styling System

The project uses Tailwind CSS with custom configuration:
- **Colors**: Primary (purple), secondary (pink), accent (emerald)
- **Typography**: Custom font sizes and Korean font support (Pretendard, Noto Sans KR)
- **Dark Mode**: Class-based dark mode support
- **Responsive**: Mobile-first responsive design

## Data Management Architecture

### Static Data Sources
- **Stories**: Markdown files in `content/stories/` → compiled to `public/data/stories.json`
- **Portfolio**: Static JSON in `public/data/portfolio.json`
- **Images**: Static assets in `public/images/` (room, studio, service, portfolio, hardware images)
- **Audio**: Sample tracks in `public/audio/`

### Backend Data (LowDB)
- **Bookings**: Stored in `server/db.json` for form submissions and booking data
- **API Endpoints**: Express server provides booking and contact form functionality

## Deployment Notes

- **Production Build**: Automatically generates CNAME file for custom domain (studionol.co.kr)
- **Story Generation**: Always runs before build via `prebuild` script
- **Vercel Configuration**: SPA rewrite rules in `vercel.json` for client-side routing
- **Assets**: Images stored in `public/images/` directory
- **Backend**: Separate deployment required for server component (Express + LowDB)
- **GitHub Pages**: Alternate deployment option with `npm run deploy`