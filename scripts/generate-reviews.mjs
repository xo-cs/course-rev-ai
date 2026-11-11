#!/usr/bin/env node
// Generates data/reviews.json with SAMPLE reviews for the demo.
// Deterministic: same courses.json -> same output. Run: npm run gen:reviews
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

// ---------- course classification ----------
const DEMO_PROGRAMS = new Set(["AI & Big Data", "General Education"]);

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
function topicOf(name) {
  for (const [t, re] of TOPICS) if (re.test(name)) return t;
  return "general";
}

const TOPIC_DETAILS = {
  code: [
    "The weekly labs in {name} build on each other, so if you skip one you will feel it the next week.",
    "Most of the grade in {name} comes from coding assignments, and the autograder is strict about edge cases.",
    "Debugging the lab tasks took me longer than the lectures themselves, but that is where I actually learned.",
    "The final project for {name} was the best part, we built something small but real.",
    "Lectures explain the concepts, but you need to practice on your own to pass the coding exam.",
  ],
  ai: [
    "In {name} we implemented real models in Python, not just theory slides.",
    "The project for {name} uses actual datasets, so expect to spend time cleaning data before anything works.",
    "You need some Python and basic linear algebra before {name}, otherwise the first weeks are rough.",
    "Labs follow the lecture closely and the demos in class make the hard parts click.",
    "The term project in {name} is a good portfolio piece if you put effort into it.",
  ],
  math: [
    "{name} is a lot of problem sets, and the exams look very similar to the homework.",
    "If you did not like high school math, {name} will take real effort, but the examples help.",
    "Weekly quizzes in {name} keep you on track, which honestly saved me before the midterm.",
    "The proofs and derivations go fast, so review the slides right after class.",
  ],
  korean: [
    "{name} moves quickly through grammar, and the vocabulary quizzes are every week.",
    "Speaking practice in pairs was the most useful part of {name} for daily life in Korea.",
    "You must review at home, the class assumes you remember last week's expressions.",
    "Good preparation if you are aiming for the next TOPIK level.",
  ],
  english: [
    "{name} has lots of small presentations and discussions, so you cannot hide in the back.",
    "Essays get detailed feedback, my writing improved a lot over the semester.",
    "Class is very interactive, the more you talk the better your participation score.",
    "Reading assignments are short but there is something due almost every week.",
  ],
  culinary: [
    "The kitchen practicals in {name} are intense, and plating and hygiene are graded every session.",
    "You learn real techniques in {name}, but the lab days are long and you will be on your feet the whole time.",
    "Uniform and mise en place are checked strictly, show up prepared.",
    "The practical exam at the end is stressful but fair if you practiced the recipes.",
  ],
  hospitality: [
    "{name} uses a lot of real hotel and restaurant cases, which makes it easy to follow.",
    "There is a group case study and a presentation, choose your team carefully.",
    "Very practical for internships, many examples come from the professor's industry experience.",
    "Exams are mostly about the concepts from the slides plus one case question.",
  ],
  media: [
    "In {name} we produced our own content, so expect some late nights editing.",
    "The projects in {name} are creative and you get freedom in the topic, which I loved.",
    "Equipment booking can be a pain, plan your shoots early.",
    "Feedback sessions on everyone's work were the most useful part of {name}.",
  ],
  rail: [
    "{name} connects theory with real railway projects, which makes it feel relevant.",
    "There are a lot of formulas and technical terms, keep a summary sheet.",
    "Good if you want to prepare for the certification exams later.",
    "Case studies from overseas projects were interesting, but the reports take time.",
  ],
  business: [
    "{name} is heavy on case studies and a team project with a final presentation.",
    "Lots of reading, but the exams focus on what was discussed in class.",
    "The group project in {name} depends a lot on your teammates.",
    "Concepts are not hard, but there are many of them to memorize before exams.",
  ],
  social: [
    "{name} is mostly discussion and short reflections, very different from my major classes.",
    "Readings are interesting and the class discussions make you think.",
    "There is a short essay and a presentation, nothing too stressful if you keep up.",
    "A nice break from technical courses, and you meet students from other majors.",
  ],
  general: [
    "The structure of {name} is clear from the first week, you always know what is due.",
    "Assignments are reasonable and connected to what we did in class.",
    "Attendance is checked, so do not skip too much.",
    "The final evaluation was fair and matched what the professor said in week one.",
  ],
};

