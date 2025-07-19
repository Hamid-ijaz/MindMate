
# 🧠 MindMate

<p align="center">
  <img src="https://mindmate.hamidijaz.dev/favicon.svg" alt="MindMate Logo" width="120">
</p>

<h3 align="center">An intelligent task companion to help you focus and reduce overwhelm.</h3>

<p align="center">
  <img alt="GitHub" src="https://img.shields.io/github/license/hamidijaz/MindMate?style=for-the-badge">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black">
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
-   **🔐 User Authentication**: Secure sign-up and login system to manage personal accounts and settings.

## 🛠️ Tech Stack

-   **Framework**: [Next.js](https://nextjs.org/) (App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **AI Framework**: [Genkit](https://firebase.google.com/docs/genkit) (with Google Gemini)
-   **UI Library**: [React](https://react.dev/), [ShadCN UI](https://ui.shadcn.com/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore)
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

3.  **Set up Firebase:**
    -   Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
    -   Enable the **Firestore Database**.
    -   Copy your Firebase project configuration credentials.
    -   Create a `.env.local` file in the root of the project and add your credentials:
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
        NEXT_PUBLIC_FIREBASE_APP_ID=...
        ```
    -   Refer to `FIREBASE_MIGRATION.md` for details on the Firestore data structure.

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
