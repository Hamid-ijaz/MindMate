
# 🧠 MindMate

<p align="center">
    <img src="public/icon-512.png" alt="MindMate Logo" width="120">
</p>

<h3 align="center">An intelligent task companion to help you focus and reduce overwhelm.</h3>

<p align="center">
    <!-- Use a static MIT badge to avoid GitHub repo-name resolution issues -->
    <img alt="License" src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge&logo=github">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white">
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white">
    <img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white">
  <img alt="Genkit" src="https://img.shields.io/badge/Genkit-4285F4?style=for-the-badge&logo=google&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white">
</p>

---

**MindMate** is not just another to-do list. It's an intelligent task management app designed to help you focus and combat procrastination. By combining a clean, calming user interface with powerful AI features, it makes planning your day feel effortless. Instead of showing a long, overwhelming list, it suggests one task at a time based on your current energy level.

If a task feels too big, its AI can break it down into smaller, more manageable steps. With features like smart reminders, a conversational AI check-in, and a rich note-taking system, MindMate helps you stay organized, motivated, and in control.

## ✨ Key Features

Here is a summary of the key features implemented so far:

-   **🤖 AI-Powered Task Suggestions**: The home page intelligently suggests one task at a time based on your selected energy level.
-   **🔮 Advanced AI Task Tools**:
    -   **AI Task Breakdown**: "Divide Task" feature breaks large tasks into smaller, actionable sub-tasks.
    -   **AI Task Enhancement**: Automatically suggest a clearer title, write a description, and predict the best category and duration for a new task.
    -   **URL Summarization**: Pasting a URL as a task title automatically generates a summary for the description.
-   **✅ Comprehensive Task Management**:
    -   Full CRUD (Create, Read, Update, Delete) for tasks.
    -   **Sub-tasks**: Create and manage nested sub-tasks for larger projects.
    -   **Reminders & Recurrence**: Set due dates and create repeating tasks (daily, weekly, monthly).
-   **📝 Rich Note-Taking System**:
    -   A flexible, grid-based layout for notes, inspired by Google Keep.
    -   **Rich Text Formatting**: Includes bold, italics, lists, and adjustable font sizes.
    -   **Multimedia & Styling**: Add images via URL and color-code your notes.
    -   **Search Functionality**: A search bar to quickly find text within any of your notes.
-   **💬 Conversational AI Check-in**: A dedicated chat page where you can talk with an AI assistant that has context on your tasks to help you plan.
-   **📊 History & Views**:
    -   **Pending Tasks Page**: A dedicated view to see all upcoming to-do items.
    -   **Completed History**: A chronological view of all your accomplished tasks, grouped by day.
    -   **Detailed Task Page**: A focused view for a single task and its sub-tasks.
-   **🎨 Customization & Notifications**:
    -   **Theme Picker**: Personalize the app's look with different color themes and light/dark modes.
    -   **Custom Settings**: Define your own task categories and default durations.
    -   **Smart Notifications**: Get reminders for upcoming tasks right in your browser.

-   **🎉 Milestones & Anniversary Tracking**: Track one-time events and recurring milestones (birthdays, anniversaries, achievements). Includes a create/edit UI, dashboard card showing time-since and time-until, and scheduled push reminders (30d, 7d, 3d, 1d, on-the-day). Server-side logic persists notifications through Next.js API routes and sends web-push via VAPID.

## 🚀 Newly Implemented & Advanced Features

- **Advanced Calendar & Time Management**
    - Drag-and-drop task scheduling
    - Time blocking interface
    - Multiple calendar views (day/week/month/agenda)
    - Pomodoro timer integration
    - Conflict detection and resolution for calendar sync
    - Mobile-optimized responsive design
    - Advanced task visualization
    - Session tracking and statistics

- **External Calendar Sync (Legacy / Transitional)**
    - Google Tasks and related OAuth sync flows are in legacy maintenance mode during migration.
    - New deployments should keep Google sync disabled unless explicitly required.
    - Outlook Calendar integration (framework present)
    - Sync token management for incremental sync

- **Push Notification System**
    - Comprehensive API for notifications (subscribe, unsubscribe, preferences, reminders)
    - Smart notification scheduling (quiet hours, customizable timing, multiple types)
    - Notification dashboard and history UI
    - Advanced user preferences (sound, vibration, priority, grouping, max daily, etc.)
    - Background sync for notifications and tasks (offline support via service worker)

- **Task Management Enhancements**
    - Recurring tasks (basic and advanced patterns)
    - Time-blocked tasks
    - Pomodoro session tracking
    - Task reminders and overdue notifications

- **Sharing & Collaboration**
    - Share tasks and notes via unique links
    - Permission management for shared items

- **Notes System**
    - Rich note-taking (grid layout, formatting, images, color-coding, search)

- **Mobile & PWA Features**
    - Offline support (service worker caches, background sync)
    - App install prompt
    - Responsive/mobile-first design

- **User Customization**
    - Theme picker (light/dark, color themes)
    - Custom notification settings
    - Custom task categories and durations

- **Accessibility**
    - Keyboard navigation
    - Screen reader support

## Google Sync Status (April 2026)

- Google task sync and related OAuth flows are in legacy maintenance mode.
- Historical implementation notes are kept as archived references only.
- Runtime code paths still exist for backward compatibility with existing deployments.
- Fresh environments should not treat Google sync as required unless legacy routes are intentionally enabled.

## 🎉 Milestones feature overview

This project now includes a Milestones subsystem for tracking important dates (birthdays, anniversaries, achievements, purchases, etc.) with optional recurring anniversaries and push reminders.

