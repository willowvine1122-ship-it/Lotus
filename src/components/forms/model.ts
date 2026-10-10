import type { AccountMode, FormAnswer, FormChoice, FormContactField, FormDefinition, FormEnding, FormLogicRule, FormQuestion, FormQuestionType, FormThemeKey } from "@/lib/types";

/*
 * Forms: the pure rules shared by the builder, the public runner and the
 * server. Which question comes next, how a quiz is scored, which ending
 * shows, whether an answer is valid, and the starting templates.
 */

export const questionTypeLabel: Record<FormQuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  multiple_choice: "Multiple choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  rating: "Rating",
  opinion_scale: "Opinion scale",
  date: "Date",
  file_upload: "File upload",
  statement: "Statement",
};

export const questionGroups: { label: string; types: FormQuestionType[] }[] = [
  { label: "Contact", types: ["short_text", "email", "phone"] },
  { label: "Text and numbers", types: ["long_text", "number", "date"] },
  { label: "Choice", types: ["multiple_choice", "checkboxes", "dropdown", "yes_no"] },
  { label: "Rating", types: ["rating", "opinion_scale"] },
  { label: "Other", types: ["file_upload", "statement"] },
];

export const contactFieldLabel: Record<FormContactField, string> = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  city: "City",
};

export const opLabel: Record<FormLogicRule["op"], string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  gt: "is more than",
  lt: "is less than",
  answered: "is answered",
};

/** Which comparisons make sense for a question type. */
export function opsFor(type: FormQuestionType): FormLogicRule["op"][] {
  if (type === "number" || type === "rating" || type === "opinion_scale") return ["is", "is_not", "gt", "lt", "answered"];
  if (type === "multiple_choice" || type === "dropdown" || type === "yes_no") return ["is", "is_not", "answered"];
  if (type === "checkboxes") return ["contains", "answered"];
  return ["is", "contains", "answered"];
}

export const hasChoices = (t: FormQuestionType) => t === "multiple_choice" || t === "checkboxes" || t === "dropdown";
export const isScorable = (t: FormQuestionType) => hasChoices(t) || t === "yes_no";

/* ------------------------------- themes ------------------------------- */

/** The public form's own palette. These are the client's brand surfaces, not Lotus UI. */
export interface FormTheme {
  label: string;
  bg: string;
  fg: string;
  fg2: string;
  accent: string;
  accentFg: string;
  line: string;
  field: string;
}

export const formThemes: Record<FormThemeKey, FormTheme> = {
  paper: { label: "Paper", bg: "#faf9f6", fg: "#141821", fg2: "#5d6371", accent: "#141821", accentFg: "#ffffff", line: "#d9d6cf", field: "#ffffff" },
  ink: { label: "Ink", bg: "#121620", fg: "#f3f2ee", fg2: "#a3a8b4", accent: "#f3f2ee", accentFg: "#121620", line: "#2f3542", field: "#1b2030" },
  violet: { label: "Violet", bg: "#f4f1fd", fg: "#1d1640", fg2: "#5b5480", accent: "#6d4ae8", accentFg: "#ffffff", line: "#d8d0f5", field: "#ffffff" },
  sand: { label: "Sand", bg: "#f5eee3", fg: "#2b2117", fg2: "#73644f", accent: "#b4532a", accentFg: "#ffffff", line: "#e2d5c1", field: "#fffaf3" },
  forest: { label: "Forest", bg: "#0f2a22", fg: "#eef5ef", fg2: "#9cb8a8", accent: "#d6f36b", accentFg: "#0f2a22", line: "#24473b", field: "#14352b" },
  sky: { label: "Sky", bg: "#eef5fb", fg: "#0e2236", fg2: "#4f6478", accent: "#1f6fd1", accentFg: "#ffffff", line: "#cfdeec", field: "#ffffff" },
};

/* -------------------------------- ids -------------------------------- */

export const qid = () => `q-${Math.random().toString(36).slice(2, 9)}`;
const cid = () => `c-${Math.random().toString(36).slice(2, 9)}`;
const rid = () => `r-${Math.random().toString(36).slice(2, 9)}`;
export const eid = () => `e-${Math.random().toString(36).slice(2, 9)}`;
export const ruleId = rid;

