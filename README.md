# Classroom Survey Web Application

> **Fast, mobile-friendly, frictionless classroom assessment tool.**  
> Built for instructors to instantly assess student comprehension during lectures via high-resolution projector QR codes, with real-time response aggregation and zero login friction for students.

---

## 🚀 Key Features

### For Students (Zero Friction)
- **Instant QR Access**: Point camera and vote immediately at `/s/:slug`. No app install, account creation, or login required.
- **Mobile-First UX**: Single-column vertical layout with large touch targets ($\ge 48\text{px}$), tap feedback, and accessible keyboard navigation.
- **Duplicate Vote Prevention**: Combines browser-persisted anonymous tokens (`localStorage`) with a PostgreSQL unique constraint index to prevent duplicate submissions while guaranteeing anonymity.

### For Instructors
- **Survey Lifecycle Management**: Full control across `Draft`, `Active`, `Closed`, and `Archived` states.
- **Single Active Survey Invariant**: Partial database index (`where status = 'active'`) guarantees that activating a survey automatically retires any previous active poll.
- **Projector Presentation Mode**:
  - High-contrast lecture hall dark theme (`#0F172A`).
  - Scalable $280\times 280\text{px}$ QR code canvas.
  - Prominent readable fallback URL with one-click copy toast.
  - High-resolution QR PNG download for slides.
  - Distraction-free Fullscreen mode.
- **Real-Time Live Analytics**:
  - **Supabase Realtime WebSockets**: Poll counts and horizontal bar charts update live on screen the instant a student votes.
  - Detailed response counts, percentage distributions, first response, and latest response timestamps.
- **RFC 4180 Compliant CSV Export**:
  - Single-click export of response-level data with metadata comments, question column headers, and escaped strings.
  - Embedded UTF-8 Byte Order Mark (`\uFEFF`) for seamless opening in Microsoft Excel and Google Sheets without encoding issues.
- **Survey Duplication & Versioning**: Clone existing surveys into clean Draft states with 0 responses to reuse across classes or semesters.
- **Markdown & JSON Import/Export**:
  - **Markdown Quiz Parser**: Paste markdown or plain text questions (e.g. `1. Prompt` / `- Choice A`) to auto-populate the editor in seconds.
  - **Portable JSON Backup**: Export and import complete survey definitions.
- **One-Click Demo Access**: Built-in evaluator login button for instant dashboard review without typing credentials.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | Strict type safety, clean component hierarchy |
| **Bundler & Tooling** | Vite 8 | Lightning-fast HMR and optimized production builds |
| **Styling & Design** | Tailwind CSS v4 | Responsive utility classes, WCAG AA color contrast |
| **Icons & Charts** | Lucide React + Recharts | Horizontal bar graphs, accessible SVGs |
| **QR Code Engine** | `qrcode.react` | High-error-correction (`level="H"`) HTML5 Canvas QR |
| **Database & Auth** | Supabase (PostgreSQL 15) | Relational schema, Row Level Security, RPCs, Realtime |
| **Hosting & CDN** | Cloudflare Pages | Free static edge deployment, SPA rewrite rules |

---

## 🗄️ Database Architecture & Migrations

The database schema is defined in [`supabase/schema.sql`](supabase/schema.sql) and [`supabase/migrations/20261104000000_initial_schema.sql`](supabase/migrations/20261104000000_initial_schema.sql).

### Entity Relationships

```text
surveys
  ├── questions (cascade delete)
  │     └── choices (cascade delete)
  └── responses (cascade delete)
        └── answers (cascade delete, linked to questions & choices)
```

### Security & Row Level Security (RLS)
- **Anonymous Students (`anon`)**:
  - Can only `SELECT` surveys where `status = 'active'`.
  - Can only `SELECT` questions and choices belonging to active surveys.
  - Direct `INSERT`, `UPDATE`, and `DELETE` on all tables are strictly denied by RLS.
  - Voting occurs exclusively through the PostgreSQL security-definer function `submit_survey_response`.
- **Instructors (`authenticated`)**:
  - Granted full CRUD privileges across all tables.

