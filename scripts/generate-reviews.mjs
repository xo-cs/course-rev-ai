#!/usr/bin/env node
// Generates data/reviews.json with SAMPLE reviews for the demo.
// Deterministic: same courses.json -> same output. Run: npm run gen:reviews
// Reviewers are fictional. Every review has isSample: true.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const courses = JSON.parse(readFileSync(join(root, "data/courses.json"), "utf8"));

// ---------- seeded randomness ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v) => Math.max(1, Math.min(5, Math.round(v)));
const pickOne = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- course classification ----------
const DEMO_PROGRAMS = new Set(["AI & Big Data", "General Education"]);
const NON_MAJOR_PROGRAMS = new Set(["General Education", "SW General Education", "Sol Connection (English GE)", "Korean Language Track"]);
const MAJORS = [...new Set(courses.map((c) => c.program))].filter((p) => !NON_MAJOR_PROGRAMS.has(p));

function typeGroup(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("focus")) return "Focus";
  if (/^ge|교필/.test(t)) return "GE";
  if (t.includes("basic")) return "Basic";
  if (t.includes("core")) return "Core";
  if (t.includes("advance")) return "Advanced";
  if (t.includes("track")) return "Track";
  if (t.includes("major")) return "Major";
  return "Other";
}

const TOPICS = [
  ["math", /calculus|linear algebra|physics|statics|statistics/i],
  ["ai", /vision|llm|natural language|data mining|robot|cloud|security|human-ai|big data|빅데이터|인공지능|artificial/i],
  ["code", /programming|python|algorithm|computing|logic|software|sw engineering|database|operating|object|컴퓨팅|special subject/i],
  ["korean", /korean(?! wave| food| cuisine| desserts)|topik|한국어/i],
  ["english", /english|reading|writing|listening|speaking|communication|discussion|presentation|프레젠테이션|academic/i],
  ["culinary", /culinary|cuisine|bakery|baking|pastry|chocolate|dessert|kitchen|garde|breakfast|meat|escoffier|fermentation|menu|wine|cafe|creative menu|nutrition/i],
  ["hospitality", /hotel|hospitality|tourism|front office|etiquette|f&b|banquet|restaurant|customer|food and beverage|food service/i],
  ["media", /media|video|drama|k-pop|fandom|entertainment|wave|audio|content|film|acting|mcn|ott|a&r|exhibition|영상|콘텐츠|촬영|스트리밍|숏폼|채널|ux|graphics|user experience/i],
  ["rail", /rail|electrical|logistics|oda|ppp|public private|structures|ncs/i],
  ["business", /management|marketing|finance|accounting|entrepreneur|business|economics|supply|strategy|start ?up|경영|research|technology essentials/i],
  ["social", /psychology|sociology|anthropology|history|global issues|citizenship|leadership|living in korea|seminar|vision|탐색|creative|critical|thinking|논리|workplace/i],
];
const topicOf = (name) => (TOPICS.find(([, re]) => re.test(name)) ?? ["general"])[0];
const TOPIC_WORD = {
  math: "the math", ai: "AI", code: "programming", korean: "Korean", english: "academic English", culinary: "cooking",
  hospitality: "the hospitality industry", media: "content production", rail: "railway systems", business: "business",
  social: "the topic", general: "the subject",
};

