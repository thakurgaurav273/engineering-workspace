export type Status = "on_track" | "blocked" | "completed";
export type Role = "Engineer" | "Senior Engineer" | "Staff Engineer" | "Engineering Manager" | "Intern";

export interface Person {
  id: string;
  name: string;
  role: Role;
  department: string;
  team: string;
  status: Status;
  performanceScore: number;
  lastCheckIn: string;
  recognitionCount: number;
  goalCompletion: number;
  joinedDate: string;
  manager: string;
  initials: string;
  color: string;
}

export interface CheckIn {
  id: string;
  personId: string;
  status: Status;
  summary: string;
  blockers?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  personId: string;
  title: string;
  description: string;
  progress: number;
  status: "active" | "completed" | "archived";
  dueDate: string;
}

export interface Review {
  id: string;
  personId: string;
  type: "self" | "manager";
  week: string;
  wins: string;
  challenges: string;
  learning: string;
  feedback: string;
  rating: number;
}

export interface Recognition {
  id: string;
  recipientId: string;
  authorId: string;
  title: string;
  note?: string;
  createdAt: string;
}

const colors = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  "bg-fuchsia-500", "bg-orange-500", "bg-lime-500", "bg-sky-500",
];

const initials = (n: string) => n.split(" ").map(p => p[0]).slice(0, 2).join("");

const rawPeople: Omit<Person, "initials" | "color">[] = [
  { id: "p1", name: "Ava Chen", role: "Staff Engineer", department: "Platform", team: "Infrastructure", status: "on_track", performanceScore: 94, lastCheckIn: "2h ago", recognitionCount: 18, goalCompletion: 82, joinedDate: "Mar 2021", manager: "Marcus Wei" },
  { id: "p2", name: "Marcus Wei", role: "Engineering Manager", department: "Platform", team: "Infrastructure", status: "on_track", performanceScore: 91, lastCheckIn: "1h ago", recognitionCount: 24, goalCompletion: 76, joinedDate: "Jan 2020", manager: "Priya Anand" },
  { id: "p3", name: "Sofia Ramos", role: "Senior Engineer", department: "Product", team: "Growth", status: "blocked", performanceScore: 87, lastCheckIn: "5h ago", recognitionCount: 12, goalCompletion: 64, joinedDate: "Aug 2022", manager: "Daniel Okafor" },
  { id: "p4", name: "Daniel Okafor", role: "Engineering Manager", department: "Product", team: "Growth", status: "on_track", performanceScore: 89, lastCheckIn: "3h ago", recognitionCount: 21, goalCompletion: 71, joinedDate: "Nov 2020", manager: "Priya Anand" },
  { id: "p5", name: "Yuki Tanaka", role: "Senior Engineer", department: "Platform", team: "API", status: "on_track", performanceScore: 92, lastCheckIn: "45m ago", recognitionCount: 15, goalCompletion: 88, joinedDate: "Feb 2022", manager: "Marcus Wei" },
  { id: "p6", name: "Liam Foster", role: "Engineer", department: "Product", team: "Billing", status: "completed", performanceScore: 85, lastCheckIn: "6h ago", recognitionCount: 9, goalCompletion: 95, joinedDate: "Jun 2023", manager: "Daniel Okafor" },
  { id: "p7", name: "Nora Bergström", role: "Engineer", department: "Platform", team: "Data", status: "on_track", performanceScore: 88, lastCheckIn: "1h ago", recognitionCount: 11, goalCompletion: 73, joinedDate: "Apr 2023", manager: "Marcus Wei" },
  { id: "p8", name: "Kai Sundaram", role: "Intern", department: "Product", team: "Growth", status: "on_track", performanceScore: 78, lastCheckIn: "30m ago", recognitionCount: 6, goalCompletion: 58, joinedDate: "Jun 2026", manager: "Sofia Ramos" },
  { id: "p9", name: "Elena Ruiz", role: "Senior Engineer", department: "Product", team: "Payments", status: "blocked", performanceScore: 86, lastCheckIn: "8h ago", recognitionCount: 14, goalCompletion: 62, joinedDate: "Sep 2021", manager: "Daniel Okafor" },
  { id: "p10", name: "Priya Anand", role: "Staff Engineer", department: "Platform", team: "Architecture", status: "on_track", performanceScore: 96, lastCheckIn: "20m ago", recognitionCount: 32, goalCompletion: 84, joinedDate: "Jul 2019", manager: "-" },
  { id: "p11", name: "Theo Novak", role: "Engineer", department: "Product", team: "Billing", status: "on_track", performanceScore: 83, lastCheckIn: "4h ago", recognitionCount: 8, goalCompletion: 69, joinedDate: "Feb 2024", manager: "Liam Foster" },
  { id: "p12", name: "Amina Diallo", role: "Intern", department: "Platform", team: "Data", status: "on_track", performanceScore: 80, lastCheckIn: "1h ago", recognitionCount: 5, goalCompletion: 52, joinedDate: "Jun 2026", manager: "Nora Bergström" },
];

export const people: Person[] = rawPeople.map((p, i) => ({
  ...p,
  initials: initials(p.name),
  color: colors[i % colors.length],
}));

export const getPerson = (id: string) => people.find(p => p.id === id);