Quick summary
- Milestones can be one-time or recurring (yearly/monthly). Recurring milestones compute the next anniversary and can trigger reminders at: 30 days, 7 days, 3 days, 1 day, and on the day.
- Notifications are persisted via Prisma models (`Notification` and `PushSubscription`) and sent as web-push.

Core features
- Milestone data model (typed) with notification preferences, recurrence flags, and timestamps.
- UI: create / edit modal with conditional notification settings (shown only for recurring milestones) and a dashboard card that displays "time since" and "time until" next anniversary.
- Server: integrated scheduling in the comprehensive notification check. Prevents duplicate daily sends, respects quiet hours, and removes invalid push subscriptions.
- Utilities & service layer: date helpers for anniversary math and a Prisma-backed service that safely writes only defined fields.

File locations (primary)
- Types: `src/lib/types.ts`
- Date utils: `src/lib/milestone-utils.ts`
- Data service (CRUD): `src/services/milestone-service.ts`
- Milestone form UI: `src/components/milestone-form.tsx`
- Dashboard card UI: `src/components/milestone-dashboard-card.tsx`
- Notification processing and web-push logic: `src/app/api/notifications/comprehensive-check/route.ts`

How to test notifications (single-run)
1. Ensure dev server is running and environment variables are set (`DATABASE_URL`, API tokens, and VAPID keys).
2. Run a single notification check (this will log detailed milestone debug info):

PowerShell (from project root):
```powershell
# Trigger a single run of the server-side notification check
Invoke-WebRequest -Uri "http://localhost:3000/api/notifications/comprehensive-check?mode=single" -Method POST
```

curl (alternative):
```bash
curl -X POST "http://localhost:3000/api/notifications/comprehensive-check?mode=single"
```

Debugging tips
- Check server logs for these markers added to the notification route:
    - `🔍 Processing milestone:` shows milestone payload read from the data layer
    - `📅 Anniversary calculation:` shows computed next anniversary and `daysUntil`
    - `📋 Notification settings for ...` shows effective notification toggles
    - `✅ Should notify:` or `❌ No notification rule matches:` explains the decision
- Common causes for missed sends:
    1) `isRecurring` is false (one-time milestones do not calculate `daysUntil`).
    2) `originalDate` stored with an unexpected type (ensure it's a valid timestamp/number or Date).
    3) The specific notification preference (oneWeekBefore, oneDayBefore, etc.) is disabled.
    4) User has no valid push subscriptions or notifications are disabled in `notificationPreferences`.
    5) Quiet hours are active for the user at check time.

What to check in PostgreSQL (via Prisma)
- `Milestone` records: verify `isRecurring`, `originalDate`, `notificationSettings`, and `lastNotifiedAt`.
- `PushSubscription` records: verify active subscriptions for the user.
- `Notification` records: check `data.type === 'milestone-reminder'` and whether `sentAt` is populated.

If you'd like, I can run a single check locally and paste the server logs here or add an optional debug endpoint that forces a notification for a specific milestone id for safe testing.

## 🛠️ Tech Stack

-   **Framework**: [Next.js](https://nextjs.org/) (App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **AI Framework**: [Genkit](https://genkit.dev/) (with Google Gemini)
-   **UI Library**: [React](https://react.dev/), [ShadCN UI](https://ui.shadcn.com/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma](https://www.prisma.io/)
-   **State Management**: React Context API

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

-   Node.js (v18 or higher)
-   npm

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/hamidijaz/MindMate.git
    cd MindMate
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Set up environment variables:**
    -   Copy `env.example` to `.env.local` and update values for your local environment.
    -   Core fields:
    
    ```env
    # PostgreSQL Configuration
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mindmate_dev

    # Internal Security Tokens
    CRON_AUTH_TOKEN=replace_with_random_32_plus_char_token
    INTERNAL_API_KEY=replace_with_random_32_plus_char_internal_key

    # Google AI Configuration
    GOOGLE_AI_API_KEY=your_google_ai_api_key_here

    # NextAuth URL (for OAuth redirects)
    NEXTAUTH_URL=http://localhost:9002

    # Push Notification Configuration (VAPID Keys)
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key_here
    VAPID_PRIVATE_KEY=your_vapid_private_key_here
    ```
    -   Optional integrations include legacy Google Tasks OAuth, Outlook calendar OAuth, SMTP email settings, and analytics keys.

4.  **Set up Genkit (for AI features):**
    -   Obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    -   Add the API key to your `.env.local` file:
        ```env
        GEMINI_API_KEY=your-gemini-api-key
        ```

### Running the Application

1.  **Start the development server:**
    ```sh
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

2.  **Start the Genkit server (for AI flows):**
    In a separate terminal, run:
    ```sh
    npm run genkit:dev
    ```
    The Genkit development UI will be available at `http://localhost:4000`.

## 🚢 Production Deployment (Docker + GHCR + VM)

Production deployment is automated with GitHub Actions:

- Build Docker image on push to `main`
- Push image to GHCR
- SSH to VM and restart the Docker Compose stack

Use this runbook for complete setup:

- [docs/docker-ghcr-vm-deployment.md](docs/docker-ghcr-vm-deployment.md)

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 👤 Owner

This project is maintained by **Hamid Ijaz**.

-   **GitHub**: [@hamidijaz](https://github.com/Hamid-ijaz)
-   **LinkedIn**: [Hamid Ijaz](https://www.linkedin.com/in/hamid-ijaz/)

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