// ---------- fictional reviewers ----------
const NAMES = [
  "Aziz Karimov", "Dilnoza Yusupova", "Jasur Tursunov", "Malika Rakhimova", "Sardor Aliyev", "Nodira Ismoilova", "Bekzod Nazarov",
  "Madina Saidova", "Nguyen Minh Anh", "Tran Thu Ha", "Le Quang Huy", "Pham Bao Ngoc", "Vu Duc Thinh", "Temuulen Bat-Erdene",
  "Anu Gantulga", "Bilguun Dorj", "Enkhjin Ganbold", "Wang Yuxuan", "Li Mengyao", "Zhang Hao", "Chen Siyu", "Rizky Pratama",
  "Putri Ayu Lestari", "Dimas Saputra", "Sujan Shrestha", "Anisha Gurung", "Prakash Thapa", "Arjun Nair", "Priya Sharma",
  "Rahul Iyer", "Ayesha Khan", "Hamza Siddiqui", "Tanvir Rahman", "Nusrat Jahan", "Aruzhan Seitkali", "Daniyar Abdrakhmanov",
  "Aibek Toktogulov", "Polina Smirnova", "Artem Volkov", "Kim Ji-woo", "Park Seo-yeon", "Lee Min-jun", "Choi Ha-eun",
  "Chinedu Okafor", "Amara Mensah", "Wanjiru Kamau", "Lucas Martin", "Sofia Rossi", "Mateo Gómez", "Julia Becker",
  "Andrea Santos", "Kittipong Srisuk", "Nattaya Chaiyaporn", "Farrukh Mirzaev", "Shakhzoda Ergasheva", "Hoang Gia Bao",
  "Munkh-Orgil Batbayar", "Liu Jiarui", "Kevin Wijaya", "Bishal Adhikari", "Fatima Zahra Alaoui", "Omar Haddad",
];

// ---------- sentence pools: [tone, text] ; tone p = positive, n = negative, m = any ----------
const OPENERS = {
  p: ["Loved {short}.", "{name} was one of my favorite courses this year.", "Solid course, would recommend.", "Surprisingly good.",
    "Best course I took in {semester}.", "Really glad I took {short}.", "Did not expect to enjoy {short} this much."],
  m: ["Mixed feelings about this one.", "{short} is okay.", "Not bad, not great.", "Depends a lot on what you expect.", "It was fine overall.",
    "Some good parts, some annoying parts."],
  n: ["Honestly disappointing.", "{short} stressed me out all semester, and not in a good way.", "I would not take {short} again.",
    "Not worth the stress.", "Frustrating course.", "I had high hopes for {short}."],
};
const TEACHING = [
  ["p", "{prof} explains things slowly and checks if everyone is following."],
  ["p", "Office hours with {prof} actually helped, I got walked through every mistake on my assignment."],
  ["p", "{prof} brings in real examples from industry, which kept the lectures interesting."],
  ["p", "You can tell {prof} prepares every class, the slides are clean and the examples make sense."],
  ["p", "{prof} learned everyone's name by week three, that kind of professor."],
  ["p", "{prof} replies to questions on the e-class board quickly, even on weekends."],
  ["m", "{prof} knows the subject deeply but sometimes forgets we are seeing it for the first time."],
  ["m", "Lectures with {prof} are fine, just a bit monotone after the first hour."],
  ["m", "{prof} is strict about deadlines but fair about everything else."],
  ["m", "Some weeks {prof} rushed through the slides to catch up with the schedule."],
  ["n", "{prof} mostly read the slides out loud, so I stopped going to lectures after the midterm."],
  ["n", "Questions in class were often answered with 'check the textbook'."],
  ["n", "Feedback on assignments came back very late, sometimes after the next one was already due."],
  ["n", "{prof} changed the assignment requirements twice in the middle of the semester."],
  ["n", "It was hard to reach {prof} outside class."],
];
const EXAMS = {
  easy: ["The midterm was basically the practice questions with different numbers.", "Exams are open book, so understanding matters more than memorizing.",
    "There is no final exam, just a project and a presentation.", "Quizzes are short and announced a week before."],
  hard: ["The final covers everything from week 1, so start reviewing early.", "Exam questions were much harder than anything in the homework.",
    "The midterm is a lot of memorization, definitions almost word for word.", "Time was the real problem in the exams, I could not finish the last question.",
    "Half the class did badly on the first quiz, and after that people started taking it seriously."],
};
const GRADING = {
  fair: ["Grading is transparent, the rubric is shared in week one.", "Partial credit is generous if you show your work.",
    "I got an A by doing every assignment on time, nothing fancy."],
  harsh: ["Relative grading made it really competitive.", "Small formatting mistakes cost points on every report.",
    "I still don't fully understand how the participation score was calculated."],
};
const ATTENDANCE = ["Attendance is checked every class through the app, and three absences hurt your grade.",
  "Attendance is taken, but nobody checks if you leave after the break.", "Being late counts as half an absence, so don't be late.",
  "Missing class is risky because a lot of exam content is only said out loud."];