export function choices(...labels: string[]): FormChoice[] {
  return labels.map((label) => ({ id: cid(), label }));
}

export function newQuestion(type: FormQuestionType): FormQuestion {
  const base: FormQuestion = { id: qid(), type, title: "", required: type !== "statement" };
  switch (type) {
    case "short_text":
      return { ...base, title: "What's your name?", mapTo: "name" };
    case "email":
      return { ...base, title: "What's your email?", placeholder: "name@example.com", mapTo: "email" };
    case "phone":
      return { ...base, title: "What's the best number to reach you?", mapTo: "phone" };
    case "long_text":
      return { ...base, title: "Anything else we should know?", required: false };
    case "number":
      return { ...base, title: "How many?" };
    case "date":
      return { ...base, title: "Which date works?" };
    case "multiple_choice":
    case "dropdown":
      return { ...base, title: "Pick one", choices: choices("Option A", "Option B", "Option C") };
    case "checkboxes":
      return { ...base, title: "Pick all that apply", choices: choices("Option A", "Option B", "Option C") };
    case "yes_no":
      return { ...base, title: "Yes or no?" };
    case "rating":
      return { ...base, title: "How would you rate us?", steps: 5 };
    case "opinion_scale":
      return { ...base, title: "How likely are you to recommend us to a friend?", steps: 10 };
    case "file_upload":
      return { ...base, title: "Upload a photo or document", required: false };
    case "statement":
      return { ...base, title: "A quick note before we start", description: "This takes about a minute." };
  }
}

/* ------------------------------- answers ------------------------------ */

export const isEmpty = (a: FormAnswer | undefined) => a === undefined || (Array.isArray(a) ? a.length === 0 : a.trim() === "");