const TYPE_LINES = {
  Basic: ["Good as a first year course, it assumes no background.", "As a Basic course it sets you up for the Core classes next year."],
  Core: ["It is a Core course, so you will use this material again in later years.", "Core course, you cannot really avoid it, so better take it seriously."],
  Advanced: ["This is an Advanced course, make sure you have the prerequisites done first.", "Advanced level, so the pace assumes you already know the basics."],
  Focus: ["It is a Focus course you need for graduation, so plan it in your 3rd or 4th year.", "Focus course, required to graduate, so you will take it anyway."],
  Track: ["Only students registered in the track can take this offering, check before registering.", "It counts toward the track, which is why I took it."],
  GE: ["As a GE it fits well around major courses.", "Good GE choice if you want something useful and not too heavy."],
  Major: ["It is a major course, so the grade really matters for your GPA.", "Solid major requirement, most of my classmates took it in the same year."],
  Other: ["Worth checking the remarks before registering.", "Make sure it counts for your program before you register."],
};

const OPENERS = {
  pos: [
    "Honestly one of the better courses I took.",
    "Really enjoyed {name}.",
    "{name} was worth it.",
    "Did not expect much but {name} surprised me.",
    "Great course overall.",
    "I would take {name} again.",
  ],
  mid: [
    "{name} is okay, nothing special.",
    "Mixed feelings about {name}.",
    "Decent course with some annoying parts.",
    "{name} is fine if you know what you are signing up for.",
  ],
  neg: [
    "Not my favorite course.",
    "{name} was a struggle for me.",
    "I expected more from {name}.",
    "Honestly {name} was frustrating at times.",
  ],
};

const PROF_LINES = {
  pos: [
    "Prof. {prof} explains clearly and answers questions patiently.",
    "{prof} is very approachable and replies to emails fast.",
    "{prof} uses lots of examples, which made the lectures easy to follow.",
    "You can tell {prof} cares whether students actually understand.",
  ],
  mid: [
    "{prof} knows the material well, but lectures can be a bit dry.",
    "{prof} is fair, just not the most exciting lecturer.",
    "{prof} goes fast sometimes, so ask questions early.",
  ],
  neg: [
    "{prof}'s lectures were hard to follow and mostly read from the slides.",
    "{prof} expected a lot without explaining the requirements clearly.",
    "Getting feedback from {prof} was slow, which made assignments stressful.",
  ],
};

function effortLine(d, w, rnd) {
  const diff =
    d >= 5 ? "It is really difficult" : d === 4 ? "It is on the harder side" : d === 3 ? "Difficulty is medium" : d === 2 ? "It is not very hard" : "It is easy";
  const work =
    w >= 5 ? "and the workload is heavy, plan for many hours every week."
    : w === 4 ? "and there is a lot of work outside class."
    : w === 3 ? "and the workload is manageable if you stay consistent."
    : w === 2 ? "and the workload is light."
    : "and there is almost no homework.";
  return rnd() < 0.5 ? `${diff} ${work}` : `${diff}, ${work.replace(/^and /, "")}`;
}