const ENGLISH = {
  en: [["p", "Lectures are fully in English and easy to follow even if English is your second language."],
    ["p", "The professor speaks clear English and slows down when people look lost."],
    ["m", "Lectures are in English but sometimes switch to Korean for explanations, so ask if you need a translation."],
    ["m", "The slides are in English, but some of the reading materials were only in Korean."],
    ["m", "The accent took me a few weeks to get used to, after that no problem."]],
  ko: [["m", "It's taught in Korean, so you need around TOPIK 4 to keep up."],
    ["m", "Taught in Korean. My Korean is intermediate and I relied a lot on the slides and a translator app."],
    ["n", "As an international student the Korean-only lectures were really hard to follow."]],
};
const WORKLOAD = {
  light: ["Workload is light, maybe an hour or two a week outside class.", "You can finish most of the homework during class time.",
    "Very little homework, which helped during a heavy semester."],
  medium: ["Expect a few hours per week, more around project deadlines.", "Weekly assignments are short but they add up.",
    "The workload is manageable if you don't leave things to the night before."],
  heavy: ["Plan for many hours every week, this course ate my weekends.", "There is something due almost every week, plus a big project at the end.",
    "The workload is heavy, do not take it together with three other hard courses.", "I spent more time on this course than on my other three combined."],
};
const DIFFICULTY = {
  easy: ["Content-wise it is not difficult.", "Honestly it's one of the easier courses in the program."],
  hard: ["The content gets a lot harder after the midterm.", "It's a difficult course, especially without the background."],
};
const TIPS = ["Tip: form your project team early, the good teammates go fast.", "Tip: do the practice problems, they are very close to the exam.",
  "Tip: keep your own notes, the slides alone are not enough.", "Tip: start the final project before the last three weeks.",
  "Tip: ask questions in class, participation counts more than you think.", "Tip: review each week's material before the next class, everything builds up.",
  "Tip: if you are an exchange student, tell the professor early, they can help with materials."];
