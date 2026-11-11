# Course Rev AI: build brief for Claude Code

We are a student team at Woosong University building an MVP for a university AI competition festival. The demo is tomorrow, so favor working features over perfect code. Build it in phases (below) and stop after each phase to tell me how to test it.

## The product

**CourseRevAI** is a course review site first (think "Rate My Professor", but for courses). The second half is **Broddy**, an AI course buddy in a chat panel on the right that helps students with course registration. Broddy bases every answer on the course catalog and the student reviews.

The key demo moment: a student opens a course, clicks **Ask Broddy**, and asks "Is this course good for me?". Broddy summarizes what reviewers say (quality, difficulty, workload, teaching style, pros and cons) and then says whether it fits this student's major, year, remaining credits and current timetable. Then the student adds it to My Courses and sees it appear on the Calendar.

A hand drawn sketch of the layout is in `design/sketch.jpg`. Look at it before building the UI.

## Stack

* Next.js (App Router, TypeScript), Tailwind CSS
* Google Gemini through the official `@google/genai` SDK, called only from server route handlers. Use the newest Gemini **Flash** model that is available on the free tier (it supports image input). Read the model name from an env var so we can change it without code edits.
* Optional fallback provider: Groq (OpenAI compatible API), used only if `GROQ_API_KEY` is set and Gemini fails or returns 429.
* Deploy target: Vercel.
* Env vars (create `.env.example`, I will fill `.env.local` myself):
  ```
  GEMINI_API_KEY=
  GEMINI_MODEL=
  GROQ_API_KEY=
  GROQ_MODEL=
  ```
  The API key must never reach the browser.

Note: this folder already contains `BRIEF.md`, `convert_courses.py` and `data/`. If `create-next-app` refuses to run in a non empty folder, scaffold into a temporary subfolder and move everything up, keeping my files.

## Data

### `data/courses.json` (already generated, do not hand edit)

Produced by `convert_courses.py` from the university's international HUB timetable for the **Spring 2025 semester** (show "Course data: Spring 2025 timetable" in the footer). It has **207 courses and 372 sections across 14 programs** (AI & Big Data, Global Convergence Management, Global Hotel Management, General Education, K-POP & Entertainment, Global Railway, Global Culinary Arts and more). Cancelled sections are already removed. Shape of each course:

```json
{
  "id": "ai-computer-vision",
  "name": "Computer Vision",
  "name_original": "Computer Vision",
  "program": "AI & Big Data",
  "program_code": "ai",
  "department": "AI·빅데이터학과",
  "target_years": [3],
  "credits": 3,
  "hours": 3,
  "type": "Core",
  "mode": "Theory+Practical",
  "course_code": "",
  "track": "AI & Big Data Endicott Convergence Track",
  "taught_in_korean": true,
  "professors": ["Saurabh Singh"],
  "sections": [
    {
      "section": "001",
      "professor": "Saurabh Singh",
      "room": "S2 401",
      "schedule_text": "Tue. 16:00~19:00",
      "slots": [{"day": "Tue", "start": "16:00", "end": "19:00"}],
      "block": "",
      "remark": "",
      "makeup": ""
    }
  ]
}
```

Notes on the fields:
* `track` and `taught_in_korean` are only present when they apply. A course with a `track` is a separate offering for students registered in that track or minor; show a "Track" badge.
* `target_years` can be empty or have several years. `credits` can be null for a few courses. Handle both.
* `remark` holds eligibility rules such as "2025 Freshman ONLY", "International only" or "Korean Section". Show remarks on the course page, and the assistant must respect them.
* `type` values: Basic (year 1), Core and Advanced (years 2 to 4), Focus (years 3 to 4, needed for graduation), Track, GE(n) for general education areas, Major.
* Some names and ids contain Korean characters. Always `encodeURIComponent` ids in URLs and decode them in the route.
* `slots` is empty when the schedule is TBA. The UI shows "Schedule TBA".

To regenerate: `pip install pandas openpyxl wordninja`, then `python convert_courses.py "<workbook>.xlsx" --out data/courses.json` (it reads every tab).