const CLOSERS = {
  yes: [
    "Recommend it.",
    "Take it, just keep up from week one.",
    "Would recommend, especially with this professor.",
    "Worth taking if it fits your timetable.",
  ],
  no: [
    "I would pick a different course if you have the choice.",
    "Only take it if you have to.",
    "Not recommended unless it is required for you.",
  ],
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
  const n = 1 + Math.floor(rnd() * 3);
  while (out.length < n && pool.length) {
    const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

const SEMESTERS = ["2023 Fall", "2024 Spring", "2024 Fall", "2025 Spring"];
function dateFor(sem, rnd) {
  const [y, term] = sem.split(" ");
  const month = term === "Spring" ? "06" : "12";
  const day = String(10 + Math.floor(rnd() * 18)).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

const isRealProf = (p) =>
  p && p.length < 40 && !/^(tbd|choose|staff)/i.test(p) && !/only|student|department/i.test(p);

function profsOf(course) {
  const list = [...new Set(course.sections.map((s) => (s.professor || "").trim()).filter(isRealProf))];
  return list.length ? list : ["TBA"];
}

function pick(arr, rnd, used) {
  const avail = used ? arr.filter((x) => !used.has(x)) : arr;
  const src = avail.length ? avail : arr;
  const v = src[Math.floor(rnd() * src.length)];
  used?.add(v);
  return v;
}

// ---------- generate ----------
const reviews = [];
let counter = 1;

for (const course of courses) {
  const rnd = mulberry32(hash(course.id + "|courserevai-v1"));
  const group = typeGroup(course.type);
  const topic = topicOf(course.name);
  const n = DEMO_PROGRAMS.has(course.program) ? 4 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 2);

  // Course "personality" so reviews of one course agree with each other.
  const baseQ = 2.6 + rnd() * 2.1;
  const diffBias = { Basic: -0.6, GE: -0.8, Core: 0.3, Advanced: 0.7, Focus: 0.6, Track: 0, Major: 0.2, Other: 0 }[group];
  const topicBias = { math: 0.7, ai: 0.5, code: 0.5, culinary: 0.3, rail: 0.4, social: -0.4, english: -0.2 }[topic] ?? 0;
  const baseD = 2.8 + diffBias + topicBias + (rnd() - 0.5);
  const baseW = baseD + (rnd() - 0.5) * 1.4 + (/practic|lab/i.test(course.mode) ? 0.3 : 0);
  const profs = profsOf(course);

  const used = new Set();
  for (let i = 0; i < n; i++) {
    const rating = clamp(baseQ + (rnd() - 0.5) * 2.2);
    const difficulty = clamp(baseD + (rnd() - 0.5) * 1.6);
    const workload = clamp(baseW + (rnd() - 0.5) * 1.6);
    const mood = rating >= 4 ? "pos" : rating === 3 ? "mid" : "neg";
    const wouldRecommend = rating >= 4 || (rating === 3 && rnd() < 0.5);
    const prof = profs[Math.floor(rnd() * profs.length)];
    const fill = (s) => s.replaceAll("{name}", course.name).replaceAll("{prof}", prof);

    const parts = [fill(pick(OPENERS[mood], rnd, used))];
    const middle = [];
    if (prof !== "TBA") middle.push(fill(pick(PROF_LINES[mood], rnd, used)));
    middle.push(fill(pick(TOPIC_DETAILS[topic], rnd, used)));
    middle.push(effortLine(difficulty, workload, rnd));
    if (rnd() < 0.6) middle.push(pick(TYPE_LINES[group], rnd, used));
    if (course.taught_in_korean && rnd() < 0.5) middle.push("Note that it is taught in Korean.");
    // light shuffle of the middle sentences
    middle.sort(() => rnd() - 0.5);
    parts.push(...middle.slice(0, 2 + Math.floor(rnd() * 2)));
    parts.push(pick(CLOSERS[wouldRecommend ? "yes" : "no"], rnd, used));

    const semester = SEMESTERS[Math.floor(rnd() * SEMESTERS.length)];
    reviews.push({
      id: `r_${String(counter++).padStart(3, "0")}`,
      courseId: course.id,
      professor: prof,
      semester,
      rating,
      difficulty,
      workload,
      wouldRecommend,
      tags: pickTags(rating, difficulty, workload, course.mode, topic, rnd),
      text: parts.join(" "),
      createdAt: dateFor(semester, rnd),
      isSample: true,
    });
  }
}

writeFileSync(join(root, "data/reviews.json"), JSON.stringify(reviews, null, 2) + "\n");
console.log(`Wrote ${reviews.length} sample reviews for ${courses.length} courses -> data/reviews.json`);