const CLOSERS = {
  yes: ["Recommend.", "Take it if it fits your timetable.", "Worth it.", "Would take again with the same professor.", "Good choice if you're on the fence."],
  no: ["Avoid if you have the choice.", "Only take it if it's required.", "Maybe try a different section."],
};
const SHORT = {
  p: ["Easy to follow, fair grading, nice professor.", "Great class, I learned a lot about {topic}.", "Chill course and actually useful.",
    "{prof} is great, I'd take anything they teach."],
  m: ["It's fine, just do the work and you'll pass.", "Average course, nothing to complain about, nothing to remember."],
  n: ["Too much work for the credits.", "Lectures were boring and the exam felt unfair.", "Disorganized from start to finish."],
};
const TOPIC_DETAILS = {
  code: [["m", "The weekly labs build on each other, so if you skip one you feel it the next week."],
    ["n", "The autograder is strict about edge cases and does not tell you what failed."],
    ["m", "Debugging the lab tasks took longer than the lectures themselves, but that's where I actually learned."],
    ["p", "The final project was the best part, we built something small but real."],
    ["m", "The coding exam is on paper, which felt strange after a semester of typing code."],
    ["p", "Pair programming in the labs was a nice way to meet people."]],
  ai: [["p", "We implemented real models in Python, not just theory slides."],
    ["m", "The project uses real datasets, so expect to spend time cleaning data before anything works."],
    ["n", "Without Python and some linear algebra beforehand, the first weeks are rough."],
    ["p", "The demos in class make the hard parts click."],
    ["p", "The term project is a good portfolio piece if you put effort into it."],
    ["n", "Training runs on the lab computers were slow, so start experiments early."]],
  math: [["m", "It's a lot of problem sets, and the exams look very similar to the homework."],
    ["n", "If you did not like high school math, this will take real effort."],
    ["p", "Weekly quizzes keep you on track, which honestly saved me before the midterm."],
    ["m", "The derivations go fast, so review the slides right after class."],
    ["p", "The worked examples on the board were clearer than the textbook."]],
  korean: [["m", "It moves quickly through grammar, and there are vocabulary quizzes every week."],
    ["p", "The speaking practice in pairs was the most useful part for daily life in Korea."],
    ["n", "The class assumes you remember last week's expressions, so you must review at home."],
    ["p", "Good preparation if you are aiming for the next TOPIK level."],
    ["m", "Dictation tests every Friday, small but they count."]],
  english: [["m", "Lots of small presentations and discussions, so you cannot hide in the back."],
    ["p", "Essays get detailed feedback, my writing improved a lot over the semester."],
    ["p", "Class is very interactive, the more you talk the better your participation score."],
    ["n", "Reading assignments are short but there is something due almost every week."],
    ["m", "Group discussions depend a lot on who is in your group."]],
  culinary: [["n", "The kitchen practicals are intense, and plating and hygiene are graded every session."],
    ["p", "You learn real techniques, but lab days are long and you're on your feet the whole time."],
    ["m", "Uniform and mise en place are checked strictly, show up prepared."],
    ["m", "The practical exam at the end is stressful but fair if you practiced the recipes."],
    ["n", "Ingredient costs for the extra practice sessions added up."]],
  hospitality: [["p", "It uses a lot of real hotel and restaurant cases, which makes it easy to follow."],
    ["m", "There's a group case study and a presentation, choose your team carefully."],
    ["p", "Very practical for internships, many examples come from the professor's industry experience."],
    ["m", "Exams are mostly the concepts from the slides plus one case question."],
    ["n", "The case study reports were long and the format rules were strict."]],
  media: [["m", "We produced our own content, so expect some late nights editing."],
    ["p", "The projects are creative and you get freedom in the topic, which I loved."],
    ["n", "Equipment booking was a pain, plan your shoots early."],
    ["p", "The feedback sessions on everyone's work were the most useful part."],
    ["m", "Your grade depends a lot on the final showcase."]],
  rail: [["p", "It connects theory with real railway projects, which makes it feel relevant."],
    ["n", "There are a lot of formulas and technical terms, keep a summary sheet."],
    ["p", "Good if you want to prepare for the certification exams later."],
    ["m", "The case studies from overseas projects were interesting, but the reports take time."]],
  business: [["m", "It's heavy on case studies, with a team project and a final presentation."],
    ["m", "Lots of reading, but the exams focus on what was discussed in class."],
    ["n", "The group project depends a lot on your teammates, mine did not show up."],
    ["m", "The concepts are not hard, but there are many of them to memorize."],
    ["p", "The guest lecture from a company was a highlight."]],
  social: [["p", "It's mostly discussion and short reflections, very different from my major classes."],
    ["p", "The readings are interesting and the discussions make you think."],
    ["m", "There's a short essay and a presentation, nothing too stressful if you keep up."],
    ["p", "A nice break from technical courses, and you meet students from other majors."],
    ["n", "Discussions sometimes went off topic and felt like a waste of time."]],
  general: [["m", "The structure is clear from the first week, you always know what is due."],
    ["p", "Assignments are reasonable and connected to what we did in class."],
    ["m", "The final evaluation matched what the professor said in week one."],
    ["n", "The course outline on the system did not match what we actually did."]],
};
const TYPE_LINES = {
  Basic: ["It assumes no background, good as a first-year course."], Core: ["It's a Core course, so you'll use this material again in later years."],
  Advanced: ["It's an Advanced course, finish the prerequisites first."], Focus: ["It's a Focus course you need to graduate, so plan it for year 3 or 4."],
  Track: ["Only track students can register for this offering, check before you plan it."], GE: ["As a GE it fits well around major courses."],
  Major: ["It's a major course, so the grade matters for your GPA."], Other: ["Check the remarks before registering."],
};