### `data/registration_notes.md` (already generated)

The "READ THIS!!!" tab of the workbook: the 2025 major credit levels (Basic, Core, Advanced, Focus), registration periods, and special curriculum program credit limits. Give it to the assistant as background in the chat system prompt, so it can answer questions like "what does Focus mean" or "how many credits can I take from special programs". Tell the model these notes are from Spring 2025 and dates may have changed.

### `data/reviews.json` (you create this)

Generate **sample** reviews so the demo has content: 4 to 6 for every AI & Big Data and General Education course (our demo programs), and 2 or 3 for every other course. Write a small script for this (deterministic, seeded) rather than hand writing hundreds of reviews, but make the texts specific to each course name and its type. Make them varied and realistic (some positive, some critical, different difficulty and workload), mention the professor of a real section, and write in the voice of students. Every seed review must have `"isSample": true`, and the UI must show a small "Sample review" label on them. Shape:

```json
{
  "id": "r_001",
  "courseId": "ai-computer-vision",
  "professor": "Saurabh Singh",
  "semester": "2025 Spring",
  "rating": 4,
  "difficulty": 4,
  "workload": 3,
  "wouldRecommend": true,
  "tags": ["heavy on exams", "clear lectures"],
  "text": "....",
  "createdAt": "2025-06-20",
  "isSample": true
}
```