/** The answer as a person reads it: choice labels instead of ids. */
export function answerText(q: FormQuestion, a: FormAnswer | undefined): string {
  if (isEmpty(a)) return "";
  if (q.choices && hasChoices(q.type)) {
    const ids = Array.isArray(a) ? a : [a!];
    return ids.map((id) => q.choices!.find((c) => c.id === id)?.label ?? id).join(", ");
  }
  if (q.type === "yes_no") return a === "yes" ? "Yes" : "No";
  if (q.type === "rating") return `${a} of ${q.steps ?? 5}`;
  return Array.isArray(a) ? a.join(", ") : a!;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Why an answer can't go through, or undefined when it can. */
export function answerError(q: FormQuestion, a: FormAnswer | undefined): string | undefined {
  if (q.type === "statement") return undefined;
  if (isEmpty(a)) return q.required ? (q.type === "file_upload" ? "Please add a file" : hasChoices(q.type) || q.type === "yes_no" ? "Please pick an answer" : "Please fill this in") : undefined;
  const v = Array.isArray(a) ? "" : a!.trim();
  if (q.type === "email" && !EMAIL.test(v)) return "That email doesn't look right";
  if (q.type === "phone" && v.replace(/\D/g, "").length < 7) return "That number looks too short";
  if (q.type === "number" && !Number.isFinite(Number(v))) return "Please enter a number";
  if (q.type === "date" && Number.isNaN(Date.parse(v))) return "Please pick a date";
  if (q.choices && hasChoices(q.type)) {
    const ids = Array.isArray(a) ? a : [v];
    if (ids.some((id) => !q.choices!.some((c) => c.id === id))) return "Please pick from the list";
  }
  if ((q.type === "short_text" || q.type === "email" || q.type === "phone") && v.length > 300) return "That's too long";
  if (q.type === "long_text" && v.length > 5000) return "That's too long";
  return undefined;
}

function matches(rule: FormLogicRule, q: FormQuestion, a: FormAnswer | undefined): boolean {
  if (rule.op === "answered") return !isEmpty(a);
  if (isEmpty(a)) return false;
  const values = Array.isArray(a) ? a : [a!];
  const want = rule.value.trim().toLowerCase();
  const text = values.map((v) => v.toLowerCase());
  switch (rule.op) {
    case "is":
      return text.some((v) => v === want);
    case "is_not":
      return text.every((v) => v !== want);
    case "contains":
      return q.choices && hasChoices(q.type) ? text.includes(want) : text.some((v) => v.includes(want));
    case "gt":
      return Number(values[0]) > Number(rule.value);
    case "lt":
      return Number(values[0]) < Number(rule.value);
  }
}

/** The id of the question after `q`, following its jump rules; "end" when the form is done. */
export function nextQuestionId(form: Pick<FormDefinition, "questions">, q: FormQuestion, a: FormAnswer | undefined): string {
  for (const rule of q.logic ?? []) {
    if (matches(rule, q, a) && (rule.goTo === "end" || form.questions.some((x) => x.id === rule.goTo))) return rule.goTo;
  }
  const i = form.questions.findIndex((x) => x.id === q.id);
  return form.questions[i + 1]?.id ?? "end";
}

/** Walk the form with these answers: the questions a respondent actually sees, in order. */
export function path(form: Pick<FormDefinition, "questions">, answers: Record<string, FormAnswer>): FormQuestion[] {
  const seen: FormQuestion[] = [];
  let q: FormQuestion | undefined = form.questions[0];
  while (q && !seen.includes(q)) {
    seen.push(q);
    const next = nextQuestionId(form, q, answers[q.id]);
    q = next === "end" ? undefined : form.questions.find((x) => x.id === next);
  }
  return seen;
}

export function scoreOf(form: Pick<FormDefinition, "questions" | "scoring">, answers: Record<string, FormAnswer>): number | undefined {
  if (!form.scoring) return undefined;
  let total = 0;
  for (const q of form.questions) {
    const a = answers[q.id];
    if (isEmpty(a) || !q.choices) continue;
    for (const id of Array.isArray(a) ? a : [a!]) total += q.choices.find((c) => c.id === id)?.score ?? 0;
  }
  return total;
}

/** The highest possible quiz score, for "7 of 10". */
export function maxScore(form: Pick<FormDefinition, "questions">): number {
  let total = 0;
  for (const q of form.questions) {
    if (!q.choices) continue;
    const scores = q.choices.map((c) => Math.max(0, c.score ?? 0));
    total += q.type === "checkboxes" ? scores.reduce((a, b) => a + b, 0) : Math.max(0, ...scores);
  }
  return total;
}

export function pickEnding(form: Pick<FormDefinition, "endings" | "scoring">, score: number | undefined): FormEnding | undefined {
  if (!form.scoring || score === undefined) return form.endings[0];
  const ranked = [...form.endings].sort((a, b) => (b.minScore ?? 0) - (a.minScore ?? 0));
  return ranked.find((e) => score >= (e.minScore ?? 0)) ?? form.endings[0];
}

/** Contact fields filled by the answers. */
export function contactFields(form: Pick<FormDefinition, "questions">, answers: Record<string, FormAnswer>) {
  const out: Partial<Record<Exclude<FormContactField, "name">, string>> = {};
  for (const q of form.questions) {
    const a = answers[q.id];
    if (!q.mapTo || isEmpty(a) || Array.isArray(a)) continue;
    const v = a!.trim();
    if (q.mapTo === "name") {
      const [first, ...rest] = v.split(/\s+/);
      out.firstName ??= first;
      if (rest.length) out.lastName ??= rest.join(" ");
    } else out[q.mapTo] ??= q.mapTo === "email" ? v.toLowerCase() : v;
  }
  return out;
}

/* ------------------------------ checks ------------------------------- */

export interface FormIssue {
  questionId?: string;
  message: string;
  blocking: boolean;
}

/** What stops a form from going live, and what is worth a warning. */
export function formIssues(form: FormDefinition): FormIssue[] {
  const issues: FormIssue[] = [];
  const answerable = form.questions.filter((q) => q.type !== "statement");
  if (answerable.length === 0) issues.push({ message: "Add at least one question", blocking: true });
  for (const q of form.questions) {
    if (!q.title.trim()) issues.push({ questionId: q.id, message: "Question has no text", blocking: true });
    if (hasChoices(q.type) && (q.choices ?? []).filter((c) => c.label.trim()).length < 2) issues.push({ questionId: q.id, message: "Needs at least two choices", blocking: true });
    for (const r of q.logic ?? []) {
      if (r.goTo !== "end" && !form.questions.some((x) => x.id === r.goTo)) issues.push({ questionId: q.id, message: "A jump points to a deleted question", blocking: true });
      const i = form.questions.findIndex((x) => x.id === q.id);
      const j = form.questions.findIndex((x) => x.id === r.goTo);
      if (j !== -1 && j <= i) issues.push({ questionId: q.id, message: "Jumps can only go forward", blocking: true });
      if (r.op !== "answered" && !r.value.trim()) issues.push({ questionId: q.id, message: "A jump has no value to compare", blocking: true });
    }
  }
  if (form.endings.length === 0) issues.push({ message: "Add a closing screen", blocking: true });
  if (answerable.length && !form.questions.some((q) => q.mapTo === "email" || q.mapTo === "phone")) issues.push({ message: "No question saves an email or phone, so responses won't reach the CRM", blocking: false });
  return issues;
}

/* ----------------------------- templates ------------------------------ */

export interface FormTemplate {
  key: string;
  name: string;
  summary: string;
  modes: AccountMode[];
  build: (clientName: string) => Pick<FormDefinition, "welcome" | "questions" | "endings" | "scoring" | "theme" | "tags" | "hiddenFields">;
}

const welcome = (title: string, body: string, button = "Start") => ({ enabled: true, title, body, button });
const thanks = (title = "Thanks, that's everything", body = "We'll be in touch shortly."): FormEnding => ({ id: eid(), title, body });

function q(type: FormQuestionType, patch: Partial<FormQuestion> = {}): FormQuestion {
  return { ...newQuestion(type), ...patch };
}

export const formTemplates: FormTemplate[] = [
  {
    key: "lead",
    name: "Lead capture",
    summary: "Name, email, phone and what they need. Four questions.",
    modes: ["marketing"],
    build: (client) => {
      const service = q("multiple_choice", { title: "What can we help you with?", choices: choices("A new appointment", "A quote", "Something else") });
      return {
        welcome: welcome(`Book time with ${client}`, "Four quick questions and we'll get back to you today."),
        questions: [q("short_text", { title: "First, what's your name?" }), q("email"), q("phone"), service],
        endings: [thanks(`Thanks, we've got it`, `Someone from ${client} will reach out today.`)],
        scoring: false,
        theme: "paper",
        tags: ["Form lead"],
        hiddenFields: ["utm_source", "utm_campaign"],
      };
    },
  },
  {
    key: "quote",
    name: "Quote request",
    summary: "Project type, size, timing, photos and contact details, with a jump for urgent jobs.",
    modes: ["marketing"],
    build: (client) => {
      const timing = q("multiple_choice", { title: "When do you need it done?", choices: choices("This week", "This month", "Just planning") });
      const urgent = q("long_text", { title: "Tell us what's going on", description: "We prioritise urgent jobs, so the more detail the better.", required: true });
      const photos = q("file_upload", { title: "Add a photo of the area", description: "Optional, but it makes the quote faster." });
      const name = q("short_text", { title: "What's your name?" });
      timing.logic = [{ id: rid(), op: "is_not", value: timing.choices![0]!.id, goTo: photos.id }];
      return {
        welcome: welcome(`Get a quote from ${client}`, "About two minutes. A real person reads every request."),
        questions: [
          q("multiple_choice", { title: "What kind of job is it?", choices: choices("Repair", "Replacement", "New install", "Maintenance") }),
          q("dropdown", { title: "Roughly how big is the space?", choices: choices("Under 500 sq ft", "500 to 1,500 sq ft", "1,500 to 3,000 sq ft", "Over 3,000 sq ft") }),
          timing,
          urgent,
          photos,
          name,
          q("email"),
          q("phone"),
          q("short_text", { title: "Which city is the job in?", mapTo: "city", required: false }),
        ],
        endings: [thanks("Request received", "We'll send your estimate within one business day.")],
        scoring: false,
        theme: "sand",
        tags: ["Quote request"],
        hiddenFields: ["utm_source", "utm_campaign", "gclid"],
      };
    },
  },
  {
    key: "quiz",
    name: "Scored quiz",
    summary: "Points per answer and a different result screen by score. Good for lead magnets.",
    modes: ["marketing", "fundraising"],
    build: (client) => {
      const scored = (title: string, labels: [string, number][]) => q("multiple_choice", { title, choices: labels.map(([label, score]) => ({ id: cid(), label, score })) });
      return {
        welcome: welcome("How ready are you?", `Five questions from ${client}. You'll get a score and what to do next.`, "Take the quiz"),
        questions: [
          scored("How often do you think about this?", [["Every day", 3], ["Every week", 2], ["Rarely", 1]]),
          scored("Have you set a budget?", [["Yes, a firm one", 3], ["A rough idea", 2], ["Not yet", 0]]),
          scored("When would you like to start?", [["Right away", 3], ["In a few months", 2], ["Next year", 1]]),
          scored("Who else needs to agree?", [["Nobody, it's my call", 3], ["One other person", 2], ["A committee", 1]]),
          q("email", { title: "Where should we send your result?" }),
        ],
        endings: [
          { id: eid(), title: "You're ready to go", body: "You scored high. Book a call and we'll get you started this week.", minScore: 10, buttonLabel: "Book a call", buttonUrl: "" },
          { id: eid(), title: "You're getting close", body: "A few things to settle first. We've emailed you a short checklist.", minScore: 6 },
          { id: eid(), title: "Early days, and that's fine", body: "We've sent a guide to help you plan. No rush.", minScore: 0 },
        ],
        scoring: true,
        theme: "violet",
        tags: ["Quiz"],
        hiddenFields: ["utm_source"],
      };
    },
  },
  {
    key: "feedback",
    name: "Feedback and NPS",
    summary: "0 to 10 recommend score with a follow-up that changes by answer.",
    modes: ["marketing", "fundraising"],
    build: (client) => {
      const nps = q("opinion_scale", { title: `How likely are you to recommend ${client} to a friend?` });
      const low = q("long_text", { title: "Sorry to hear that. What went wrong?", required: true });
      const high = q("long_text", { title: "Glad to hear it. What did we do well?", required: false });
      nps.logic = [{ id: rid(), op: "gt", value: "6", goTo: high.id }];
      low.logic = [{ id: rid(), op: "answered", value: "", goTo: "end" }];
      return {
        welcome: { enabled: false, title: "", body: "", button: "Start" },
        questions: [nps, low, high, q("email", { title: "Your email, if you'd like a reply", required: false })],
        endings: [thanks("Thank you", "Every answer is read by the team.")],
        scoring: false,
        theme: "paper",
        tags: ["Feedback"],
        hiddenFields: [],
      };
    },
  },
  {
    key: "donor",
    name: "Donor survey",
    summary: "Why they give, how they'd like to hear from you, and whether they'd volunteer.",
    modes: ["fundraising"],
    build: (client) => ({
      welcome: welcome(`Help shape ${client}`, "Three minutes, and it genuinely changes what we do next."),
      questions: [
        q("short_text", { title: "What's your name?" }),
        q("email"),
        q("checkboxes", { title: "What matters most to you about our work?", choices: choices("Direct help for families", "Long-term change", "Local impact", "Transparency on spending") }),
        q("multiple_choice", { title: "How would you like to hear from us?", choices: choices("Monthly email", "A text when something big happens", "Post, a few times a year", "Only when I ask") }),
        q("yes_no", { title: "Would you be open to volunteering?" }),
        q("long_text", { title: "Anything you'd like to tell us?", required: false }),
      ],
      endings: [thanks("Thank you for giving your time", "Your answers go straight to our team.")],
      scoring: false,
      theme: "forest",
      tags: ["Donor survey"],
      hiddenFields: ["utm_source"],
    }),
  },
  {
    key: "blank",
    name: "Start from scratch",
    summary: "One question and a closing screen.",
    modes: ["marketing", "fundraising"],
    build: () => ({
      welcome: { enabled: false, title: "", body: "", button: "Start" },
      questions: [q("short_text", { title: "" })],
      endings: [thanks()],
      scoring: false,
      theme: "paper",
      tags: [],
      hiddenFields: [],
    }),
  },
];

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 48) || "form"
  );
}

export interface ClientRef {
  id: string;
  name: string;
  slug: string;
  mode: AccountMode;
}