function pickTags(r, d, w, mode, topic, rnd) {
  const pool = [];
  if (r >= 4) pool.push("clear lectures", "inspiring", "fair grading");
  if (r <= 2) pool.push("lecture heavy", "unclear grading");
  if (d >= 4) pool.push("heavy on exams", "tough grader");
  if (d <= 2) pool.push("easy A");
  if (w >= 4) pool.push("lots of homework");
  if (w <= 2) pool.push("light workload");
  if (/practic|lab/i.test(mode) || ["culinary", "media", "code", "ai"].includes(topic)) pool.push("hands-on labs", "practical skills");
  if (["business", "hospitality", "english", "social"].includes(topic)) pool.push("group projects", "presentations", "participation matters");
  pool.push("attendance matters");
  const out = [];
  const n = rnd() < 0.15 ? 0 : 1 + Math.floor(rnd() * 3);
  const p = shuffle([...new Set(pool)], rnd);
  for (const t of p) if (out.length < n) out.push(t);
  return out;
}

const SEMESTERS = ["2023 Fall", "2024 Spring", "2024 Fall", "2025 Spring"];
function dateFor(sem, rnd) {
  const [y, term] = sem.split(" ");
  return `${y}-${term === "Spring" ? "06" : "12"}-${String(10 + Math.floor(rnd() * 18)).padStart(2, "0")}`;
}

const isRealProf = (p) => p && p.length < 40 && !/^(tbd|choose|staff)/i.test(p) && !/only|student|department/i.test(p);

// ---------- generate ----------
const reviews = [];
let counter = 1;