All scales are 1 to 5. In the UI, `rating` is labeled **Quality** and `wouldRecommend` is labeled **Would take again**. Users can also mark a review as helpful (count stored in `localStorage`). For the MVP, reviews that users write are stored in `localStorage` and merged with the seed reviews on the client (Vercel's file system is read only, and we do not need a database for the demo). Write the storage behind a small `reviewsStore` module so we could swap in Supabase later.

## Layout: three columns

```
| Left nav (about 240px) |        Main section        | Broddy chat (about 380px) |
| CourseRevAI            |                            |                           |
| Reviews                |   (changes per nav item)   |   iMessage style chat     |
| My Courses             |                            |                           |
| Calendar               |                            |                           |
| profile chip at bottom |                            |                           |
```

* **Left nav**: the "CourseRevAI" wordmark at the top, then the sections **Reviews**, **My Courses**, **Calendar**. At the bottom a profile chip (major and year, click to edit) and a small "Course data: Spring 2025 timetable" note. Collapsible to icons only.
* **Right panel**: Broddy, always visible on desktop, collapsible. On mobile, the left nav becomes a bottom tab bar and Broddy opens as a full screen sheet from a floating button.
* `/` redirects to `/reviews`.

## Section 1: Reviews (home) `/reviews`

Matches the top of the sketch: a list of course rows. This is the most important page, so polish it.

* Search box on top (course name, professor), then a filter row: program, year, type, credits, day of week, "English only" (hides `taught_in_korean`), "Track courses" toggle.
* Sort: highest quality, most reviewed, easiest, lightest workload, name.
* Each row: course name (large) with professor names under it, a small line with program, year, credits and type, and on the right a big square **Quality** box with the average (one decimal, like 4.2) and the review count under it. Also small Difficulty and Workload numbers. Courses with no reviews show "N/A" in the box.

### Course detail `/reviews/[id]`

Matches the "Course Name / Professor / Comments" part of the sketch.

* Header: name, professors, program, credits, type, remarks (eligibility notes like "2025 Freshman ONLY" are shown clearly), a big Quality box, Difficulty, Workload, "Would take again" percent, top tags, and a rating distribution (5 bars).
* **Sections table**: section, professor, room, schedule, with an **Add to My Courses** button per section (shows "Added" if already added; warns if it clashes with something already added).
* **AI review summary** card: button "Summarize reviews with AI". Returns pros, cons, difficulty, workload, "best for" and "watch out" lines. Cache per course on the server (memory) and the client (`sessionStorage`).
* **Comments** (reviews) list: each review shows its own small Quality and Difficulty boxes, professor, semester, tags, text, a "Sample review" label if `isSample`, and a helpful button. Filter by professor, sort by newest, highest or most helpful.
* **Rate this course** button opens the review form (modal): quality, difficulty, workload, would take again, professor (dropdown from the sections), semester, tags (pick from a list plus custom), text (minimum 30 characters). Validate input.
* **Ask Broddy** button: focuses the Broddy panel with this course attached as context.

## Section 2: My Courses `/courses`

The student's own course plan for the semester, stored in `localStorage` (`myCoursesStore`).

* List of added courses with the chosen section, schedule, room and credits. Actions: change section (dropdown), remove, **Rate this course** (opens the same review form), **Ask Broddy**.
* A credits counter at the top: total credits planned, with a note if it is above 21 or below 9.
* A **Graduation progress** card: shows the credits table from the screenshot upload (see Broddy) if the student did it, otherwise a button "Upload your credits screenshot".
* Empty state: "No courses yet. Browse reviews to find some." with a link.

## Section 3: Calendar `/calendar`

A week view inspired by Google Calendar's block style (do not copy its branding or icons).

* Columns Mon to Fri (add Sat only if any added course meets on Saturday). Rows from 08:00 to 21:00 with hour lines and labels on the left. The current day column is subtly highlighted.
* Each added course section is a block positioned and sized by its `slots`: course name, section and room inside the block. Clicking a block opens a small popover with details and links to the course page and Broddy.
* **Clashes**: overlapping blocks are placed side by side, drawn with a diagonal hatched pattern and a "Clash" label (we use no colors, so use pattern and a thick border instead of red). A banner above the grid lists clashes.
* **Preview**: when the user hovers an "Add to My Courses" button anywhere in the app, or when Broddy suggests a section, show that section as a dashed outline "ghost" block on the calendar.
* Sections with no time (`slots` empty) are listed under the grid as "Schedule TBA".
* The clash logic lives in one shared helper (`lib/schedule.ts`) used by the calendar, the Add buttons and Broddy.

## Broddy (right panel): iMessage style chat

Visual style inspired by iMessage, in black and white, built with our own components (no Apple assets or logos):

* Header: round avatar (simple original monochrome face icon), the name **Broddy**, subtitle "Your AI course buddy", and a button that opens the student profile settings.
* Bubbles: the student's messages on the right in black with white text, Broddy's messages on the left in light gray with black text. Rounded about 18px with a small tail on the last bubble of each group. Consecutive messages from the same sender are grouped tightly.
* Timestamps centered between groups when more than 10 minutes pass (for example "Today 14:00"). "Delivered" in small gray text under the student's last message.
* Typing indicator: a gray bubble with three bouncing dots while Broddy is streaming the first tokens, then the streaming text.
* Input bar at the bottom: a "+" button (attach a credits screenshot), a pill shaped text field with placeholder "Message Broddy", and a round send button with an arrow. Enter sends, Shift+Enter makes a new line.
* Above the input: suggestion chips that depend on the current section:
  * Reviews or course page: "Is this course good for me?", "Summarize the reviews", "Compare with a similar course"
  * My Courses: "Am I taking too many credits?", "What else should I take?"
  * Calendar: "Do I have clashes?", "Find a course for my free Friday"
* A context chip above the input shows what Broddy is looking at (for example "Computer Vision" or "My calendar"). It can be removed.
* First message from Broddy when the profile is empty: a friendly greeting that asks for major and year, with quick reply buttons for year 1 to 4.
* Chat history is kept in `localStorage`, with a "New chat" button in the header.

### Rich content in Broddy's bubbles
* Course mentions render as **course chips** (name, credits, quality) with a tiny "Verified" mark, clickable to the course page.
* Broddy can suggest actions. The model writes `[[add:<course-id>:<section>]]`, which renders as an **Add to My Courses** button (with a calendar preview on hover). Nothing is added until the student clicks.
* Markdown for lists and bold text.

### Screenshot upload (from the "+" button)
The student uploads a screenshot of the credits page from the university info system. It goes to `/api/extract-credits` (Gemini with a JSON response schema) and returns categories, required, earned and remaining credits. Broddy shows the extracted table in a bubble so the student can **edit and confirm** it before it is saved to the profile. Show a tip: "Blur or crop your student ID before uploading."

### `/api/chat` behavior
* Input: messages, profile, current section, optional `courseId`, My Courses list, and the user written reviews from `localStorage` for relevant courses.
* System prompt includes:
  1. Role: Broddy, a friendly and concise course buddy for Woosong University students. Short messages like a text conversation (2 to 5 short paragraphs or a short list), casual but accurate. Answers only from the data provided. If something is not in the data (for example a graduation rule it was not given), it says so instead of guessing.
  2. The student profile and graduation progress, if any.
  3. A **compact catalog**: one line per course with id, name, program, track, years, credits, type, average quality, difficulty, workload, review count, sections with schedules, and remark. Build this from the JSON at request time. If the student set a program, put that program's courses and General Education first.
  4. `data/registration_notes.md` as background rules (from Spring 2025, dates may have changed).
  5. The student's My Courses list and the clash report computed by `lib/schedule.ts` (the model never computes clashes itself).
  6. If a course is attached: full course details plus **all** of its reviews.
* The model mentions courses as `[[course-id]]` and actions as `[[add:course-id:section]]`. On the server, check every token against the catalog (and the section against the course): drop unknown ones and log them. This is our "no hallucinated courses" guarantee, so the "Verified" mark on chips matters for the demo.
* For "is this course good for me": what reviewers say (cite the numbers), then fit for this student (year, major, remaining credits, timetable, remarks like "Freshman ONLY"), then a one line verdict.
* Errors and 429: retry once, then use Groq if configured, else Broddy replies "I'm a bit overloaded, try again in a few seconds" as a normal bubble.

### `/api/summarize` and `/api/extract-credits`
As described above. Use structured JSON output for both.

## Design

* Monochrome black and white only (no accent colors), clean typography (one good sans serif), generous whitespace, thin 1px borders, high contrast. Quality boxes, bars and calendar blocks in black and grays. It should look sharp on a projector.
* Smooth but quick transitions (bubble appear, panel collapse). Respect `prefers-reduced-motion`.
* Accessible: contrast, keyboard focus rings, labels, the chat log uses `aria-live`.

## Phases (stop after each one and tell me how to test)

1. Scaffold Next.js + Tailwind, the three column shell (left nav, main, an empty Broddy panel), load `data/courses.json`, generate `data/reviews.json`, build the **Reviews** list with search, filters and sort.
2. Course detail page: header, sections table, comments, review form, `reviewsStore` and `myCoursesStore`, Add to My Courses.
3. **Broddy**: iMessage style UI, `/api/chat` with streaming, profile, context chip, suggestion chips, token validation, course chips and Add buttons. Then the AI review summary card. (This is the core of the AI demo; make it solid before moving on.)
4. **My Courses** and **Calendar** with `lib/schedule.ts`, clash display and preview ghost blocks.
5. Screenshot upload and confirm step, Graduation progress card, loading and empty states, error handling, `npm run build` passes, README, then help me deploy to Vercel (env vars set in the Vercel dashboard).

## Demo questions to test with

* On Computer Vision, via Ask Broddy: "Is this course good for me? I'm a 3rd year AI & Big Data student."
* "Summarize what students think about Operating System."
* "I'm in year 2 of AI & Big Data and I want a GE course with a light workload on Monday or Wednesday. What do you suggest?"
* "Which 3rd year AI & Big Data courses can I take together without a timetable clash?"
* "What does a Focus course mean, and do I need them to graduate?" (answer from registration notes)
* "Can I take Introduction to Computing System as a 3rd year?" (should notice the "2025 Freshman ONLY" remark)
* With SW Engineering 001 (Tue 13:00~16:00) already in My Courses: "Add Operating System section 001 for me" (Broddy should show an Add button and warn about the Tuesday clash; after adding, the Calendar shows both blocks hatched with a "Clash" label; Broddy should suggest section 002 on Wednesday instead)
* "Tell me about Quantum Basket Weaving" (should say it is not in the catalog)