### Stored Procedures (RPCs)
1. **`activate_survey(p_survey_id UUID)`**: Atomically closes any active survey, assigns a clean 6-character public slug, and activates the survey.
2. **`close_survey(p_survey_id UUID)`**: Transitions survey status to `closed`.
3. **`submit_survey_response(p_survey_id, p_anonymous_token, p_answers)`**: Validates survey active status, checks for duplicate tokens, verifies question/choice foreign keys, and inserts the response and answers atomically in a single transaction.

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- A free **[Supabase](https://supabase.com)** project

### 1. Clone the Repository
```bash
git clone https://github.com/JacobBogdany/Classroom-Survey.git
cd Classroom-Survey
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Database in Supabase
1. Open your project in the **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Navigate to **SQL Editor** $\rightarrow$ click **New Query**.
3. Copy and paste the contents of [`supabase/schema.sql`](supabase/schema.sql) into the editor and click **Run**.
4. In **Authentication** $\rightarrow$ **Users**, create your instructor account.

### 4. Set Up Environment Variables
Create a `.env` file in the project root:

```env
# Supabase API connection
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-anon-key

# Demo Instructor Account (powers the One-Click Demo Login button)
VITE_DEMO_EMAIL=instructor@example.edu
VITE_DEMO_PASSWORD=your-instructor-password
```

### 5. Start the Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 6. Run Quality Checks & Automated Tests
```bash
# Run oxlint fast linter
npm run lint

# Run end-to-end automated test suite (RLS, Auth, RPCs, CSV, Math)
npm test

# Run TypeScript compilation and production bundle build
npm run build
```

---

## 🌐 Cloudflare Pages Deployment Guide

### Step 1: Connect Repository to Cloudflare Pages
1. Log into the **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Navigate to **Workers & Pages** $\rightarrow$ click **Create application** $\rightarrow$ select the **Pages** tab.
   - *Direct link:* `https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages`
3. Click **Connect to Git** and choose the repository: **`JacobBogdany/Classroom-Survey`**.

### Step 2: Configure Build Settings
- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: *(leave completely blank)*

### Step 3: Add Production Environment Variables
Under **Environment variables (advanced)**, add:

| Variable Name | Value |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `your-supabase-anon-key` |
| `VITE_DEMO_EMAIL` | `your-instructor-email` |
| `VITE_DEMO_PASSWORD` | `your-instructor-password` |

### Step 4: Deploy
Click **Save and Deploy**. Cloudflare Pages will build and deploy the app to a production URL (e.g. `https://classroom-survey.pages.dev`).

### Step 5: Configure Supabase Auth Redirects
1. Go to your **Supabase Dashboard** $\rightarrow$ **Authentication** $\rightarrow$ **URL Configuration**.
2. Set **Site URL** to: `https://classroom-survey.pages.dev`
3. Add to **Redirect URLs**: `https://classroom-survey.pages.dev/**`
4. Click **Save**.

### Client-Side SPA Routing
Single Page Applications require routing fallbacks so direct visits to routes like `/s/:slug` don't return 404s. This repository includes [`public/_redirects`](public/_redirects):
```text
/*    /index.html   200
```
Vite automatically bundles this into `dist/_redirects` during build.

---

## 🧪 Testing

The project includes both automated integration tests and a comprehensive manual testing matrix:

### Automated Test Suite (`npm test`)
Executes [`scripts/test-phase14-automated.mjs`](scripts/test-phase14-automated.mjs) against the live Supabase database:
- **Suite 1**: Validates that Supabase Auth rejects invalid instructor credentials and verifies that Row Level Security (RLS) blocks anonymous direct inserts on `surveys`, `responses`, and `answers`.
- **Suite 2**: Verifies anonymous public read queries on active surveys without leaking draft or archived records.
- **Suite 3**: Tests atomic student survey submissions via `submit_survey_response` and verifies that duplicate submissions with the same anonymous token are rejected with `DUPLICATE_RESPONSE`.
- **Suite 4**: Tests mathematical distribution and percentage calculations ($75\%$, $25\%$, $0\%$) and verifies $0$-response edge cases.
- **Suite 5**: Verifies RFC 4180 CSV export generation, internal quote escaping (`""`), and UTF-8 Byte Order Mark (`\uFEFF`) integration.

---

## 📂 Project Structure

```text
classroom-survey/
├── public/
│   ├── _redirects              # Cloudflare Pages SPA rewrite rule
│   └── favicon.svg             # Application favicon
├── scripts/
│   ├── test-phase14-automated.mjs  # Automated backend & RLS test suite
│   └── generate-conversation-log.mjs # Conversation history generator
├── src/
│   ├── components/
│   │   ├── ConfirmModal.tsx    # Accessible modal dialog with Escape listener
│   │   ├── ImportModal.tsx     # Markdown & JSON survey import modal
│   │   └── ProtectedRoute.tsx  # Auth guard redirecting to /login
│   ├── context/
│   │   ├── AuthContext.tsx     # Supabase auth session provider
│   │   ├── auth-context.ts     # Context definitions and types
│   │   └── useAuth.ts          # Custom authentication hook
│   ├── lib/
│   │   ├── csv-export.ts       # RFC 4180 CSV generator with UTF-8 BOM
│   │   ├── student-token.ts    # Anonymous client token management
│   │   ├── supabase.ts         # Initialized Supabase client with URL sanitizer
│   │   ├── survey-import-export.ts # Markdown & JSON survey parsers
│   │   └── survey-service.ts   # Database CRUD operations and RPC callers
│   ├── pages/
│   │   ├── DashboardPage.tsx   # Survey list, status/date filters, action cards
│   │   ├── LandingPage.tsx     # Public landing page with session awareness
│   │   ├── LoginPage.tsx       # Instructor login & 1-click demo login
│   │   ├── PresentPage.tsx     # High-contrast projector mode with QR code
│   │   ├── ResultsPage.tsx     # Live Recharts bar charts & CSV export
│   │   ├── StudentSurveyPage.tsx # Anonymous student mobile voting view
│   │   └── SurveyEditorPage.tsx  # Dynamic question builder, MC/TF presets
│   ├── types/
│   │   └── database.ts         # Database entity TypeScript interfaces
│   ├── App.tsx                 # React Router DOM routes configuration
│   ├── index.css               # Tailwind CSS v4 & accessible focus rings
│   └── main.tsx                # React 19 root entry point
├── supabase/
│   ├── migrations/             # Timestamped SQL migration files
│   │   └── 20261104000000_initial_schema.sql
│   └── schema.sql              # Complete idempotent database schema
├── .env.example                # Template for environment variables
├── CONVERSATION_LOG.md         # Full chronological conversation history
├── package.json
└── vite.config.ts
```

---

## 📄 License

Open source and distributed under the MIT License.