export const checkIns: CheckIn[] = [
  { id: "c1", personId: "p1", status: "on_track", summary: "Shipped the retry logic for the ingestion pipeline. Reviewing Yuki's PR next.", createdAt: "2h ago" },
  { id: "c2", personId: "p3", status: "blocked", summary: "Investigating a flaky test in the checkout suite.", blockers: "Waiting on staging DB access from SRE.", createdAt: "5h ago" },
  { id: "c3", personId: "p5", status: "on_track", summary: "Rolling out the new rate limiter to 25% of traffic.", createdAt: "45m ago" },
  { id: "c4", personId: "p6", status: "completed", summary: "Closed the Stripe webhook reconciliation project.", createdAt: "6h ago" },
  { id: "c5", personId: "p2", status: "on_track", summary: "1:1s with the team, drafting Q3 planning doc.", createdAt: "1h ago" },
  { id: "c6", personId: "p8", status: "on_track", summary: "Pairing with Sofia on the growth experiment framework.", createdAt: "30m ago" },
  { id: "c7", personId: "p9", status: "blocked", summary: "Payment provider migration hitting unexpected schema drift.", blockers: "Need architectural review from Priya.", createdAt: "8h ago" },
  { id: "c8", personId: "p10", status: "on_track", summary: "Architecture review for the new event bus proposal.", createdAt: "20m ago" },
];

export const goals: Goal[] = [
  { id: "g1", personId: "p1", title: "Reduce ingestion p99 latency by 40%", description: "Ship batching + connection pooling improvements to the ingestion service.", progress: 72, status: "active", dueDate: "Jul 30" },
  { id: "g2", personId: "p1", title: "Mentor two engineers on platform design", description: "Weekly sessions with Nora and Kai on distributed systems fundamentals.", progress: 60, status: "active", dueDate: "Sep 15" },
  { id: "g3", personId: "p5", title: "Launch v2 of the public API", description: "GA release with the new authentication flow and versioning strategy.", progress: 88, status: "active", dueDate: "Jul 12" },
  { id: "g4", personId: "p6", title: "Complete Stripe reconciliation project", description: "Close all open discrepancies and document the runbook.", progress: 100, status: "completed", dueDate: "Jun 28" },
  { id: "g5", personId: "p3", title: "Own the growth experimentation framework", description: "Design and ship the internal A/B testing library.", progress: 45, status: "active", dueDate: "Aug 20" },
  { id: "g6", personId: "p8", title: "Ship first production feature", description: "Lead the redesign of the signup analytics dashboard.", progress: 30, status: "active", dueDate: "Aug 5" },
  { id: "g7", personId: "p10", title: "Publish architecture RFC on event bus", description: "Draft, review, and land the RFC with cross-team sign-off.", progress: 55, status: "active", dueDate: "Jul 25" },
];

export const reviews: Review[] = [
  { id: "r1", personId: "p1", type: "self", week: "Week 27", wins: "Landed the ingestion retry logic. Unblocked the data team.", challenges: "Context switching between infra work and mentoring.", learning: "Deeper understanding of backpressure patterns.", feedback: "Would like more focused deep-work time.", rating: 4 },
  { id: "r2", personId: "p1", type: "manager", week: "Week 27", wins: "Consistently high-quality PRs. Great mentorship of Nora.", challenges: "Could delegate more of the on-call rotation.", learning: "-", feedback: "Excellent staff-level judgement this cycle.", rating: 5 },
  { id: "r3", personId: "p5", type: "self", week: "Week 27", wins: "API v2 rollout is ahead of schedule.", challenges: "Docs are lagging behind implementation.", learning: "Better appreciation for API versioning trade-offs.", feedback: "Need a technical writer partnership.", rating: 4 },
  { id: "r4", personId: "p3", type: "self", week: "Week 27", wins: "Growth framework spec approved.", challenges: "Blocked twice this week on infra dependencies.", learning: "How to write clearer async design docs.", feedback: "Would love more platform team pairing time.", rating: 3 },
];

export const recognitions: Recognition[] = [
  { id: "n1", recipientId: "p5", authorId: "p2", title: "Went above and beyond on the API v2 launch", note: "Yuki's calm ownership through the rollout set the bar for the team.", createdAt: "1h ago" },
  { id: "n2", recipientId: "p1", authorId: "p10", title: "Thoughtful architecture review", note: "Ava's feedback on the event bus RFC was the sharpest input we got.", createdAt: "3h ago" },
  { id: "n3", recipientId: "p6", authorId: "p4", title: "Closed the reconciliation project cleanly", createdAt: "yesterday" },
  { id: "n4", recipientId: "p8", authorId: "p3", title: "Great first design doc", note: "Kai wrote a crisp, opinionated proposal in his second week.", createdAt: "yesterday" },
  { id: "n5", recipientId: "p10", authorId: "p2", title: "Set the standard for RFC quality", createdAt: "2d ago" },
  { id: "n6", recipientId: "p7", authorId: "p1", title: "Excellent mentee, excellent engineer", note: "Nora's data pipeline work has been consistently strong.", createdAt: "3d ago" },
  { id: "n7", recipientId: "p2", authorId: "p10", title: "Steady leadership through a hard week", createdAt: "3d ago" },
];

export const checkInTrend = [
  { day: "Mon", rate: 82 }, { day: "Tue", rate: 88 }, { day: "Wed", rate: 91 },
  { day: "Thu", rate: 86 }, { day: "Fri", rate: 94 }, { day: "Sat", rate: 41 }, { day: "Sun", rate: 38 },
];

export const weeklyPerformance = [
  { week: "W22", score: 78 }, { week: "W23", score: 81 }, { week: "W24", score: 83 },
  { week: "W25", score: 82 }, { week: "W26", score: 86 }, { week: "W27", score: 89 },
];

export const goalProgress = [
  { name: "On track", value: 18 }, { name: "At risk", value: 4 }, { name: "Blocked", value: 2 }, { name: "Completed", value: 9 },
];

export const currentUserId = "p10";

export const statusLabel = (s: Status) => s === "on_track" ? "On track" : s === "blocked" ? "Blocked" : "Completed";