for (const course of courses) {
  const rnd = mulberry32(hash(course.id + "|courserevai-v2"));
  const group = typeGroup(course.type);
  const topic = topicOf(course.name);
  const n = DEMO_PROGRAMS.has(course.program) ? 4 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 2);
  const short = course.name.length > 28 ? "this course" : course.name;

  const baseQ = 2.6 + rnd() * 2.1;
  const diffBias = { Basic: -0.6, GE: -0.8, Core: 0.3, Advanced: 0.7, Focus: 0.6, Track: 0, Major: 0.2, Other: 0 }[group];
  const topicBias = { math: 0.7, ai: 0.5, code: 0.5, culinary: 0.3, rail: 0.4, social: -0.4, english: -0.2 }[topic] ?? 0;
  const baseD = 2.8 + diffBias + topicBias + (rnd() - 0.5);
  const baseW = baseD + (rnd() - 0.5) * 1.4 + (/practic|lab/i.test(course.mode) ? 0.3 : 0);
  const sections = course.sections.filter((s) => isRealProf((s.professor || "").trim()));
  const usableSections = sections.length ? sections : course.sections;

  const used = new Set(); // no sentence template repeats within one course
  const take = (pool, rnd) => {
    const avail = pool.filter((t) => !used.has(t));
    if (!avail.length) return null;
    const t = pickOne(avail, rnd);
    used.add(t);
    return t;
  };
  const takeToned = (pool, tone, rnd) => {
    const fits = pool.filter(([t]) => t === "m" || t === tone).map(([, s]) => s);
    return take(fits, rnd);
  };
  const usedNames = new Set();

  for (let i = 0; i < n; i++) {
    const rating = clamp(baseQ + (rnd() - 0.5) * 2.4);
    const difficulty = clamp(baseD + (rnd() - 0.5) * 1.6);
    const workload = clamp(baseW + (rnd() - 0.5) * 1.6);
    const tone = rating >= 4 ? "p" : rating === 3 ? "m" : "n";
    const wouldRecommend = rating >= 4 || (rating === 3 && rnd() < 0.5);
    const section = pickOne(usableSections, rnd);
    const profName = (section?.professor || "").trim();
    const hasProf = isRealProf(profName);
    const prof = hasProf ? `Prof. ${profName.replace(/\(.*?\)/g, "").trim()}` : "the professor";
    const semester = SEMESTERS[Math.floor(rnd() * SEMESTERS.length)];
    const fill = (s) =>
      s.replaceAll("{name}", course.name).replaceAll("{short}", short).replaceAll("{prof}", prof)
        .replaceAll("{semester}", semester).replaceAll("{topic}", TOPIC_WORD[topic]);

    // Length: 1 to 5 sentences.
    const r = rnd();
    const length = r < 0.12 ? 1 : r < 0.32 ? 2 : r < 0.62 ? 3 : r < 0.85 ? 4 : 5;
    let sentences = [];
    if (length === 1) {
      const s = take(SHORT[tone], rnd) ?? take(OPENERS[tone], rnd);
      if (s) sentences.push(s);
    } else {
      const wantOpener = rnd() < 0.6;
      const wantCloser = length >= 3 && rnd() < 0.45;
      let middleCount = length - (wantOpener ? 1 : 0) - (wantCloser ? 1 : 0);
      const wantTip = middleCount >= 2 && rnd() < 0.25;
      if (wantTip) middleCount -= 1;
      const aspects = shuffle(
        [
          () => (hasProf ? takeToned(TEACHING, tone, rnd) : null),
          () => takeToned(TOPIC_DETAILS[topic], tone, rnd),
          () => take(EXAMS[difficulty >= 4 ? "hard" : difficulty <= 2 ? "easy" : rnd() < 0.5 ? "hard" : "easy"], rnd),
          () => take(WORKLOAD[workload >= 4 ? "heavy" : workload <= 2 ? "light" : "medium"], rnd),
          () => take(GRADING[rating >= 3 ? "fair" : "harsh"], rnd),
          () => (rnd() < 0.5 ? take(ATTENDANCE, rnd) : null),
          () => takeToned(course.taught_in_korean ? ENGLISH.ko : ENGLISH.en, tone, rnd),
          () => (difficulty !== 3 ? take(DIFFICULTY[difficulty >= 4 ? "hard" : "easy"], rnd) : null),
          () => (rnd() < 0.35 ? take(TYPE_LINES[group], rnd) : null),
        ],
        rnd,
      );
      if (wantOpener) sentences.push(take(OPENERS[tone], rnd));
      let middle = 0;
      for (const a of aspects) {
        if (middle >= Math.max(1, middleCount)) break;
        const s = a();
        if (s) {
          sentences.push(s);
          middle++;
        }
      }
      if (wantTip) sentences.push(take(TIPS, rnd));
      if (wantCloser) sentences.push(take(CLOSERS[wouldRecommend ? "yes" : "no"], rnd));
    }
    sentences = sentences.filter(Boolean).map(fill);
    if (!sentences.length) sentences = [fill(rating >= 3 ? "Decent course overall." : "Not a great experience.")];

    // Fictional reviewer. Year: they took it in the course's target year or later.
    const years = course.target_years.length ? course.target_years : [1, 2, 3, 4];
    const year = Math.min(4, Math.max(...years) + (rnd() < 0.4 ? 1 : 0));
    const program = NON_MAJOR_PROGRAMS.has(course.program)
      ? rnd() < 0.35 ? "AI & Big Data" : pickOne(MAJORS, rnd)
      : course.program;
    let name = pickOne(NAMES, rnd);
    for (let tries = 0; usedNames.has(name) && tries < 10; tries++) name = pickOne(NAMES, rnd);
    usedNames.add(name);

    reviews.push({
      id: `r_${String(counter++).padStart(3, "0")}`,
      courseId: course.id,
      reviewer: { name, year, program },
      anonymous: rnd() < 0.6,
      professor: hasProf ? profName : "TBA",
      section: section?.section,
      semester,
      rating,
      difficulty,
      workload,
      wouldRecommend,
      tags: pickTags(rating, difficulty, workload, course.mode, topic, rnd),
      text: sentences.join(" "),
      createdAt: dateFor(semester, rnd),
      isSample: true,
      moderation: "ok",
    });
  }
}

writeFileSync(join(root, "data/reviews.json"), JSON.stringify(reviews, null, 2) + "\n");
console.log(`Wrote ${reviews.length} sample reviews for ${courses.length} courses -> data/reviews.json`);
