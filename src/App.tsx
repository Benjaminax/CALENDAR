import React, { useState, useMemo, useRef, useEffect, FormEvent } from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";

// ============================================================================
// Types & Domain Models
// ============================================================================

export type Role = "Student" | "Teacher" | "Admin";
type Status = "idle" | "loading";

export type Programme = "CS" | "CE" | "EE" | "ME" | "BA";
export type AcademicLevel = "100" | "200" | "300" | "400";
export type IntakeCohort = "Cohort 1 (Sept)" | "Cohort 2 (Jan)" | "Both";
type Level100Cohort = Exclude<IntakeCohort, "Both">;
export type StudentGroup = "Group A" | "Group B" | "All";

const level100CohortOptions: Level100Cohort[] = ["Cohort 1 (Sept)", "Cohort 2 (Jan)"];

export interface FacultyMember {
  id: string;
  name: string;
  department: string;
  email: string;
  confirmed: boolean;
  confirmedAt: string | null;
  loadHours: number;
  unavailability: { day: number; slot: number; reason: string }[];
  saturdayOptIn?: boolean;
}

export interface TimetableEvent {
  id: string;
  code: string;
  title: string;
  person: string;
  room: string;
  day: number; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat
  start: number; // 0 to 8
  span: number; // 1, 2, or 3
  major: Programme | "ALL";
  level: AcademicLevel;
  semester: 1 | 2;
  group?: "Group A" | "Group B" | "All";
  cohort?: "Cohort 1 (Sept)" | "Cohort 2 (Jan)" | "Both";
  onlineMeeting?: boolean;
  type: "Lecture" | "Practical" | "Workshop" | "Tutorial";
}

export interface RoomFacility {
  code: string;
  building: string;
  capacity: number;
  type: "Lab" | "Lecture" | "Auditorium" | "Hall";
  features: string;
  status: "Available" | "In use" | "Maintenance";
}

export interface CourseData {
  code: string;
  title: string;
  department: string;
  credits: number;
  lectureHours: number;
  labHours: number;
  weeklySessionHours?: number[];
  electiveTrack?: string;
  electiveSemester?: 1 | 2;
  enrollment: number;
  faculty: string;
  requiresSplit: boolean;
  groupAllocation?: string;
  examPaperStatus: "Draft" | "Submitted" | "Vetted by HOD" | "Approved for Printing";
  prerequisites?: string[];
}

export interface ExamEntry {
  id: string;
  code: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  normalCapacity: number;
  socialDistancingCapacity: number; // 50% density rule
  invigilators: string[];
  studentDesk?: string;
  level: AcademicLevel;
  major: Programme | "ALL";
}

// ============================================================================
// Constants & University Baseline Data
// ============================================================================

const weekDays5 = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const weekDays6 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ONLINE_MEETING_ROOM = "Online Meeting";

const timeSlots = [
  "08:00 - 09:00",
  "09:10 - 10:10",
  "10:20 - 11:20",
  "11:30 - 12:30",
  "12:40 - 13:40",
  "13:50 - 14:50",
  "15:00 - 16:00",
  "16:10 - 17:10",
  "17:20 - 18:20",
];

const ghanaHolidays = [
  { name: "Independence Day", date: "06 Mar 2026", day: "Friday", type: "Statutory" },
  { name: "Eid al-Fitr", date: "31 Mar 2026", day: "Tuesday", type: "Religious" },
  { name: "Good Friday", date: "18 Apr 2026", day: "Friday", type: "Statutory" },
  { name: "Easter Monday", date: "21 Apr 2026", day: "Monday", type: "Statutory" },
  { name: "Workers' Day (May Day)", date: "01 May 2026", day: "Friday", type: "Statutory" },
  { name: "African Union Day", date: "25 May 2026", day: "Monday", type: "Commemorative" },
];

const initialFaculty: FacultyMember[] = [
  {
    id: "kc",
    name: "Kwesi Crankson",
    department: "Informatics & Computer Science",
    email: "k.crankson@acity.edu.gh",
    confirmed: true,
    confirmedAt: "18 Feb 2026, 14:20",
    loadHours: 12,
    unavailability: [{ day: 4, slot: 6, reason: "Curriculum Committee" }],
  },
  {
    id: "go",
    name: "Dr. Grace Oletu",
    department: "Cyber Security & Networks",
    email: "g.oletu@acity.edu.gh",
    confirmed: true,
    confirmedAt: "17 Feb 2026, 09:15",
    loadHours: 14,
    unavailability: [],
  },
  {
    id: "py",
    name: "Dr. Peter Yamak",
    department: "Artificial Intelligence & Robotics",
    email: "p.yamak@acity.edu.gh",
    confirmed: true,
    confirmedAt: "18 Feb 2026, 11:30",
    loadHours: 15,
    unavailability: [{ day: 2, slot: 5, reason: "Robotics Research Lab" }],
  },
  {
    id: "jd",
    name: "Joseph Danso",
    department: "Software Engineering",
    email: "j.danso@acity.edu.gh",
    confirmed: true,
    confirmedAt: "16 Feb 2026, 16:40",
    loadHours: 10,
    unavailability: [],
  },
  {
    id: "fb",
    name: "Fredrick Boafo",
    department: "Mobile & Web Technologies",
    email: "f.boafo@acity.edu.gh",
    confirmed: false,
    confirmedAt: null,
    loadHours: 12,
    unavailability: [],
  },
  {
    id: "ra",
    name: "Roland Mawuli Awuku",
    department: "Network & Infrastructure",
    email: "r.awuku@acity.edu.gh",
    confirmed: true,
    confirmedAt: "18 Feb 2026, 10:05",
    loadHours: 14,
    unavailability: [],
  },
  {
    id: "pyan",
    name: "Prince Yanum",
    department: "Cloud & Distributed Systems",
    email: "p.yanum@acity.edu.gh",
    confirmed: true,
    confirmedAt: "18 Feb 2026, 15:50",
    loadHours: 12,
    unavailability: [],
  },
  {
    id: "at",
    name: "Anna Tetteh",
    department: "Professional Development & Careers",
    email: "a.tetteh@acity.edu.gh",
    confirmed: true,
    confirmedAt: "15 Feb 2026, 13:00",
    loadHours: 8,
    unavailability: [],
  },
  {
    id: "km",
    name: "Dr. K. Mensah",
    department: "Computational Sciences",
    email: "k.mensah@acity.edu.gh",
    confirmed: false,
    confirmedAt: null,
    loadHours: 10,
    unavailability: [{ day: 0, slot: 0, reason: "Dean's Council" }],
  },
  {
    id: "ea",
    name: "Dr. E. Adjei",
    department: "Data Analytics & Statistics",
    email: "e.adjei@acity.edu.gh",
    confirmed: false,
    confirmedAt: null,
    loadHours: 12,
    unavailability: [],
  },
];

const initialRooms: RoomFacility[] = [
  {
    code: "Computer Lab 1",
    building: "Computing Centre",
    capacity: 50,
    type: "Lab",
    features: "50 high-performance workstations, Dual 4K Projectors, UPS",
    status: "In use",
  },
  {
    code: "Computer Lab 2",
    building: "Computing Centre",
    capacity: 50,
    type: "Lab",
    features: "50 workstations, GPU Computing node, Dual Displays",
    status: "Available",
  },
  {
    code: "L1",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, Whiteboard",
    status: "Available",
  },
  {
    code: "L2",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, Whiteboard",
    status: "Available",
  },
  {
    code: "L3",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, Audio system, Whiteboard",
    status: "In use",
  },
  {
    code: "L4",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Dual screens, Whiteboard, Hybrid mic",
    status: "In use",
  },
  {
    code: "L5",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, Lapel mic, Tiered desks",
    status: "Available",
  },
  {
    code: "L6",
    building: "Lecture Block",
    capacity: 65,
    type: "Lecture",
    features: "65-seat tiered seating, Lecture capture recording",
    status: "In use",
  },
  {
    code: "L7",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, Whiteboard",
    status: "Available",
  },
  {
    code: "L8",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Dual AV, Full room speakers",
    status: "In use",
  },
  {
    code: "L9",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, Whiteboard",
    status: "Available",
  },
  {
    code: "L10",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, AC",
    status: "In use",
  },
  {
    code: "L11",
    building: "Lecture Block",
    capacity: 45,
    type: "Lecture",
    features: "45-seat lecture room, Projector, Whiteboard, Movable seminar chairs",
    status: "Available",
  },
  {
    code: "L12",
    building: "Lecture Block",
    capacity: 65,
    type: "Lecture",
    features: "65-seat lecture room, Tiered seating, Lecture capture",
    status: "Available",
  },
  {
    code: "U2",
    building: "University Block",
    capacity: 50,
    type: "Lecture",
    features: "AV system, Whiteboard, Ergonomic desks",
    status: "In use",
  },
  {
    code: "U3",
    building: "University Block",
    capacity: 50,
    type: "Lecture",
    features: "AV system, Whiteboard",
    status: "Maintenance",
  },
  {
    code: "A1",
    building: "Main Academic Complex",
    capacity: 80,
    type: "Auditorium",
    features: "80 seats, Acoustic wall panels, Stage, Dual wireless microphones",
    status: "In use",
  },
  {
    code: "A2",
    building: "Main Academic Complex",
    capacity: 80,
    type: "Auditorium",
    features: "80 seats, Stage, Dual wireless microphones",
    status: "Available",
  },
  {
    code: "A3",
    building: "Main Academic Complex",
    capacity: 80,
    type: "Lecture",
    features: "80 seats, Tiered seating, HD streaming setup, Whiteboard",
    status: "Available",
  },
  {
    code: "Main Hall",
    building: "Central Campus",
    capacity: 350,
    type: "Hall",
    features: "350 seating, Central AV soundstage, Fully accessible",
    status: "Available",
  },
  {
    code: "Robotics Lab",
    building: "Engineering Block",
    capacity: 50,
    type: "Lab",
    features: "50 seats, Robotics workbenches, 3D printers, Oscilloscopes",
    status: "In use",
  },
  {
    code: "Embedded Systems Lab",
    building: "Engineering Block",
    capacity: 50,
    type: "Lab",
    features: "50 workstations, Embedded systems kits, Oscilloscopes",
    status: "Available",
  },
  {
    code: "Biomedical Lab",
    building: "Health Sciences Block",
    capacity: 40,
    type: "Lab",
    features: "40 seats, Biomedical instrumentation",
    status: "Available",
  },
  {
    code: "Data Science Lab",
    building: "Computing Centre",
    capacity: 30,
    type: "Lab",
    features: "30 workstations, Data analysis software",
    status: "Available",
  },
  {
    code: "Media Lab",
    building: "Media Centre",
    capacity: 20,
    type: "Lab",
    features: "20 workstations, Audio and video production equipment",
    status: "Available",
  },
];

// Baseline master timetable matching official Academic City sheet
const initialMasterEvents: TimetableEvent[] = [
  // Monday
  {
    id: "ev-1",
    code: "CS4134",
    title: "Human-Computer Interaction",
    person: "Kwesi Crankson",
    room: "Computer Lab 1",
    day: 0,
    start: 0,
    span: 3, // 08:00 - 11:20
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Practical",
  },
  {
    id: "ev-2",
    code: "CW400",
    title: "Career Workshop",
    person: "Anna Tetteh",
    room: "A1",
    day: 0,
    start: 3,
    span: 2, // 11:30 - 13:40
    major: "CS",
    level: "400",
    semester: 2,
    group: "Group A",
    cohort: "Both",
    type: "Workshop",
  },
  {
    id: "ev-3",
    code: "AI3128/CS4232",
    title: "Machine Learning and Data Mining/Machine Learning (Practical Session)",
    person: "Dr. Peter Yamak",
    room: "U2",
    day: 0,
    start: 7,
    span: 2, // 16:10 - 18:20
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Practical",
  },

  // Tuesday
  {
    id: "ev-4",
    code: "AI4136/CE/CS/IT4135",
    title: "Computer Security (Practical Session) - Group A",
    person: "Dr. Grace Oletu",
    room: "Computer Lab 1",
    day: 1,
    start: 1,
    span: 2, // 09:10 - 11:20
    major: "CS",
    level: "400",
    semester: 2,
    group: "Group A",
    cohort: "Both",
    type: "Practical",
  },
  {
    id: "ev-5",
    code: "CS4134",
    title: "Human-Computer Interaction",
    person: "Kwesi Crankson",
    room: "L3",
    day: 1,
    start: 3,
    span: 2, // 11:30 - 13:40
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "ev-6",
    code: "CS4140",
    title: "Cryptography and Network Security",
    person: "Roland Mawuli Awuku",
    room: "L4",
    day: 1,
    start: 5,
    span: 2, // 13:50 - 16:00
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "ev-7",
    code: "RE2141/CS4129 (Elective)",
    title: "Artificial Intelligence and Robotics/Introduction to Robotics (Practical Session)",
    person: "Dr. Peter Yamak",
    room: "L6",
    day: 1,
    start: 7,
    span: 2, // 16:10 - 18:20
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Practical",
  },

  // Wednesday
  {
    id: "ev-8",
    code: "AI4125/CS4138",
    title: "Computational Neural Networks/Neural Networks (Theory Session)",
    person: "Dr. Peter Yamak",
    room: "L8",
    day: 2,
    start: 0,
    span: 2, // 08:00 - 10:10
    major: "CS",
    level: "400",
    semester: 2,
    group: "Group B",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "ev-9",
    code: "RE2141/CS4129 (Elective)",
    title: "Artificial Intelligence and Robotics/Introduction to Robotics (Theory Session)",
    person: "Dr. Peter Yamak",
    room: "A3",
    day: 2,
    start: 2,
    span: 1, // 10:20 - 11:20
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "ev-10",
    code: "CS4132",
    title: "Mobile Application Development",
    person: "Fredrick Boafo",
    room: "L5",
    day: 2,
    start: 3,
    span: 2, // 11:30 - 13:40
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },

  // Thursday
  {
    id: "ev-11",
    code: "AI/CS/IT4192",
    title: "Project Phase I",
    person: "Joseph Danso",
    room: "Computer Lab 2",
    day: 3,
    start: 0,
    span: 2, // 08:00 - 10:10
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Practical",
  },
  {
    id: "ev-12",
    code: "CS4140",
    title: "Cryptography and Network Security",
    person: "Roland Mawuli Awuku",
    room: "L10",
    day: 3,
    start: 3,
    span: 2, // 11:30 - 13:40
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "ev-13",
    code: "AI4136/CE/CS/IT4135",
    title: "Computer Security (Theory Session) - Group A",
    person: "Dr. Grace Oletu",
    room: "U3",
    day: 3,
    start: 5,
    span: 2, // 13:50 - 16:00
    major: "CS",
    level: "400",
    semester: 2,
    group: "Group A",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "ev-14",
    code: "CS/IT4131",
    title: "Cloud Application (Elective)",
    person: "Prince Yanum",
    room: "U3",
    day: 3,
    start: 7,
    span: 2, // 16:10 - 18:20
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },

  // Friday
  {
    id: "ev-15",
    code: "CS4132",
    title: "Mobile Application Development",
    person: "Fredrick Boafo",
    room: "Computer Lab 1",
    day: 4,
    start: 1,
    span: 2, // 09:10 - 11:20
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Practical",
  },
  {
    id: "ev-16",
    code: "AI4125/CS4138",
    title: "Computational Neural Networks/Neural Networks (Practical Session)",
    person: "Dr. Peter Yamak",
    room: "L10",
    day: 4,
    start: 3,
    span: 2, // 11:30 - 13:40
    major: "CS",
    level: "400",
    semester: 2,
    group: "Group B",
    cohort: "Both",
    type: "Practical",
  },
  {
    id: "ev-17",
    code: "CS/IT4131",
    title: "Cloud Application (Elective)",
    person: "Prince Yanum",
    room: "L11",
    day: 4,
    start: 5,
    span: 2, // 13:50 - 16:00
    major: "CS",
    level: "400",
    semester: 2,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },
];

const initialCourses: CourseData[] = [
  {
    code: "CS 201",
    title: "Object-Oriented Programming Fundamentals",
    department: "Computer Science",
    credits: 3,
    lectureHours: 2,
    labHours: 2,
    enrollment: 84, // >= 60 threshold
    faculty: "Joseph Danso",
    requiresSplit: true,
    groupAllocation: "Group A (CS - 44) & Group B (CE/IT - 40)",
    examPaperStatus: "Approved for Printing",
  },
  {
    code: "CS 4134",
    title: "Human-Computer Interaction",
    department: "Computer Science",
    credits: 3,
    lectureHours: 2,
    labHours: 2,
    enrollment: 52,
    faculty: "Kwesi Crankson",
    requiresSplit: false,
    groupAllocation: "Single Group",
    examPaperStatus: "Vetted by HOD",
  },
  {
    code: "AI 4125",
    title: "Computational Neural Networks",
    department: "Artificial Intelligence",
    credits: 4,
    lectureHours: 2,
    labHours: 2,
    enrollment: 78,
    faculty: "Dr. Peter Yamak",
    requiresSplit: true,
    groupAllocation: "Group A (AI - 42) & Group B (CS - 36)",
    examPaperStatus: "Submitted",
  },
  {
    code: "CS 4140",
    title: "Cryptography and Network Security",
    department: "Informatics",
    credits: 3,
    lectureHours: 3,
    labHours: 0,
    enrollment: 58,
    faculty: "Roland Mawuli Awuku",
    requiresSplit: false,
    groupAllocation: "Single Group",
    examPaperStatus: "Vetted by HOD",
  },
  {
    code: "CS 4132",
    title: "Mobile Application Development",
    department: "Informatics",
    credits: 3,
    lectureHours: 2,
    labHours: 2,
    enrollment: 56,
    faculty: "Fredrick Boafo",
    requiresSplit: false,
    groupAllocation: "Single Group",
    examPaperStatus: "Draft",
  },
  {
    code: "CS/IT 4131",
    title: "Cloud Application Development (Elective)",
    department: "Informatics",
    credits: 3,
    lectureHours: 2,
    labHours: 2,
    enrollment: 38,
    faculty: "Prince Yanum",
    requiresSplit: false,
    groupAllocation: "Single Group",
    examPaperStatus: "Approved for Printing",
    prerequisites: ["CS 301"],
  },
  {
    code: "AI 412",
    title: "Artificial Intelligence and Robotics (Elective)",
    department: "Artificial Intelligence",
    credits: 3,
    lectureHours: 2,
    labHours: 2,
    enrollment: 34,
    faculty: "Dr. Peter Yamak",
    requiresSplit: false,
    groupAllocation: "Single Group",
    examPaperStatus: "Approved for Printing",
    prerequisites: ["CS 201", "MATH 201"],
  },
  {
    code: "CS 425",
    title: "Distributed Systems & Cloud Computing (Elective)",
    department: "Computer Science",
    credits: 3,
    lectureHours: 3,
    labHours: 0,
    enrollment: 28,
    faculty: "Dr. E. Adjei",
    requiresSplit: false,
    groupAllocation: "Single Group",
    examPaperStatus: "Draft",
    prerequisites: ["CS 310"], // Kofi has not taken CS310
  },
];

const departmentOptions = Array.from(
  new Set([
    ...initialFaculty.map((member) => member.department),
    ...initialCourses.map((course) => course.department),
  ]),
).sort((a, b) => a.localeCompare(b));

type ScheduleSuggestion = {
  day: number;
  slot: number;
  roomCode: string;
};

function getScheduleSuggestionKey(suggestion: ScheduleSuggestion) {
  return JSON.stringify([suggestion.day, suggestion.slot, suggestion.roomCode]);
}

function getScheduleSuggestionTimeLabel(suggestion: ScheduleSuggestion, span = 1) {
  const endSlot = Math.min(suggestion.slot + Math.max(1, span) - 1, timeSlots.length - 1);
  const startTime = timeSlots[suggestion.slot].split(" - ")[0];
  const endTime = timeSlots[endSlot].split(" - ")[1];
  const periods =
    endSlot === suggestion.slot
      ? `P${suggestion.slot + 1}`
      : `P${suggestion.slot + 1}-P${endSlot + 1}`;
  return `${periods} (${startTime} - ${endTime})`;
}

function getScheduleSuggestionLabel(
  suggestion: ScheduleSuggestion,
  rooms: RoomFacility[],
  span = 1,
) {
  const room = rooms.find((item) => item.code === suggestion.roomCode);
  const roomLabel = room
    ? `${room.code} · ${room.capacity} seats`
    : `${suggestion.roomCode} · Virtual`;
  return `${weekDays6[suggestion.day]} · ${getScheduleSuggestionTimeLabel(suggestion, span)} · ${roomLabel}`;
}

function normalizeCourseIdentifier(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getCourseWeeklySessions(course: CourseData) {
  return (
    course.weeklySessionHours ?? [course.lectureHours, course.labHours].filter((hours) => hours > 0)
  );
}

function eventMatchesCourse(event: TimetableEvent, course: CourseData) {
  const eventCode = normalizeCourseIdentifier(event.code);
  const courseCode = normalizeCourseIdentifier(course.code);
  if (courseCode.length >= 6 && eventCode.includes(courseCode)) return true;

  const eventTitle = normalizeCourseIdentifier(event.title);
  const courseTitle = normalizeCourseIdentifier(course.title.replace(/\s*\(Elective\)/i, ""));
  return courseTitle.length >= 6 && eventTitle.includes(courseTitle);
}

function getElectiveCourseForEvent(event: TimetableEvent, courses: CourseData[]) {
  return courses.find(
    (course) => /\(Elective\)/i.test(course.title) && eventMatchesCourse(event, course),
  );
}

function getScheduledElectiveCourses(events: TimetableEvent[], courses: CourseData[]) {
  return courses.filter(
    (course) =>
      /\(Elective\)/i.test(course.title) &&
      events.some((event) => eventMatchesCourse(event, course)),
  );
}

function findCourseForEvent(event: TimetableEvent, courses: CourseData[]) {
  const eventCode = normalizeCourseIdentifier(event.code);
  return courses.find((course) => {
    const courseCode = normalizeCourseIdentifier(course.code);
    return courseCode.length >= 6 && (eventCode === courseCode || eventCode.includes(courseCode));
  });
}

function getAssignedGroupForMajor(
  course: CourseData,
  major: Programme,
): Exclude<StudentGroup, "All"> | undefined {
  if (!course.requiresSplit) return undefined;

  const allocations = course.groupAllocation?.match(/Group [AB] \([^)]*\)/g) ?? [];
  let hasInterMajorAllocation = false;

  for (const allocation of allocations) {
    const match = allocation.match(/^Group ([AB]) \(([^)]*)\)$/);
    if (!match) continue;

    const allocationLabel = match[2].split(" - ")[0].trim();
    if (allocationLabel.toLowerCase() === "inter-major") {
      hasInterMajorAllocation = true;
      continue;
    }

    if (
      allocationLabel
        .split(/[\/,]/)
        .map((allocatedMajor) => allocatedMajor.trim().toUpperCase())
        .includes(major)
    ) {
      return match[1] === "A" ? "Group A" : "Group B";
    }
  }

  return hasInterMajorAllocation ? "Group B" : undefined;
}

function getClassRequiredCapacity(
  event: TimetableEvent,
  courses: CourseData[],
  capacityOverride?: number,
) {
  if (capacityOverride !== undefined) return capacityOverride;

  const matchingCourse = findCourseForEvent(event, courses);

  if (!matchingCourse) return 45;
  if (!matchingCourse.requiresSplit) return matchingCourse.enrollment;

  const isGroupB = event.group === "Group B" || /Group B/i.test(event.title);
  return isGroupB
    ? Math.floor(matchingCourse.enrollment * 0.45)
    : Math.ceil(matchingCourse.enrollment * 0.55);
}

function getAvailableScheduleSuggestions({
  event,
  events,
  rooms,
  courses,
  facultyMember,
  days,
  capacityOverride,
  includeOnline = true,
}: {
  event: TimetableEvent;
  events: TimetableEvent[];
  rooms: RoomFacility[];
  courses: CourseData[];
  facultyMember?: FacultyMember;
  days: number[];
  capacityOverride?: number;
  includeOnline?: boolean;
}): ScheduleSuggestion[] {
  const span = event.span || 1;
  const requiredCapacity = getClassRequiredCapacity(event, courses, capacityOverride);
  const suitableRooms = rooms.filter((room) => {
    if (room.status === "Maintenance" || room.capacity < requiredCapacity) return false;
    if (event.type === "Practical") {
      return room.type === "Lab";
    }
    return room.type !== "Lab";
  });
  const suggestions: ScheduleSuggestion[] = [];

  for (const day of days) {
    for (let slot = 0; slot + span <= timeSlots.length; slot++) {
      const end = slot + span;
      const unavailable =
        facultyMember?.unavailability.some(
          (block) => block.day === day && block.slot >= slot && block.slot < end,
        ) ?? false;
      if (unavailable) continue;

      const hasLecturerConflict =
        Boolean(event.person) &&
        events.some(
          (other) =>
            other.id !== event.id &&
            other.person === event.person &&
            other.day === day &&
            Math.max(other.start, slot) < Math.min(other.start + (other.span || 1), end),
        );
      if (hasLecturerConflict) continue;

      for (const room of suitableRooms) {
        const hasRoomConflict = events.some(
          (other) =>
            other.id !== event.id &&
            !other.onlineMeeting &&
            other.day === day &&
            other.room === room.code &&
            Math.max(other.start, slot) < Math.min(other.start + (other.span || 1), end),
        );
        if (!hasRoomConflict) suggestions.push({ day, slot, roomCode: room.code });
      }

      if (includeOnline) suggestions.push({ day, slot, roomCode: ONLINE_MEETING_ROOM });
    }
  }

  return suggestions;
}

const initialExams: ExamEntry[] = [
  {
    id: "ex-1",
    code: "CS 4134",
    title: "Human-Computer Interaction",
    date: "03 MAR 2026",
    time: "09:00 – 11:00",
    venue: "Main Hall",
    normalCapacity: 350,
    socialDistancingCapacity: 175,
    invigilators: ["Kwesi Crankson", "Anna Tetteh"],
    studentDesk: "Desk 118",
    level: "400",
    major: "CS",
  },
  {
    id: "ex-2",
    code: "CS 4140",
    title: "Cryptography and Network Security",
    date: "05 MAR 2026",
    time: "13:00 – 15:00",
    venue: "Robotics Lab",
    normalCapacity: 50,
    socialDistancingCapacity: 25,
    invigilators: ["Roland Mawuli Awuku", "Joseph Danso"],
    studentDesk: "Desk 42",
    level: "400",
    major: "CS",
  },
  {
    id: "ex-3",
    code: "AI 4125",
    title: "Computational Neural Networks",
    date: "10 MAR 2026",
    time: "09:00 – 11:00",
    venue: "Main Hall",
    normalCapacity: 350,
    socialDistancingCapacity: 175,
    invigilators: ["Dr. Peter Yamak", "Dr. Grace Oletu"],
    studentDesk: "Desk 204",
    level: "400",
    major: "CS",
  },
  {
    id: "ex-4",
    code: "CS 4132",
    title: "Mobile Application Development",
    date: "13 MAR 2026",
    time: "13:00 – 15:00",
    venue: "A1 Auditorium",
    normalCapacity: 80,
    socialDistancingCapacity: 40,
    invigilators: ["Fredrick Boafo", "Prince Yanum"],
    studentDesk: "Desk 76",
    level: "400",
    major: "CS",
  },
];

// Demo accounts for rapid login
type DemoAccount = {
  role: Role;
  name: string;
  email: string;
  detail: string;
  major?: Programme;
  level?: AcademicLevel;
  track?: string;
  electives?: string[];
};

type ElectiveTrack = {
  name: string;
  semester1: string[];
  semester2: string[];
};

const initialElectiveTracks: ElectiveTrack[] = [
  {
    name: "Data Processing and Networks",
    semester1: ["CS 4140", "CS 4138"],
    semester2: ["CS 4237", "CS 4239"],
  },
  {
    name: "Modern Computing and Programming",
    semester1: ["CS 4137", "CS 4139"],
    semester2: ["CS 4235", "CS 4236"],
  },
  {
    name: "Advanced and Emerging Technologies",
    semester1: ["CS 4144", "CS 4129"],
    semester2: ["CS 4231", "CS 4232"],
  },
  {
    name: "Computational Sciences and Data Analytics",
    semester1: ["CS 4130", "CS 4131"],
    semester2: ["CS 4231", "CS 4232"],
  },
];

const createElectiveTrackOption = "__create_new_elective_track__";

const trackElectiveCatalog = [
  { code: "CS 4140", title: "Cryptography and Network Security", faculty: "Roland Mawuli Awuku" },
  { code: "CS 4138", title: "Neural Networks", faculty: "Dr. Peter Yamak" },
  { code: "CS 4237", title: "Data Mining and Warehousing", faculty: "Dr. E. Adjei" },
  { code: "CS 4239", title: "TCP/IP Design and Implementation", faculty: "Roland Mawuli Awuku" },
  { code: "CS 4137", title: "E-Business", faculty: "Prince Yanum" },
  { code: "CS 4139", title: "Programming in ASP.NET", faculty: "Joseph Danso" },
  { code: "CS 4235", title: "Advanced Java Programming", faculty: "Joseph Danso" },
  { code: "CS 4236", title: "Cloud Computing", faculty: "Prince Yanum" },
  { code: "CS 4144", title: "Embedded Systems", faculty: "Dr. K. Mensah" },
  { code: "CS 4129", title: "Introduction to Robotics", faculty: "Dr. Peter Yamak" },
  { code: "CS 4231", title: "Internet of Things (IoT)", faculty: "Dr. K. Mensah" },
  { code: "CS 4232", title: "Machine Learning", faculty: "Dr. Peter Yamak" },
  { code: "CS 4130", title: "Business Intelligence", faculty: "Dr. E. Adjei" },
  { code: "CS 4131", title: "Cloud Application", faculty: "Prince Yanum" },
];

const trackElectiveCourses: CourseData[] = trackElectiveCatalog.map((course) => ({
  ...course,
  title: `${course.title} (Elective)`,
  department: "Computer Science",
  credits: 3,
  lectureHours: 2,
  labHours: 0,
  enrollment: 32,
  requiresSplit: false,
  groupAllocation: "Single Group",
  examPaperStatus: "Draft",
}));

function getTrackElectiveEvents(
  track: ElectiveTrack,
  electiveCourses: CourseData[],
  tracks: ElectiveTrack[],
  existingEvents: TimetableEvent[],
): { events: TimetableEvent[]; unscheduledCourseCodes: string[] } {
  type ScheduleGroup = {
    code: string;
    semester: 1 | 2;
    course: CourseData;
    tracks: Set<string>;
    trackIndex: number;
    courseIndex: number;
  };
  type ScheduledBlock = {
    group: ScheduleGroup;
    sessionIndex: number;
    day: number;
    start: number;
    span: number;
    room: string;
  };

  const scheduleGroups = new Map<string, ScheduleGroup>();
  tracks.forEach((electiveTrack, trackIndex) => {
    ([1, 2] as const).forEach((semester) => {
      const courseCodes = semester === 1 ? electiveTrack.semester1 : electiveTrack.semester2;
      courseCodes.forEach((code, courseIndex) => {
        const course = electiveCourses.find(
          (item) =>
            normalizeCourseIdentifier(item.code) === normalizeCourseIdentifier(code) &&
            (item.electiveTrack === undefined || item.electiveTrack === electiveTrack.name),
        );
        if (!course) return;

        const key = `${semester}-${normalizeCourseIdentifier(code)}`;
        const existingGroup = scheduleGroups.get(key);
        if (existingGroup) {
          existingGroup.tracks.add(electiveTrack.name);
        } else {
          scheduleGroups.set(key, {
            code,
            semester,
            course,
            tracks: new Set([electiveTrack.name]),
            trackIndex,
            courseIndex,
          });
        }
      });
    });
  });

  const matchingCourses = [...initialCourses, ...electiveCourses];
  const coreEvents = [...existingEvents, ...trackCoreEventsSemester1].filter(
    (event) =>
      (event.major === "CS" || event.major === "ALL") &&
      event.level === "400" &&
      getElectiveCourseForEvent(event, matchingCourses) === undefined,
  );
  const lectureRooms = initialRooms.filter(
    (room) => room.type !== "Lab" && room.status !== "Maintenance",
  );
  const scheduledBlocks: ScheduledBlock[] = [];
  const unscheduledCourseCodes = new Set<string>();

  const overlaps = (day: number, start: number, span: number, event: TimetableEvent) =>
    event.day === day &&
    Math.max(start, event.start) < Math.min(start + span, event.start + (event.span || 1));

  for (const [groupIndex, group] of Array.from(scheduleGroups.values()).entries()) {
    const sessions = getCourseWeeklySessions(group.course);
    for (const [sessionIndex, span] of sessions.entries()) {
      const maxStart = timeSlots.length - span;
      if (span < 1 || maxStart < 0 || lectureRooms.length === 0) {
        unscheduledCourseCodes.add(`${group.code} · Semester ${group.semester}`);
        continue;
      }

      const baseDay = group.trackIndex % 3;
      const preferredDay = (baseDay + group.courseIndex * 2 + sessionIndex) % 5;
      const preferredStart = Math.min(
        5 + ((group.trackIndex + group.courseIndex + sessionIndex) % 3),
        maxStart,
      );
      let placement: ScheduledBlock | undefined;

      for (let dayOffset = 0; dayOffset < 5 && !placement; dayOffset++) {
        const day = (preferredDay + dayOffset) % 5;
        for (let startOffset = 0; startOffset <= maxStart && !placement; startOffset++) {
          const start = (preferredStart + startOffset) % (maxStart + 1);
          if (scheduledBlocks.some((block) => block.group === group && block.day === day)) {
            continue;
          }

          const coreConflict = coreEvents.some(
            (event) => event.semester === group.semester && overlaps(day, start, span, event),
          );
          if (coreConflict) continue;

          const lecturerConflict = existingEvents.some(
            (event) =>
              event.semester === group.semester &&
              event.person.trim().toLowerCase() === group.course.faculty.trim().toLowerCase() &&
              overlaps(day, start, span, event),
          );
          if (lecturerConflict) continue;

          const courseConflict = scheduledBlocks.some((block) => {
            if (
              block.group.semester !== group.semester ||
              Math.max(start, block.start) >= Math.min(start + span, block.start + block.span)
            ) {
              return false;
            }

            const sharesTrack = Array.from(group.tracks).some((name) =>
              block.group.tracks.has(name),
            );
            const sameLecturer =
              block.group.course.faculty.trim().toLowerCase() ===
              group.course.faculty.trim().toLowerCase();
            return sharesTrack || sameLecturer;
          });
          if (courseConflict) continue;

          for (let roomOffset = 0; roomOffset < lectureRooms.length && !placement; roomOffset++) {
            const room = lectureRooms[(groupIndex + roomOffset) % lectureRooms.length].code;
            const roomConflict =
              scheduledBlocks.some(
                (block) =>
                  block.group.semester === group.semester &&
                  block.room === room &&
                  block.day === day &&
                  Math.max(start, block.start) < Math.min(start + span, block.start + block.span),
              ) ||
              existingEvents.some(
                (event) =>
                  event.semester === group.semester &&
                  !event.onlineMeeting &&
                  event.room === room &&
                  overlaps(day, start, span, event),
              );
            if (roomConflict) continue;

            placement = { group, sessionIndex, day, start, span, room };
          }
        }
      }

      if (placement) {
        scheduledBlocks.push(placement);
      } else {
        unscheduledCourseCodes.add(`${group.code} · Semester ${group.semester}`);
      }
    }
  }

  return {
    events: scheduledBlocks
      .filter((block) => block.group.tracks.has(track.name))
      .map(({ group, sessionIndex, day, start, span, room }) => ({
        id: `track-elective-${normalizeCourseIdentifier(group.code)}-${group.semester}-${sessionIndex}`,
        code: normalizeCourseIdentifier(group.code),
        title: `${group.course.title.replace(/\s*\(Elective\)$/i, "")} (Elective)`,
        person: group.course.faculty,
        room,
        day,
        start,
        span,
        major: "CS" as const,
        level: "400" as const,
        semester: group.semester,
        group: "All" as const,
        cohort: "Both" as const,
        type: "Lecture" as const,
      })),
    unscheduledCourseCodes: [...unscheduledCourseCodes],
  };
}

const trackCoreCourseCodes = ["CS4134", "CS4132", "AI/CS/IT4192"];

const trackCoreEventsSemester1: TimetableEvent[] = [
  {
    id: "demo-core-cs4134-sem1",
    code: "CS4134",
    title: "Human-Computer Interaction",
    person: "Kwesi Crankson",
    room: "L3",
    day: 0,
    start: 0,
    span: 2,
    major: "CS",
    level: "400",
    semester: 1,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "demo-core-cs4132-sem1",
    code: "CS4132",
    title: "Mobile Application Development",
    person: "Fredrick Boafo",
    room: "L5",
    day: 1,
    start: 3,
    span: 2,
    major: "CS",
    level: "400",
    semester: 1,
    group: "All",
    cohort: "Both",
    type: "Lecture",
  },
  {
    id: "demo-core-project-sem1",
    code: "AI/CS/IT4192",
    title: "Project Phase I",
    person: "Joseph Danso",
    room: "Computer Lab 2",
    day: 3,
    start: 0,
    span: 2,
    major: "CS",
    level: "400",
    semester: 1,
    group: "All",
    cohort: "Both",
    type: "Practical",
  },
];

const demos: DemoAccount[] = [
  {
    role: "Student" as Role,
    name: "Kofi Mensah",
    email: "student@acity.edu.gh",
    detail: "Level 400 · Computer Science · Cohort 1 (Sept)",
    major: "CS",
    level: "400",
    electives: [],
  },
  {
    role: "Student",
    name: "Ama Ofori",
    email: "student.electives@acity.edu.gh",
    detail: "Level 400 · Data Processing and Networks · 2 electives per semester",
    major: "CS",
    level: "400",
    track: "Data Processing and Networks",
  },
  {
    role: "Teacher" as Role,
    name: "Kwesi Crankson",
    email: "teacher@acity.edu.gh",
    detail: "Department of Informatics · Senior Lecturer",
  },
  {
    role: "Admin" as Role,
    name: "Academic Planning Office",
    email: "admin@acity.edu.gh",
    detail: "Timetable Administrator · Academic City University",
  },
];

// Helper: hugeicons render
function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <i className={`hgi-stroke hgi-${name} ${className}`} aria-hidden="true" />;
}

function UniversityLogo({
  compact = false,
  onDark = false,
  className = "",
}: {
  compact?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <img
      className={`university-logo ${compact ? "university-logo--compact" : ""} ${onDark ? "university-logo--on-dark" : ""} ${className}`.trim()}
      src={onDark ? "/academic-city-logo-on-dark.png" : "/academic-city-logo.png"}
      alt="Academic City University"
    />
  );
}

function PageHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="portal-heading page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

// ============================================================================
// Core Academic City Timetable Sheet Component
// Exact layout matching user attachments:
// 1px uniform black borders, crimson titles (#b02622), bold rooms, 9 periods
// ============================================================================

function WeeklyTimetableGrid({
  events,
  saturday = false,
  onEventClick,
}: {
  events: TimetableEvent[];
  saturday?: boolean;
  onEventClick?: (ev: TimetableEvent) => void;
}) {
  const days = saturday ? weekDays6 : weekDays5;
  const numDays = days.length;
  const visibleEvents = events.filter((event) => event.day < numDays);
  const eventLayouts = new Map<string, { lane: number; laneCount: number }>();
  const dayLaneCounts = Array.from({ length: numDays }, () => 1);

  for (let day = 0; day < numDays; day += 1) {
    const dayEvents = visibleEvents
      .filter((event) => event.day === day)
      .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    let cluster: TimetableEvent[] = [];
    let clusterEnd = -1;

    const assignClusterLanes = (overlappingEvents: TimetableEvent[]) => {
      const laneEnds: number[] = [];
      const assignments: { event: TimetableEvent; lane: number }[] = [];

      overlappingEvents.forEach((event) => {
        const lane = laneEnds.findIndex((end) => end <= event.start);
        const laneIndex = lane < 0 ? laneEnds.length : lane;
        laneEnds[laneIndex] = event.start + event.span;
        assignments.push({ event, lane: laneIndex });
      });

      assignments.forEach(({ event, lane }) => {
        eventLayouts.set(event.id, { lane, laneCount: laneEnds.length });
        dayLaneCounts[event.day] = Math.max(dayLaneCounts[event.day], laneEnds.length);
      });
    };

    dayEvents.forEach((event) => {
      if (cluster.length && event.start >= clusterEnd) {
        assignClusterLanes(cluster);
        cluster = [];
        clusterEnd = -1;
      }

      cluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.start + event.span);
    });

    if (cluster.length) assignClusterLanes(cluster);
  }

  return (
    <div className="timetable-scroll-wrapper">
      <div
        className={`timetable-grid ${saturday ? "has-saturday" : ""}`}
        style={{
          gridTemplateColumns: `92px ${dayLaneCounts.map((laneCount) => `minmax(${160 * laneCount}px, 1fr)`).join(" ")}`,
        }}
      >
        <div className="timetable-corner">Time</div>
        {days.map((label) => (
          <div className="day-head" key={label}>
            {label}
          </div>
        ))}

        {/* 9 Time Period Cells */}
        {timeSlots.map((time, index) => {
          const parts = time.split(" - ");
          return (
            <div className="time-cell" style={{ gridRow: index + 2 }} key={time}>
              <span>{parts[0]} -</span>
              <span>{parts[1]}</span>
            </div>
          );
        })}

        {/* Grid Background Matrix */}
        {timeSlots.flatMap((_, row) =>
          days.map((__, col) => (
            <div
              className="timetable-cell"
              key={`${row}-${col}`}
              style={{ gridColumn: col + 2, gridRow: row + 2 }}
            />
          )),
        )}

        {/* Scheduled Event Blocks */}
        {visibleEvents.map((event) => {
          const layout = eventLayouts.get(event.id) ?? { lane: 0, laneCount: 1 };
          return (
            <article
              className="timetable-event"
              key={event.id}
              onClick={() => onEventClick && onEventClick(event)}
              style={{
                gridColumn: event.day + 2,
                gridRow: `${event.start + 2} / span ${event.span || 1}`,
                width: `${100 / layout.laneCount}%`,
                marginLeft: `${(100 * layout.lane) / layout.laneCount}%`,
                boxShadow: layout.laneCount > 1 ? "inset -1px 0 #000" : undefined,
                cursor: onEventClick ? "pointer" : "default",
              }}
              title={onEventClick ? "Click to inspect or reschedule" : undefined}
            >
              <span className="event-course">
                {event.code} - {event.title}
              </span>
              {event.person && <span className="event-person">{event.person}</span>}
              {(event.onlineMeeting || event.room) && (
                <b className="event-room">
                  {event.onlineMeeting ? ONLINE_MEETING_ROOM : event.room}
                </b>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

async function downloadTimetablePng(element: HTMLElement, filename: string) {
  const grid = element.querySelector<HTMLElement>(".timetable-grid");
  if (!grid) {
    throw new Error("The timetable grid could not be found.");
  }

  await document.fonts.ready;

  const contentWidth = Math.ceil(Math.max(element.clientWidth, grid.scrollWidth));
  const sidePadding = 24;
  const width = contentWidth + sidePadding * 2;
  const host = document.createElement("div");
  const clone = element.cloneNode(true) as HTMLElement;
  const cloneGrid = clone.querySelector<HTMLElement>(".timetable-grid");
  const scrollWrapper = clone.querySelector<HTMLElement>(".timetable-scroll-wrapper");

  clone.classList.add("is-png-export");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    zIndex: "-1",
    pointerEvents: "none",
  });
  Object.assign(clone.style, {
    width: `${width}px`,
    padding: `${sidePadding}px`,
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    overflow: "visible",
  });
  if (cloneGrid) {
    cloneGrid.style.width = `${contentWidth}px`;
    cloneGrid.style.minWidth = `${contentWidth}px`;
  }
  if (scrollWrapper) {
    scrollWrapper.style.width = `${contentWidth}px`;
    scrollWrapper.style.overflow = "visible";
  }

  host.appendChild(clone);
  (element.parentElement ?? document.body).appendChild(host);

  try {
    const height = Math.ceil(clone.scrollHeight);
    const dataUrl = await toPng(clone, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 1,
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        overflow: "visible",
      },
    });
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } finally {
    host.remove();
  }
}

function TimetablePngButton({
  targetRef,
  filename,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  filename: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const target = targetRef.current;
    if (!target) {
      console.error("Could not export timetable PNG: timetable element is unavailable.");
      window.alert("The timetable PNG could not be created. Please try again.");
      return;
    }

    setIsExporting(true);
    try {
      await downloadTimetablePng(target, filename);
    } catch (error) {
      console.error("Failed to export timetable as PNG.", error);
      window.alert("The timetable PNG could not be created. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      className="timetable-print-btn"
      onClick={handleExport}
      disabled={isExporting}
      aria-busy={isExporting}
    >
      <Icon name="download-04" /> {isExporting ? "Creating PNG..." : "Download PNG"}
    </button>
  );
}

// ============================================================================
// Next Class Radar Widget
// ============================================================================

function NextClassRadar({
  role,
  facultyName = "Kwesi Crankson",
}: {
  role: "Student" | "Teacher";
  facultyName?: string;
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(2480); // ~41 mins

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((s) => (s > 0 ? s - 1 : 3600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;

  return (
    <aside className="next-class-card" aria-label="Next class countdown">
      <div className="next-class-indicator">
        <span className="live-dot" />
        <span>NEXT CLASS IN {timeFormatted}</span>
      </div>
      <div>
        <p className="eyebrow">
          {role === "Student" ? "TODAY · 08:00 – 11:20" : "NEXT TEACHING SESSION"}
        </p>
        <h2>CS4134 — Human-Computer Interaction</h2>
        <p className="subtitle">
          {role === "Student"
            ? "Practical Session · Computer Lab 1 · Kwesi Crankson"
            : "Practical Laboratory · 52 students · Computer Lab 1"}
        </p>
      </div>
      <div className="next-class-meta">
        <div>
          <span>VENUE</span>
          <strong>Computer Lab 1</strong>
        </div>
        <div>
          <span>ATTENDANCE</span>
          <strong>96% Expected</strong>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// Liquid Glass Bottom Navigation Bar
// Fully preserves the transparent liquid physics, spring motion & permanent expanded state
// ============================================================================

export type LiquidGlassItem = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
};

function LiquidGlassBottomBar({
  items,
  selectedIndex,
  onSelect,
}: {
  items: LiquidGlassItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    const updatePill = () => {
      if (!containerRef.current) return;
      const buttons =
        containerRef.current.querySelectorAll<HTMLButtonElement>(".liquid-glass__item");
      const activeBtn = buttons[selectedIndex];
      if (activeBtn) {
        setPillStyle({
          left: activeBtn.offsetLeft,
          width: activeBtn.offsetWidth,
          opacity: 1,
        });
      }
    };
    updatePill();
    const timeout = setTimeout(updatePill, 250);
    window.addEventListener("resize", updatePill);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updatePill);
    };
  }, [selectedIndex, items]);

  return (
    <nav className="liquid-glass-nav" aria-label="Portal Navigation">
      <div className="liquid-glass__container" ref={containerRef}>
        <div
          className="liquid-glass__slider"
          style={{
            transform: `translateX(${pillStyle.left}px)`,
            width: `${pillStyle.width}px`,
            opacity: pillStyle.opacity,
          }}
          aria-hidden="true"
        />
        {items.map((item, index) => {
          const isSelected = selectedIndex === index;
          return (
            <button
              key={item.id}
              type="button"
              className={`liquid-glass__item ${isSelected ? "liquid-glass__item--active" : ""}`}
              onClick={() => {
                onSelect(index);
                window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
              }}
              aria-current={isSelected ? "page" : undefined}
            >
              <div className="liquid-glass__icon-wrap">
                <Icon name={item.icon} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="liquid-glass__badge">{item.badge}</span>
                )}
              </div>
              <span className="liquid-glass__label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================================================
// Header Component
// ============================================================================

const ROLE_CONFIG: Record<Role, { badge: string; label: string; initials: string }> = {
  Admin: {
    badge: "ADMINISTRATOR",
    label: "Academic Affairs",
    initials: "AD",
  },
  Teacher: {
    badge: "LECTURER",
    label: "Faculty Portal",
    initials: "LC",
  },
  Student: {
    badge: "STUDENT",
    label: "Undergraduate Portal",
    initials: "ST",
  },
};

function Header({
  role,
  onLogout,
  term,
  userName,
}: {
  role: Role;
  onLogout: () => void;
  onSwitchRole?: (r: Role) => void;
  term?: string;
  userName?: string;
}) {
  const meta = ROLE_CONFIG[role];
  const activeTerm = term || "Semester 1 · 2025/26";
  const initials = userName
    ? userName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : meta.initials;

  return (
    <header className="portal-header">
      <div className="portal-header-left">
        <UniversityLogo compact />
        <div className="header-sep" />
        <div className="header-meta">
          <span className="header-role-badge">{meta.badge}</span>
          <span className="header-term-tag">{activeTerm}</span>
        </div>
      </div>

      <div className="portal-header-right">
        <div className="header-user-info">
          <div className="header-avatar">{initials}</div>
          <div className="header-user-text">
            <span className="header-user-title">{userName ?? meta.label}</span>
            <span className="header-user-status">Online</span>
          </div>
        </div>
        <button className="header-signout-btn" onClick={onLogout} title="Sign out">
          <Icon name="logout-01" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}

// ============================================================================
// Login Component
// ============================================================================

function Login({ onSuccess }: { onSuccess: (role: Role, email: string) => void }) {
  const [role, setRole] = useState<Role>("Student");
  const [email, setEmail] = useState("student@acity.edu.gh");
  const [password, setPassword] = useState("••••••••");
  const [error, setError] = useState("");

  const handleRoleChange = (r: Role) => {
    setRole(r);
    setError("");
    if (r === "Student") setEmail("student@acity.edu.gh");
    else if (r === "Teacher") setEmail("teacher@acity.edu.gh");
    else setEmail("admin@acity.edu.gh");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("@acity.edu.gh")) {
      setError("Please use an official Academic City institutional email (@acity.edu.gh).");
      return;
    }
    onSuccess(role, email);
  };

  return (
    <div className="login-page">
      <div className="login-intro">
        <div className="intro-top"></div>
        <div className="intro-copy">
          <p className="eyebrow">ACADEMIC CITY UNIVERSITY</p>
          <h1>Next-generation institutional timetabling platform.</h1>
          <p>
            Conflict-free academic scheduling, room allocation, and curriculum planning engine for
            students, faculty, and administration.
          </p>
        </div>
        <div className="intro-footer">
          <span>Accredited by GTEC</span>
          <span>Semester 2 · 2025/2026</span>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-wrap">
          <UniversityLogo className="login-logo" />
          <div className="login-header" style={{ margin: "20px 0 16px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px" }}>
              Timetabling Platform
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
              Official Academic City University Scheduling & Curriculum Portal
            </p>
          </div>

          <div
            className="role-selector-tabs"
            style={{ display: "flex", gap: "6px", marginBottom: "20px" }}
          >
            {(["Student", "Teacher", "Admin"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  border: role === r ? "1px solid #000" : "1px solid #e0e0e0",
                  borderRadius: "6px",
                  background: role === r ? "#000" : "#fff",
                  color: role === r ? "#fff" : "#333",
                  fontWeight: 600,
                  fontSize: "12.5px",
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {error && (
            <div
              className="error-banner"
              style={{
                color: "#111",
                background: "#f5f5f5",
                border: "1px solid #111",
                marginBottom: "14px",
                fontSize: "12.5px",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <label
              style={{
                display: "grid",
                gap: "5px",
                marginBottom: "14px",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <span>Institutional Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  fontSize: "13.5px",
                }}
              />
            </label>
            <label
              style={{
                display: "grid",
                gap: "5px",
                marginBottom: "20px",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  fontSize: "13.5px",
                }}
              />
            </label>

            <button
              type="submit"
              className="primary-action"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "12px",
                background: "#000",
              }}
            >
              Access {role} Portal <Icon name="arrow-right-01" />
            </button>
          </form>

          <div
            className="demo-credentials-box"
            style={{
              marginTop: "24px",
              padding: "14px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #eee",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Demo Profiles
            </span>
            {demos.map((d) => (
              <div
                key={d.email}
                onClick={() => {
                  handleRoleChange(d.role);
                  setEmail(d.email);
                }}
                style={{
                  marginTop: "8px",
                  padding: "8px 10px",
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "12px", display: "block", color: "#000" }}>
                    {d.name} ({d.role})
                  </strong>
                  <span style={{ fontSize: "10.5px", color: "#666" }}>{d.detail}</span>
                </div>
                <span style={{ fontSize: "11px", color: "#000", fontWeight: 700 }}>Use</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN PORTAL & MODULES
// ============================================================================

function AdminPortal({
  events,
  setEvents,
  faculty,
  setFaculty,
  rooms,
  setRooms,
  courses,
  setCourses,
  electiveTracks,
  setElectiveTracks,
  exams,
  setExams,
  currentSemester,
  setCurrentSemester,
  saturdayEnabled,
  setSaturdayEnabled,
  onLogout,
  onSwitchRole,
}: {
  events: TimetableEvent[];
  setEvents: React.Dispatch<React.SetStateAction<TimetableEvent[]>>;
  faculty: FacultyMember[];
  setFaculty: React.Dispatch<React.SetStateAction<FacultyMember[]>>;
  rooms: RoomFacility[];
  setRooms: React.Dispatch<React.SetStateAction<RoomFacility[]>>;
  courses: CourseData[];
  setCourses: React.Dispatch<React.SetStateAction<CourseData[]>>;
  electiveTracks: ElectiveTrack[];
  setElectiveTracks: React.Dispatch<React.SetStateAction<ElectiveTrack[]>>;
  exams: ExamEntry[];
  setExams: React.Dispatch<React.SetStateAction<ExamEntry[]>>;
  currentSemester: "Semester 1" | "Semester 2";
  setCurrentSemester: React.Dispatch<React.SetStateAction<"Semester 1" | "Semester 2">>;
  saturdayEnabled: boolean;
  setSaturdayEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onLogout: () => void;
  onSwitchRole: (r: Role) => void;
}) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const prevIndexRef = useRef(0);

  // Timetables view mode state
  const [viewMode, setViewMode] = useState<"programme" | "lecturer" | "classroom">("programme");
  const [selectedMajor, setSelectedMajor] = useState<Programme>("CS");
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel>("400");
  const [selectedCohort, setSelectedCohort] = useState<Level100Cohort>("Cohort 1 (Sept)");
  const [selectedGroup, setSelectedGroup] = useState<StudentGroup>("All");
  const [selectedAdminElective, setSelectedAdminElective] = useState("core");
  const [selectedLecturer, setSelectedLecturer] = useState<string>("Kwesi Crankson");
  const [selectedRoom, setSelectedRoom] = useState<string>("Computer Lab 1");
  const timetableRef = useRef<HTMLElement | null>(null);

  // Rescheduling modal state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [targetEvent, setTargetEvent] = useState<TimetableEvent | null>(null);
  const [newDay, setNewDay] = useState<number>(0);
  const [newSlot, setNewSlot] = useState<number>(0);
  const [newRoom, setNewRoom] = useState<string>("Computer Lab 1");
  const [rescheduleOnlineMeeting, setRescheduleOnlineMeeting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Group split calculator modal state
  const [splitCourse, setSplitCourse] = useState<CourseData | null>(null);
  const [courseForm, setCourseForm] = useState({
    code: "",
    title: "",
    department: departmentOptions[0] ?? "",
    faculty: "",
    weeklyHours: "3",
    credits: "3",
    enrollment: "0",
    courseType: "Core",
    electiveTrack: "",
    newTrackName: "",
    electiveSemester: "1",
  });
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [courseFormSuccess, setCourseFormSuccess] = useState<string | null>(null);

  // Rollover modal state
  const [rolloverModalOpen, setRolloverModalOpen] = useState(false);
  const [rolloverSuccess, setRolloverSuccess] = useState(false);

  // Academic Calendar & System Rules state
  const [academicYear, setAcademicYear] = useState("2025/26");
  const [teachingWeeks, setTeachingWeeks] = useState(14);
  const [cohortOneEnabled, setCohortOneEnabled] = useState(true);
  const [cohortTwoEnabled, setCohortTwoEnabled] = useState(true);
  const [minSessionDurationEnforced, setMinSessionDurationEnforced] = useState(true);
  const [groupSplitEnforced, setGroupSplitEnforced] = useState(true);
  const [prohibitGroupC, setProhibitGroupC] = useState(true);
  const enabledLevel100Cohorts = useMemo(
    () =>
      level100CohortOptions.filter((cohort) =>
        cohort === "Cohort 1 (Sept)" ? cohortOneEnabled : cohortTwoEnabled,
      ),
    [cohortOneEnabled, cohortTwoEnabled],
  );

  useEffect(() => {
    if (
      selectedLevel === "100" &&
      enabledLevel100Cohorts.length > 0 &&
      !enabledLevel100Cohorts.includes(selectedCohort)
    ) {
      setSelectedCohort(enabledLevel100Cohorts[0]);
    }
  }, [enabledLevel100Cohorts, selectedCohort, selectedLevel]);

  // Settings Save & Verification states
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [timingVerified, setTimingVerified] = useState(false);
  const [rolloverSteps, setRolloverSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });
  const [rolloverNotice, setRolloverNotice] = useState<string | null>(null);

  // Book room modal state
  const [bookRoomModalOpen, setBookRoomModalOpen] = useState(false);
  const [relocationSuggestion, setRelocationSuggestion] = useState<string | null>(null);
  const [bookingEventName, setBookingEventName] = useState("Ad-hoc Academic Tutorial Session");
  const [bookingEnrollment, setBookingEnrollment] = useState(42);
  const [bookingType, setBookingType] = useState<TimetableEvent["type"]>("Tutorial");
  const [bookingDay, setBookingDay] = useState(0);
  const [bookingSlot, setBookingSlot] = useState(0);
  const [bookingRoom, setBookingRoom] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    if (!rescheduleModalOpen && !bookRoomModalOpen && !rolloverModalOpen) return;

    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
    };
  }, [bookRoomModalOpen, rescheduleModalOpen, rolloverModalOpen]);

  // Calculate Timetable Health Gauge: (Conflict-Free / Total) * 100%
  const totalSessions = events.length;
  // Detected conflicts check
  const conflictCount = useMemo(() => {
    let conflicts = 0;
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];
        if (a.day === b.day && a.room === b.room && !a.onlineMeeting && !b.onlineMeeting) {
          const aEnd = a.start + (a.span || 1);
          const bEnd = b.start + (b.span || 1);
          if (Math.max(a.start, b.start) < Math.min(aEnd, bEnd)) {
            conflicts++;
          }
        }
      }
    }
    return conflicts;
  }, [events]);

  const conflictFreeSessions = Math.max(0, totalSessions - conflictCount);
  const healthPercentage =
    totalSessions > 0 ? ((conflictFreeSessions / totalSessions) * 100).toFixed(1) : "100.0";

  // Faculty confirmation tracker calculation
  const confirmedFacultyCount = faculty.filter((f) => f.confirmed).length;
  const totalFacultyCount = faculty.length;

  const adminNav = [
    ["Overview", "dashboard-square-01"],
    ["Timetables", "calendar-03"],
    ["Courses", "book-open-01"],
    ["Facilities", "building-03"],
    ["Exams", "test-tube-01"],
    ["Settings", "settings-01"],
  ];

  const navigate = (label: string) => {
    const nextIndex = adminNav.findIndex(([l]) => l === label);
    const dir = nextIndex > prevIndexRef.current ? "right" : "left";
    setDirection(dir);
    setAnimKey((k) => k + 1);
    prevIndexRef.current = nextIndex >= 0 ? nextIndex : prevIndexRef.current;
    setActiveTab(label);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  const getAdminScheduleSuggestions = (event: TimetableEvent, onlineMeeting = false) => {
    const lecturer = faculty.find((member) => member.name === event.person);
    const days = event.day === 5 || saturdayEnabled ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];

    return getAvailableScheduleSuggestions({
      event,
      events,
      rooms,
      courses,
      facultyMember: lecturer,
      includeOnline: onlineMeeting,
      days: days.filter(
        (day) =>
          day !== 5 || event.day === 5 || (saturdayEnabled && lecturer?.saturdayOptIn === true),
      ),
    }).filter((suggestion) =>
      onlineMeeting
        ? suggestion.roomCode === ONLINE_MEETING_ROOM
        : suggestion.roomCode !== ONLINE_MEETING_ROOM,
    );
  };

  const getFirstAdminSuggestion = (event: TimetableEvent, onlineMeeting = false) => {
    const suggestions = getAdminScheduleSuggestions(event, onlineMeeting);
    return (
      suggestions.find(
        (suggestion) =>
          suggestion.day === event.day &&
          suggestion.slot === event.start &&
          suggestion.roomCode === (onlineMeeting ? ONLINE_MEETING_ROOM : event.room),
      ) || suggestions[0]
    );
  };

  // Open reschedule modal for an event
  const handleOpenReschedule = (ev: TimetableEvent) => {
    const onlineMeeting = ev.onlineMeeting === true;
    const suggestion = getFirstAdminSuggestion(ev, onlineMeeting);
    setTargetEvent(ev);
    setRescheduleOnlineMeeting(onlineMeeting);
    setNewDay(suggestion?.day ?? ev.day);
    setNewSlot(suggestion?.slot ?? ev.start);
    setNewRoom(suggestion?.roomCode ?? (ev.onlineMeeting ? ONLINE_MEETING_ROOM : ev.room));
    setRescheduleError(null);
    setRescheduleModalOpen(true);
  };

  // Validate and execute reschedule
  const handleExecuteReschedule = () => {
    if (!targetEvent) return;
    setRescheduleError(null);

    if (newDay === 5 && targetEvent.day !== 5) {
      if (!saturdayEnabled) {
        setRescheduleError("Enable Saturday scheduling before moving a class to Saturday.");
        return;
      }

      const lecturer = faculty.find((member) => member.name === targetEvent.person);
      if (!lecturer?.saturdayOptIn) {
        setRescheduleError(
          `${targetEvent.person} has not opted in to Saturday classes. Ask the lecturer to enable Saturday availability first.`,
        );
        return;
      }
    }

    const isSuggested = getAdminScheduleSuggestions(targetEvent, rescheduleOnlineMeeting).some(
      (suggestion) =>
        suggestion.day === newDay && suggestion.slot === newSlot && suggestion.roomCode === newRoom,
    );
    if (!isSuggested) {
      setRescheduleError(
        "Choose a suggested room and time that are free and suitable for this class.",
      );
      return;
    }

    // Apply change
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== targetEvent.id) return e;
        return {
          ...e,
          day: newDay,
          start: newSlot,
          room: rescheduleOnlineMeeting ? e.room : newRoom,
          onlineMeeting: rescheduleOnlineMeeting,
        };
      }),
    );
    setRescheduleError(null);
    setRescheduleModalOpen(false);
  };

  const adminRescheduleSuggestions = targetEvent
    ? getAdminScheduleSuggestions(targetEvent, rescheduleOnlineMeeting)
    : [];
  const isAdminRescheduleSelectionAvailable = adminRescheduleSuggestions.some(
    (suggestion) =>
      suggestion.day === newDay && suggestion.slot === newSlot && suggestion.roomCode === newRoom,
  );
  const bookingScheduleSuggestions = useMemo(() => {
    if (!Number.isFinite(bookingEnrollment) || bookingEnrollment < 1) return [];

    const bookingEvent: TimetableEvent = {
      id: "__room_booking_preview__",
      code: "BOOKING",
      title: bookingEventName,
      person: "",
      room: "",
      day: 0,
      start: 0,
      span: 1,
      major: "ALL",
      level: "100",
      semester: 1,
      type: bookingType,
    };

    return getAvailableScheduleSuggestions({
      event: bookingEvent,
      events,
      rooms,
      courses,
      days: saturdayEnabled ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4],
      capacityOverride: bookingEnrollment,
      includeOnline: false,
    });
  }, [bookingEnrollment, bookingEventName, bookingType, courses, events, rooms, saturdayEnabled]);
  const isBookingSelectionAvailable = bookingScheduleSuggestions.some(
    (suggestion) =>
      suggestion.day === bookingDay &&
      suggestion.slot === bookingSlot &&
      suggestion.roomCode === bookingRoom,
  );

  useEffect(() => {
    if (!bookRoomModalOpen) return;
    const isCurrentSelectionAvailable = bookingScheduleSuggestions.some(
      (suggestion) =>
        suggestion.day === bookingDay &&
        suggestion.slot === bookingSlot &&
        suggestion.roomCode === bookingRoom,
    );
    if (isCurrentSelectionAvailable) return;

    const firstSuggestion = bookingScheduleSuggestions[0];
    setBookingDay(firstSuggestion?.day ?? -1);
    setBookingSlot(firstSuggestion?.slot ?? -1);
    setBookingRoom(firstSuggestion?.roomCode ?? "");
  }, [bookRoomModalOpen, bookingDay, bookingRoom, bookingScheduleSuggestions, bookingSlot]);

  const handleOpenRoomBooking = () => {
    const firstSuggestion = bookingScheduleSuggestions[0];
    setBookingDay(firstSuggestion?.day ?? -1);
    setBookingSlot(firstSuggestion?.slot ?? -1);
    setBookingRoom(firstSuggestion?.roomCode ?? "");
    setBookingError(null);
    setBookRoomModalOpen(true);
  };

  const handleConfirmRoomBooking = () => {
    const isAvailable = bookingScheduleSuggestions.some(
      (suggestion) =>
        suggestion.day === bookingDay &&
        suggestion.slot === bookingSlot &&
        suggestion.roomCode === bookingRoom,
    );
    if (!isAvailable) {
      setBookingError("Choose a currently available room and time before confirming.");
      return;
    }

    alert(
      `${bookingRoom} is available for ${bookingEventName || "the booking"} on ${weekDays6[bookingDay]} at ${timeSlots[bookingSlot]}.`,
    );
    setBookRoomModalOpen(false);
  };

  // Filter events based on view mode
  const displayedEvents = useMemo(() => {
    if (viewMode === "programme") {
      return events.filter(
        (ev) =>
          (ev.major === selectedMajor || ev.major === "ALL") &&
          ev.level === selectedLevel &&
          (selectedLevel !== "100" ||
            (enabledLevel100Cohorts.includes(selectedCohort) &&
              (!ev.cohort || ev.cohort === "Both" || ev.cohort === selectedCohort))) &&
          (selectedGroup === "All" ||
            !ev.group ||
            ev.group === "All" ||
            ev.group === selectedGroup),
      );
    } else if (viewMode === "lecturer") {
      return events.filter((ev) =>
        ev.person.toLowerCase().includes(selectedLecturer.toLowerCase()),
      );
    } else {
      return events.filter((ev) =>
        selectedRoom === ONLINE_MEETING_ROOM
          ? ev.onlineMeeting
          : !ev.onlineMeeting && ev.room === selectedRoom,
      );
    }
  }, [
    events,
    viewMode,
    selectedMajor,
    selectedLevel,
    selectedGroup,
    selectedCohort,
    enabledLevel100Cohorts,
    selectedLecturer,
    selectedRoom,
  ]);
  const availableAdminElectives = useMemo(
    () => (viewMode === "programme" ? getScheduledElectiveCourses(displayedEvents, courses) : []),
    [courses, displayedEvents, viewMode],
  );
  useEffect(() => {
    if (
      selectedAdminElective !== "core" &&
      !availableAdminElectives.some((course) => course.code === selectedAdminElective)
    ) {
      setSelectedAdminElective("core");
    }
  }, [availableAdminElectives, selectedAdminElective]);

  const adminTimetableEvents = useMemo(() => {
    if (viewMode !== "programme") return displayedEvents;

    return displayedEvents.filter((event) => {
      const electiveCourse = getElectiveCourseForEvent(event, courses);
      return !electiveCourse || electiveCourse.code === selectedAdminElective;
    });
  }, [courses, displayedEvents, selectedAdminElective, viewMode]);
  const programmeBaseTimetableTitle =
    selectedLevel === "100"
      ? `${selectedMajor} Level 100 Timetable · ${
          enabledLevel100Cohorts.length > 0 ? selectedCohort : "No Cohorts Enabled"
        }`
      : `${selectedMajor} Level ${selectedLevel} Timetable`;
  const selectedElectiveLabel =
    selectedAdminElective === "core"
      ? "Core Courses Only"
      : (availableAdminElectives.find((course) => course.code === selectedAdminElective)?.code ??
        "Core Courses Only");
  const programmeTimetableTitle = `${programmeBaseTimetableTitle} · ${selectedElectiveLabel}`;

  // Execute course group auto-split
  const handleExecuteSplit = (c: CourseData) => {
    setCourses((prev) =>
      prev.map((item) =>
        item.code === c.code
          ? {
              ...item,
              requiresSplit: true,
              groupAllocation: `Group A (${c.department.substring(0, 2)} - ${Math.ceil(c.enrollment * 0.55)}) & Group B (Inter-major - ${Math.floor(c.enrollment * 0.45)})`,
            }
          : item,
      ),
    );
    alert(
      `Course ${c.code} split successfully into Group A and Group B according to whole-major distribution rules. Group C strictly avoided.`,
    );
    setSplitCourse(null);
  };

  const handleAddCourse = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const code = courseForm.code.trim();
    const title = courseForm.title.trim();
    const department = courseForm.department.trim();
    const courseFaculty = courseForm.faculty.trim();
    const weeklyHours = Number(courseForm.weeklyHours);
    const credits = Number(courseForm.credits);
    const enrollment = Number(courseForm.enrollment);
    const isElective = courseForm.courseType === "Elective";
    const createNewTrack = courseForm.electiveTrack === createElectiveTrackOption;
    const trackName = isElective
      ? createNewTrack
        ? courseForm.newTrackName.trim()
        : courseForm.electiveTrack.trim()
      : "";
    const selectedTrack = electiveTracks.find(
      (track) => track.name.toLowerCase() === trackName.toLowerCase(),
    );
    const semester = courseForm.electiveSemester === "1" ? 1 : 2;

    if (!code || !title || !department || !courseFaculty) {
      setCourseFormError("Enter the course code, title, department, and lecturer.");
      setCourseFormSuccess(null);
      return;
    }

    if (!departmentOptions.includes(department)) {
      setCourseFormError("Choose a department from the list.");
      setCourseFormSuccess(null);
      return;
    }

    if (
      [...courses, ...trackElectiveCourses].some(
        (course) => normalizeCourseIdentifier(course.code) === normalizeCourseIdentifier(code),
      )
    ) {
      setCourseFormError(`A course with code ${code} already exists.`);
      setCourseFormSuccess(null);
      return;
    }

    if (isElective) {
      if (!trackName) {
        setCourseFormError("Choose an elective track or enter a name for a new track.");
        setCourseFormSuccess(null);
        return;
      }

      if (createNewTrack && selectedTrack) {
        setCourseFormError("That track already exists. Choose it from the track list instead.");
        setCourseFormSuccess(null);
        return;
      }

      if (!createNewTrack && !selectedTrack) {
        setCourseFormError("Choose an existing track or select Create a new track.");
        setCourseFormSuccess(null);
        return;
      }

      const currentSemesterElectives =
        semester === 1 ? selectedTrack?.semester1 : selectedTrack?.semester2;
      if (currentSemesterElectives && currentSemesterElectives.length >= 2) {
        setCourseFormError(`That track already has two Semester ${semester} electives.`);
        setCourseFormSuccess(null);
        return;
      }
    }

    if (!Number.isInteger(weeklyHours) || weeklyHours < 1 || weeklyHours > 9) {
      setCourseFormError("Weekly hours must be a whole number between 1 and 9.");
      setCourseFormSuccess(null);
      return;
    }

    if (!Number.isInteger(credits) || credits < 1 || credits > 12) {
      setCourseFormError("Credits must be a whole number between 1 and 12.");
      setCourseFormSuccess(null);
      return;
    }

    if (!Number.isInteger(enrollment) || enrollment < 0) {
      setCourseFormError("Enrollment must be a whole number of 0 or more.");
      setCourseFormSuccess(null);
      return;
    }

    setCourses((previousCourses) => [
      ...previousCourses,
      {
        code,
        title: isElective && !/\s*\(Elective\)$/i.test(title) ? `${title} (Elective)` : title,
        department,
        credits,
        lectureHours: weeklyHours,
        labHours: 0,
        weeklySessionHours: weeklyHours === 4 ? [2, 2] : [weeklyHours],
        ...(isElective ? { electiveTrack: trackName, electiveSemester: semester } : {}),
        enrollment,
        faculty: courseFaculty,
        requiresSplit: false,
        groupAllocation: "Single Section",
        examPaperStatus: "Draft",
      },
    ]);
    if (isElective) {
      const semesterKey = semester === 1 ? "semester1" : "semester2";
      setElectiveTracks((previousTracks) => {
        const existingTrack = previousTracks.find(
          (track) => track.name.toLowerCase() === trackName.toLowerCase(),
        );
        if (existingTrack) {
          return previousTracks.map((track) =>
            track === existingTrack
              ? { ...track, [semesterKey]: [...track[semesterKey], code] }
              : track,
          );
        }

        return [
          ...previousTracks,
          {
            name: trackName,
            semester1: semester === 1 ? [code] : [],
            semester2: semester === 2 ? [code] : [],
          },
        ];
      });
    }
    setCourseForm({
      code: "",
      title: "",
      department: departmentOptions[0] ?? "",
      faculty: "",
      weeklyHours: "3",
      credits: "3",
      enrollment: "0",
      courseType: "Core",
      electiveTrack: "",
      newTrackName: "",
      electiveSemester: "1",
    });
    setCourseFormError(null);
    setCourseFormSuccess(
      isElective
        ? `${code} added to ${trackName} · Semester ${semester}.`
        : weeklyHours === 4
          ? `${code} added with two separate 2-hour sessions per week.`
          : `${code} added with one ${weeklyHours}-hour session per week.`,
    );
  };

  const handleSaveSettings = () => {
    setSaveSuccessMsg(
      `Settings saved successfully! Academic calendar configuration (${currentSemester} · ${academicYear}) and all scheduling engine rules are active.`,
    );
    setTimeout(() => setSaveSuccessMsg(null), 4500);
  };

  const handleResetSettings = () => {
    setAcademicYear("2025/26");
    setCurrentSemester("Semester 1");
    setTeachingWeeks(14);
    setCohortOneEnabled(true);
    setCohortTwoEnabled(true);
    setSaturdayEnabled(false);
    setMinSessionDurationEnforced(true);
    setGroupSplitEnforced(true);
    setProhibitGroupC(true);
    setSaveSuccessMsg("Reset to institutional defaults. Click Save Settings to persist.");
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleVerifyTiming = () => {
    setTimingVerified(true);
    setTimeout(() => setTimingVerified(false), 3500);
  };

  const handleInitiateRollover = () => {
    const incomplete = [1, 2, 3, 4].filter((s) => !rolloverSteps[s]);
    if (incomplete.length > 0) {
      alert(
        `Prerequisite Validation Incomplete: Please verify Step(s) ${incomplete.join(", ")} before executing semester rollover.`,
      );
      return;
    }
    setRolloverModalOpen(true);
  };

  const handleConfirmRollover = () => {
    const nextSem: "Semester 1" | "Semester 2" =
      currentSemester === "Semester 1" ? "Semester 2" : "Semester 1";
    let nextYear =
      currentSemester === "Semester 1"
        ? academicYear
        : academicYear === "2025/26"
          ? "2026/27"
          : "2027/28";

    setAcademicYear(nextYear);
    setCurrentSemester(nextSem);
    setRolloverModalOpen(false);
    setRolloverNotice(
      `Semester Rollover executed successfully! Academic term promoted to ${nextSem} (${nextYear}). Level 100 Cohort 2 merged into Level 200 unified cohort.`,
    );
    setTimeout(() => setRolloverNotice(null), 6000);
  };

  return (
    <main className="portal admin-portal">
      <Header
        role="Admin"
        onLogout={onLogout}
        onSwitchRole={onSwitchRole}
        term={`${currentSemester} · ${academicYear}`}
      />

      <div key={animKey} className={`portal-content page-slide page-slide--${direction}`}>
        {/* =========================================================================
            TAB 1: OVERVIEW DASHBOARD
            ========================================================================= */}
        {activeTab === "Overview" && (
          <>
            <PageHeading
              eyebrow="ACADEMIC PLANNING · EXECUTIVE OVERVIEW"
              title="Institution Timetable Operations."
              copy="Live monitoring of schedule health, faculty confirmations, room load, and intake cohorts."
              action={
                <button className="date-button" onClick={() => navigate("Settings")}>
                  <Icon name="calendar-03" /> Semester 2 · 2025/26
                </button>
              }
            />

            {/* Timetable Health Gauge & Confirmation Tracker Banner */}
            <div className="health-gauge-card">
              <div className="gauge-content">
                <span className="eyebrow-mini">SCHEDULE INTEGRITY RATING</span>
                <h3>Timetable Health: {healthPercentage}%</h3>
                <p>
                  Formula: (Conflict-Free Sessions ÷ Total Scheduled Sessions) × 100% ·{" "}
                  {conflictFreeSessions} of {totalSessions} sessions conflict-free.
                </p>
                <div className="gauge-pill-row">
                  <span className="gauge-pill">
                    <Icon name="checkmark-circle-02" />{" "}
                    {conflictCount === 0
                      ? "Zero hard clashes"
                      : `${conflictCount} clashes detected`}
                  </span>
                  <span className="gauge-pill">
                    <Icon name="user-check-01" /> {confirmedFacultyCount} of {totalFacultyCount}{" "}
                    Faculty Sign-Offs (
                    {Math.round((confirmedFacultyCount / totalFacultyCount) * 100)}%)
                  </span>
                  <span className="gauge-pill">
                    <Icon name="clock-01" /> Standard 9-Period Grid
                  </span>
                </div>
              </div>
              <div className="gauge-ring-wrap">
                <div className="gauge-ring-number">{healthPercentage}%</div>
                <button className="primary-action" onClick={() => navigate("Timetables")}>
                  Audit Schedule <Icon name="arrow-right-01" />
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="metrics">
              {[
                ["Active courses", courses.length.toString(), "14 departments"],
                [
                  "Rooms in use",
                  `${rooms.filter((r) => r.status === "In use").length} / ${rooms.length}`,
                  "91% peak utilization",
                ],
                [
                  "Faculty Confirmed",
                  `${confirmedFacultyCount} / ${totalFacultyCount}`,
                  "3 pending approval",
                ],
                [
                  "Open conflicts",
                  conflictCount.toString().padStart(2, "0"),
                  conflictCount === 0 ? "All resolved" : "Attention required",
                ],
              ].map((metric, index) => (
                <article
                  key={metric[0]}
                  className={index === 3 && conflictCount > 0 ? "attention" : ""}
                >
                  <span>{metric[0]}</span>
                  <strong>{metric[1]}</strong>
                  <small>{metric[2]}</small>
                </article>
              ))}
            </div>

            {/* Cohorts & Faculty Confirmation Tracker Grid */}
            <div className="admin-grid" style={{ marginTop: "24px" }}>
              {/* Faculty Confirmation Tracker */}
              <section className="operations">
                <div className="section-title">
                  <div>
                    <span>FACULTY COMPLIANCE</span>
                    <h3>Timetable Sign-Off Tracker</h3>
                  </div>
                  <span className="muted-label">
                    {confirmedFacultyCount} of {totalFacultyCount} confirmed
                  </span>
                </div>
                <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                  {faculty.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "#fff",
                        border: "1px solid #e5e5e5",
                        borderRadius: "8px",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "13px", display: "block" }}>{f.name}</strong>
                        <span style={{ fontSize: "11px", color: "#666" }}>
                          {f.department} · {f.loadHours} hrs load
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {f.confirmed ? (
                          <span className="badge-confirmed">
                            <Icon name="checkmark-circle-02" /> Confirmed
                          </span>
                        ) : (
                          <span className="badge-pending">
                            <Icon name="clock-01" /> Pending
                          </span>
                        )}
                        <button
                          style={{
                            fontSize: "11px",
                            padding: "4px 8px",
                            border: "1px solid #ccc",
                            background: "#fafafa",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setFaculty((prev) =>
                              prev.map((item) =>
                                item.id === f.id
                                  ? {
                                      ...item,
                                      confirmed: !item.confirmed,
                                      confirmedAt: !item.confirmed
                                        ? "Just now (Admin sign-off)"
                                        : null,
                                    }
                                  : item,
                              ),
                            );
                          }}
                        >
                          {f.confirmed ? "Revert" : "Sign Off"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Intake Cohorts & QA Health Alert */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <aside className="attention-card" style={{ background: "#000", color: "#fff" }}>
                  <span style={{ color: "#aaa" }}>INTAKE COHORTS STATUS</span>
                  <h3 style={{ color: "#fff" }}>Level 100 Dual Cohort Engine</h3>
                  <p style={{ color: "#ccc", fontSize: "12px" }}>
                    Cohort 1 (September intake) and Cohort 2 (January intake) remain separate until
                    Level 200 unification checkpoint.
                  </p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <span
                      className="cohort-pill"
                      style={{
                        background: "#222",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    >
                      Cohort 1: 184 Students
                    </span>
                    <span
                      className="cohort-pill"
                      style={{
                        background: "#222",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                    >
                      Cohort 2: 96 Students
                    </span>
                  </div>
                </aside>

                <aside className="attention-card">
                  <span>ROOM CAPACITY ALERT</span>
                  <h3>Capacity Check</h3>
                  <p>
                    Ensure all sections with enrollment ≥ 60 students are divided strictly into
                    Group A & Group B. Group C is prohibited.
                  </p>
                  <button onClick={() => navigate("Courses")}>
                    Review Course Splits <Icon name="arrow-right-01" />
                  </button>
                </aside>
              </div>
            </div>
          </>
        )}

        {/* =========================================================================
            TAB 2: MASTER TIMETABLES (3 VIEW MODES)
            ========================================================================= */}
        {activeTab === "Timetables" && (
          <>
            <PageHeading
              eyebrow="ADMINISTRATION · MASTER SCHEDULE"
              title="Master Timetables."
              copy="View institution timetables by academic programme, individual lecturer, or physical classroom."
              action={
                <button
                  className="primary-action"
                  onClick={() => {
                    if (events[0]) handleOpenReschedule(events[0]);
                  }}
                >
                  <Icon name="calendar-add-01" /> Reschedule Session
                </button>
              }
            />

            {/* Unified Timetable Control Deck */}
            <div className="timetable-deck">
              {/* Top Row: View Mode Switcher + Action Controls */}
              <div className="timetable-deck-top">
                <div className="tt-view-tabs">
                  <button
                    type="button"
                    className={`tt-tab-btn ${viewMode === "programme" ? "active" : ""}`}
                    onClick={() => setViewMode("programme")}
                  >
                    <Icon name="book-open-01" />
                    <span>Programme</span>
                  </button>
                  <button
                    type="button"
                    className={`tt-tab-btn ${viewMode === "lecturer" ? "active" : ""}`}
                    onClick={() => setViewMode("lecturer")}
                  >
                    <Icon name="user-01" />
                    <span>Lecturer</span>
                  </button>
                  <button
                    type="button"
                    className={`tt-tab-btn ${viewMode === "classroom" ? "active" : ""}`}
                    onClick={() => setViewMode("classroom")}
                  >
                    <Icon name="building-03" />
                    <span>Classroom</span>
                  </button>
                </div>

                <div className="tt-deck-actions">
                  <label
                    className="tt-sat-pill"
                    title="Enable Saturday scheduling for lecturers who have opted in"
                  >
                    <input
                      type="checkbox"
                      checked={saturdayEnabled}
                      onChange={(e) => setSaturdayEnabled(e.target.checked)}
                    />
                    <span>Allow Saturday</span>
                  </label>

                  <button
                    type="button"
                    className="tt-action-btn"
                    onClick={() => window.print()}
                    title="Print official landscape sheet"
                  >
                    <Icon name="file-export" />
                    <span>Print / PDF</span>
                  </button>
                  <TimetablePngButton
                    targetRef={timetableRef}
                    filename="academic-city-master-timetable.png"
                  />
                </div>
              </div>

              {/* Bottom Row: Context Filters for Active Mode */}
              <div className="timetable-deck-filters">
                {viewMode === "programme" && (
                  <>
                    <div className="tt-filter-item">
                      <span className="tt-filter-label">Major</span>
                      <select
                        className="tt-filter-select"
                        value={selectedMajor}
                        onChange={(e) => setSelectedMajor(e.target.value as Programme)}
                      >
                        <option value="CS">Computer Science (CS)</option>
                        <option value="CE">Computer Engineering (CE)</option>
                        <option value="EE">Electrical & Electronic Engineering (EE)</option>
                        <option value="ME">Mechanical Engineering (ME)</option>
                        <option value="BA">Business Administration (BA)</option>
                      </select>
                    </div>

                    <div className="tt-filter-item">
                      <span className="tt-filter-label">Level</span>
                      <select
                        className="tt-filter-select"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value as AcademicLevel)}
                      >
                        <option value="100">Level 100</option>
                        <option value="200">Level 200</option>
                        <option value="300">Level 300</option>
                        <option value="400">Level 400</option>
                      </select>
                    </div>

                    {selectedLevel === "100" && (
                      <div className="tt-filter-item">
                        <span className="tt-filter-label">Intake</span>
                        {enabledLevel100Cohorts.length > 0 ? (
                          <select
                            className="tt-filter-select"
                            value={selectedCohort}
                            onChange={(e) => setSelectedCohort(e.target.value as Level100Cohort)}
                          >
                            {enabledLevel100Cohorts.map((cohort) => (
                              <option key={cohort} value={cohort}>
                                {cohort === "Cohort 1 (Sept)"
                                  ? "Cohort 1 (Sept Intake)"
                                  : "Cohort 2 (Jan Intake)"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#71717a" }}>
                            No Level 100 cohorts enabled in Settings
                          </span>
                        )}
                      </div>
                    )}

                    <div className="tt-filter-item">
                      <span className="tt-filter-label">Group</span>
                      <select
                        className="tt-filter-select"
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value as StudentGroup)}
                      >
                        <option value="All">All Groups (Combined)</option>
                        <option value="Group A">Group A</option>
                        <option value="Group B">Group B</option>
                      </select>
                    </div>

                    {availableAdminElectives.length > 0 && (
                      <div className="tt-filter-item">
                        <span className="tt-filter-label">Elective schedule</span>
                        <select
                          className="tt-filter-select"
                          value={selectedAdminElective}
                          onChange={(e) => setSelectedAdminElective(e.target.value)}
                        >
                          <option value="core">Core courses only</option>
                          {availableAdminElectives.map((course) => (
                            <option key={course.code} value={course.code}>
                              {course.code} · {course.title.replace(/\s*\(Elective\)/i, "")}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {viewMode === "lecturer" && (
                  <div className="tt-filter-item" style={{ minWidth: "260px" }}>
                    <span className="tt-filter-label">Lecturer</span>
                    <select
                      className="tt-filter-select"
                      style={{ width: "100%" }}
                      value={selectedLecturer}
                      onChange={(e) => setSelectedLecturer(e.target.value)}
                    >
                      {faculty.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name} ({f.department})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {viewMode === "classroom" && (
                  <div className="tt-filter-item" style={{ minWidth: "260px" }}>
                    <span className="tt-filter-label">Classroom</span>
                    <select
                      className="tt-filter-select"
                      style={{ width: "100%" }}
                      value={selectedRoom}
                      onChange={(e) => setSelectedRoom(e.target.value)}
                    >
                      {rooms.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.code} ({r.building} · Cap: {r.capacity})
                        </option>
                      ))}
                      <option value={ONLINE_MEETING_ROOM}>{ONLINE_MEETING_ROOM}</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Official University 9-Period Timetable Sheet */}
            <section
              ref={timetableRef}
              className="timetable-shell"
              aria-label="Official Timetable Grid"
            >
              <div className="timetable-toolbar">
                <div>
                  <strong>
                    Academic City University ·{" "}
                    {viewMode === "programme"
                      ? programmeTimetableTitle
                      : viewMode === "lecturer"
                        ? `Faculty Timetable: ${selectedLecturer}`
                        : `Classroom Occupancy: ${selectedRoom}`}
                  </strong>
                  <span>Semester 2 · 2025/2026 Academic Year · 9 Daily Periods</span>
                </div>
                <div className="timetable-export-tip" style={{ fontSize: "12px", color: "#666" }}>
                  Tip: Click any class box to reschedule or view clash details
                </div>
              </div>

              <WeeklyTimetableGrid
                events={adminTimetableEvents}
                saturday={saturdayEnabled || adminTimetableEvents.some((event) => event.day === 5)}
                onEventClick={handleOpenReschedule}
              />
            </section>
          </>
        )}

        {/* =========================================================================
            TAB 3: COURSES & CURRICULUM (GROUP SPLITTING ENGINE)
            ========================================================================= */}
        {activeTab === "Courses" && (
          <>
            <PageHeading
              eyebrow="ADMINISTRATION · CURRICULUM MANAGEMENT"
              title="Courses & Group Splitting Engine."
              copy="Add courses with weekly contact hours, manage allocations, and split cohorts ≥ 60 students strictly into Group A and Group B."
              action={
                <button
                  className="primary-action"
                  onClick={() =>
                    alert("Course curriculum synced with Acity 2.0 Student Information System.")
                  }
                >
                  <Icon name="refresh" /> Sync Acity 2.0
                </button>
              }
            />

            <section className="settings-section" aria-label="Add a course">
              <div>
                <h3>Add a Course</h3>
                <p>
                  A 4-hour course is split into two 2-hour sessions at different times. Other hour
                  totals stay in one session. Electives are auto-scheduled; courses in different
                  tracks may overlap when their lecturers and rooms allow.
                </p>
              </div>
              <div>
                <form className="settings-fields" onSubmit={handleAddCourse}>
                  <label>
                    <span>Course code</span>
                    <input
                      value={courseForm.code}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, code: event.target.value }))
                      }
                      maxLength={24}
                      required
                    />
                  </label>
                  <label>
                    <span>Course title</span>
                    <input
                      value={courseForm.title}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, title: event.target.value }))
                      }
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    <span>Department</span>
                    <select
                      value={courseForm.department}
                      onChange={(event) =>
                        setCourseForm((current) => ({
                          ...current,
                          department: event.target.value,
                        }))
                      }
                      required
                    >
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Lecturer</span>
                    <input
                      value={courseForm.faculty}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, faculty: event.target.value }))
                      }
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    <span>Course type</span>
                    <select
                      value={courseForm.courseType}
                      onChange={(event) =>
                        setCourseForm((current) => ({
                          ...current,
                          courseType: event.target.value,
                          electiveTrack: "",
                          newTrackName: "",
                        }))
                      }
                    >
                      <option value="Core">Core course</option>
                      <option value="Elective">Elective</option>
                    </select>
                  </label>
                  {courseForm.courseType === "Elective" && (
                    <>
                      <label>
                        <span>Elective track</span>
                        <select
                          value={courseForm.electiveTrack}
                          onChange={(event) =>
                            setCourseForm((current) => ({
                              ...current,
                              electiveTrack: event.target.value,
                              newTrackName: "",
                            }))
                          }
                          required
                        >
                          <option value="">Select or create a track</option>
                          {electiveTracks.map((track) => (
                            <option key={track.name} value={track.name}>
                              {track.name}
                            </option>
                          ))}
                          <option value={createElectiveTrackOption}>Create a new track</option>
                        </select>
                      </label>
                      {courseForm.electiveTrack === createElectiveTrackOption && (
                        <label>
                          <span>New track name</span>
                          <input
                            value={courseForm.newTrackName}
                            onChange={(event) =>
                              setCourseForm((current) => ({
                                ...current,
                                newTrackName: event.target.value,
                              }))
                            }
                            maxLength={80}
                            required
                          />
                        </label>
                      )}
                      <label>
                        <span>Semester</span>
                        <select
                          value={courseForm.electiveSemester}
                          onChange={(event) =>
                            setCourseForm((current) => ({
                              ...current,
                              electiveSemester: event.target.value,
                            }))
                          }
                        >
                          <option value="1">Semester 1</option>
                          <option value="2">Semester 2</option>
                        </select>
                      </label>
                    </>
                  )}
                  <label>
                    <span>Hours per week</span>
                    <input
                      type="number"
                      min={1}
                      max={9}
                      step={1}
                      value={courseForm.weeklyHours}
                      onChange={(event) =>
                        setCourseForm((current) => ({
                          ...current,
                          weeklyHours: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Credits</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      step={1}
                      value={courseForm.credits}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, credits: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Enrollment</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={courseForm.enrollment}
                      onChange={(event) =>
                        setCourseForm((current) => ({
                          ...current,
                          enrollment: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <button
                    className="primary-action"
                    type="submit"
                    style={{ gridColumn: "1 / -1", justifySelf: "start" }}
                  >
                    Add Course
                  </button>
                </form>
                {courseFormError && (
                  <p role="alert" style={{ color: "#b42318", fontSize: "12px", marginTop: "10px" }}>
                    {courseFormError}
                  </p>
                )}
                {courseFormSuccess && (
                  <p
                    role="status"
                    style={{ color: "#267544", fontSize: "12px", marginTop: "10px" }}
                  >
                    {courseFormSuccess}
                  </p>
                )}
                <div style={{ display: "grid", gap: "8px", marginTop: "20px" }}>
                  <strong style={{ fontSize: "13px" }}>Elective track assignments</strong>
                  {electiveTracks.map((track) => (
                    <div
                      key={track.name}
                      style={{
                        border: "1px solid #e5e5e5",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        fontSize: "12px",
                      }}
                    >
                      <strong>{track.name}</strong>
                      <div style={{ marginTop: "5px", color: "#555" }}>
                        Semester 1: {track.semester1.join(", ") || "No electives assigned"}
                      </div>
                      <div style={{ marginTop: "3px", color: "#555" }}>
                        Semester 2: {track.semester2.join(", ") || "No electives assigned"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="split-box">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span className="split-badge-pill">MANDATORY RULE</span>
                  <strong style={{ marginLeft: "10px", fontSize: "13px" }}>
                    Group Split Threshold: Enrollment ≥ 60 Students
                  </strong>
                </div>
                <span style={{ fontSize: "12px", color: "#666" }}>
                  Strict University Rule: Group A and Group B ONLY. Group C is strictly prohibited.
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "#444" }}>
                Splits must be executed by whole majors only (never dividing students within the
                same major cohort). Continuous blocks must be 60–180 minutes. 4-hour courses (240
                min) split into two 120-min blocks on non-consecutive days.
              </p>
            </div>

            <div className="data-table" role="table" style={{ marginTop: "20px" }}>
              <div className="table-head" role="row">
                <span>Course Code & Title</span>
                <span>Lecturer</span>
                <span>Enrollment</span>
                <span>Group Split Status</span>
                <span>Action</span>
              </div>
              {courses.map((c) => (
                <div className="table-row" role="row" key={c.code}>
                  <span>
                    <b>{c.code}</b>
                    <small>{c.title}</small>
                    <small style={{ fontWeight: 600, color: "#333" }}>
                      {c.lectureHours + c.labHours}{" "}
                      {c.lectureHours + c.labHours === 1 ? "hour" : "hours"} per week
                    </small>
                    <small>
                      {getCourseWeeklySessions(c).length === 2
                        ? `${getCourseWeeklySessions(c).join("h + ")}h sessions at different times`
                        : `${getCourseWeeklySessions(c)[0] ?? 0}h single session`}
                    </small>
                  </span>
                  <span>{c.faculty}</span>
                  <span>
                    <strong>{c.enrollment} students</strong>
                    {c.enrollment >= 60 && (
                      <small style={{ color: "#000", fontWeight: 700, display: "block" }}>
                        Split Threshold Met (≥60)
                      </small>
                    )}
                  </span>
                  <span>
                    {c.requiresSplit ? (
                      <span className="badge-confirmed">
                        <Icon name="checkmark-circle-02" /> {c.groupAllocation}
                      </span>
                    ) : (
                      <span className="badge-pending">Single Section ({c.enrollment})</span>
                    )}
                  </span>
                  <span>
                    {c.enrollment >= 60 && !c.requiresSplit ? (
                      <button
                        style={{
                          padding: "6px 12px",
                          border: "1px solid #000",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "4px",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onClick={() => handleExecuteSplit(c)}
                      >
                        Auto-Split Course
                      </button>
                    ) : (
                      <button
                        style={{
                          padding: "6px 12px",
                          border: "1px solid #ccc",
                          background: "#fff",
                          borderRadius: "4px",
                          fontSize: "11.5px",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          alert(
                            `${c.code}: Course session structure complies with 60–180 min continuous block policy.`,
                          )
                        }
                      >
                        Inspect Rules
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* =========================================================================
            TAB 4: FACILITIES & AUTOMATIC RELOCATION ENGINE
            ========================================================================= */}
        {activeTab === "Facilities" && (
          <>
            <PageHeading
              eyebrow="ADMINISTRATION · ROOM INFRASTRUCTURE"
              title="Classrooms & Laboratories."
              copy="Live room capacity, AV equipment, and intelligent conflict relocation engine."
              action={
                <button className="primary-action" onClick={handleOpenRoomBooking}>
                  <Icon name="building-03" /> Book Room with Auto-Relocate
                </button>
              }
            />

            <div className="metrics compact-metrics">
              {[
                [
                  "Total campus rooms",
                  rooms.length.toString(),
                  `Across ${new Set(rooms.map((room) => room.building)).size} buildings`,
                ],
                [
                  "Available now",
                  rooms.filter((r) => r.status === "Available").length.toString(),
                  "Ready for bookings",
                ],
                [
                  "In session",
                  rooms.filter((r) => r.status === "In use").length.toString(),
                  "91% utilization",
                ],
                [
                  "Maintenance",
                  rooms.filter((r) => r.status === "Maintenance").length.toString(),
                  "Work orders open",
                ],
              ].map((item, index) => (
                <article className={index === 3 ? "attention" : ""} key={item[0]}>
                  <span>{item[0]}</span>
                  <strong>{item[1]}</strong>
                  <small>{item[2]}</small>
                </article>
              ))}
            </div>

            <div className="room-grid" style={{ marginTop: "24px" }}>
              {rooms.map((room) => (
                <article key={room.code}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#666" }}>
                      {room.type}
                    </span>
                    <span
                      className={
                        room.status === "Maintenance"
                          ? "room-state warning"
                          : room.status === "Available"
                            ? "room-state available"
                            : "room-state"
                      }
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background:
                          room.status === "Available"
                            ? "#e6f4ea"
                            : room.status === "Maintenance"
                              ? "#feefe3"
                              : "#f1f3f4",
                        color:
                          room.status === "Available"
                            ? "#137333"
                            : room.status === "Maintenance"
                              ? "#b06000"
                              : "#333",
                      }}
                    >
                      {room.status}
                    </span>
                  </div>
                  <h3>{room.code}</h3>
                  <p>{room.building}</p>
                  <dl>
                    <div>
                      <dt>Capacity</dt>
                      <dd>{room.capacity} seats</dd>
                    </div>
                    <div>
                      <dt>Features</dt>
                      <dd>{room.features}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}

        {/* =========================================================================
            TAB 5: EXAMINATIONS TIMETABLING (50% DISTANCING CAPACITY & INVIGILATORS)
            ========================================================================= */}
        {activeTab === "Exams" && (
          <>
            <PageHeading
              eyebrow="ADMINISTRATION · EXAMINATION BOARD"
              title="Examination Timetables & Venues."
              copy="Social distancing capacity calculator (50% density rule) and faculty invigilation assignments."
              action={
                <button className="primary-action" onClick={() => window.print()}>
                  <Icon name="file-export" /> Export Exam Roster
                </button>
              }
            />

            <div className="notice-strip">
              <Icon name="notification-02" />
              <span>
                <strong>Examination Board Certified:</strong> Minimum 50% Social Distancing Capacity
                factor applied to all exam halls (e.g. Main Hall 350 standard seats → 175 maximum
                exam desks).
              </span>
            </div>

            <div className="data-list exams-list" style={{ marginTop: "20px" }}>
              {exams.map((ex) => (
                <article key={ex.id}>
                  <div className="date-block">
                    <strong>{ex.date.split(" ")[0]}</strong>
                    <span>{ex.date.split(" ")[1]}</span>
                  </div>
                  <time>{ex.time}</time>
                  <div>
                    <span>
                      {ex.code} · {ex.major} Level {ex.level}
                    </span>
                    <h3>{ex.title}</h3>
                    <p>
                      <Icon name="building-03" /> {ex.venue} (Exam Cap:{" "}
                      {ex.socialDistancingCapacity} desks / Normal: {ex.normalCapacity})
                    </p>
                    <p style={{ marginTop: "4px", fontSize: "11.5px", color: "#666" }}>
                      Invigilators: <b>{ex.invigilators.join(", ")}</b>
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="confirmed-text">Seating Locked</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* =========================================================================
            TAB 6: SYSTEM SETTINGS & SEMESTER ROLLOVER WORKFLOW
            ========================================================================= */}
        {activeTab === "Settings" && (
          <>
            <PageHeading
              eyebrow="ADMINISTRATION · SYSTEM RULES"
              title="Timetable & Calendar Settings."
              copy="Timing template engine, workweek policies, and Move to Next Semester rollover workflow."
              action={
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    style={{
                      padding: "8px 14px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      background: "#fff",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    style={{
                      background: "#000",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      fontSize: "12.5px",
                    }}
                    onClick={handleSaveSettings}
                  >
                    <Icon name="checkmark-circle-02" /> Save Settings
                  </button>
                </div>
              }
            />

            {/* Notification Banner: Save confirmation */}
            {saveSuccessMsg && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  color: "#166534",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <Icon name="checkmark-circle-02" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Notification Banner: Rollover Notice */}
            {rolloverNotice && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #93c5fd",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  color: "#1e40af",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Icon name="refresh" />
                  <span>{rolloverNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRolloverNotice(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "16px",
                    cursor: "pointer",
                    color: "#1e40af",
                  }}
                >
                  &times;
                </button>
              </div>
            )}

            <div className="settings-layout">
              {/* Academic Term Configuration */}
              <section className="settings-section">
                <div>
                  <h3>Academic Calendar</h3>
                  <p>
                    Current term configuration and teaching week rules. Student elective choices
                    follow the current semester.
                  </p>
                </div>
                <div className="settings-fields">
                  <label>
                    <span>Academic year</span>
                    <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                      <option value="2025/26">2025/26</option>
                      <option value="2026/27">2026/27</option>
                      <option value="2027/28">2027/28</option>
                    </select>
                  </label>
                  <label>
                    <span>Current Semester</span>
                    <select
                      value={currentSemester}
                      onChange={(e) =>
                        setCurrentSemester(
                          e.target.value === "Semester 1" ? "Semester 1" : "Semester 2",
                        )
                      }
                    >
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                    </select>
                  </label>
                  <label>
                    <span>Teaching Weeks</span>
                    <input
                      type="number"
                      min={10}
                      max={20}
                      value={teachingWeeks}
                      onChange={(e) => setTeachingWeeks(Number(e.target.value))}
                    />
                  </label>
                </div>
              </section>

              <section className="settings-section">
                <div>
                  <h3>Level 100 Intake Cohorts</h3>
                  <p>
                    Enable each intake independently. Disabled cohorts are removed from the Level
                    100 timetable picker immediately.
                  </p>
                </div>
                <div className="toggle-list" style={{ display: "grid", gap: "10px" }}>
                  {[
                    {
                      name: "Cohort 1 (September intake)",
                      enabled: cohortOneEnabled,
                      setEnabled: setCohortOneEnabled,
                    },
                    {
                      name: "Cohort 2 (January intake)",
                      enabled: cohortTwoEnabled,
                      setEnabled: setCohortTwoEnabled,
                    },
                  ].map((cohort) => (
                    <label
                      key={cohort.name}
                      style={{
                        padding: "12px 14px",
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>{cohort.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: cohort.enabled ? "#111" : "#e5e7eb",
                            color: cohort.enabled ? "#fff" : "#4b5563",
                          }}
                        >
                          {cohort.enabled ? "ACTIVE" : "DISABLED"}
                        </span>
                        <input
                          type="checkbox"
                          checked={cohort.enabled}
                          onChange={(e) => cohort.setEnabled(e.target.checked)}
                          style={{
                            width: "20px",
                            height: "20px",
                            cursor: "pointer",
                            accentColor: "#000",
                          }}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* Timing Template Engine */}
              <section className="settings-section">
                <div>
                  <h3>Timing Template Engine</h3>
                  <p>Daily period grid slots and intervals.</p>
                  <div style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      onClick={handleVerifyTiming}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "6px 12px",
                        border: "1px solid #111",
                        borderRadius: "4px",
                        background: timingVerified ? "#111" : "#fff",
                        color: timingVerified ? "#fff" : "#111",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Icon name="checkmark-circle-02" />
                      {timingVerified ? "Grid Verified (9 Periods)" : "Verify Period Slots"}
                    </button>
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      background: "#fafafa",
                      padding: "16px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "10px",
                        fontSize: "12px",
                      }}
                    >
                      {timeSlots.map((slot, idx) => (
                        <div
                          key={slot}
                          style={{
                            padding: "8px 10px",
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, color: "#111", marginRight: "6px" }}>
                              Period {idx + 1}:
                            </span>
                            <span style={{ color: "#4b5563" }}>{slot}</span>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#f3f4f6",
                              color: "#374151",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            60 min
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11.5px",
                      color: "#6b7280",
                    }}
                  >
                    <span>* 10-minute transition buffers enforced between periods.</span>
                    <span>9 standard periods / day (08:00 – 18:20)</span>
                  </div>
                </div>
              </section>

              {/* Scheduling Engine Rules */}
              <section className="settings-section">
                <div>
                  <h3>Scheduling Engine Rules</h3>
                  <p>Core algorithmic parameters applied during conflict checks.</p>
                </div>
                <div className="toggle-list" style={{ display: "grid", gap: "10px" }}>
                  <label
                    style={{
                      padding: "12px 14px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "grid", gap: "2px" }}>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>
                        Allow Saturday scheduling
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#6b7280" }}>
                        Lets admins schedule Saturday classes; each lecturer must opt in separately.
                        Student timetables show Saturday only when a class is scheduled there.
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: saturdayEnabled ? "#111" : "#e5e7eb",
                          color: saturdayEnabled ? "#fff" : "#4b5563",
                        }}
                      >
                        {saturdayEnabled ? "ACTIVE" : "INACTIVE"}
                      </span>
                      <input
                        type="checkbox"
                        checked={saturdayEnabled}
                        onChange={(e) => setSaturdayEnabled(e.target.checked)}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          accentColor: "#000",
                        }}
                      />
                    </div>
                  </label>

                  <label
                    style={{
                      padding: "12px 14px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "grid", gap: "2px" }}>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>
                        Enforce minimum 60-minute session duration (no sessions &lt; 60 min)
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#6b7280" }}>
                        Institutional policy requirement: all lecture and lab periods must span at
                        least 1 full slot.
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: minSessionDurationEnforced ? "#111" : "#e5e7eb",
                          color: minSessionDurationEnforced ? "#fff" : "#4b5563",
                        }}
                      >
                        {minSessionDurationEnforced ? "ENFORCED" : "INACTIVE"}
                      </span>
                      <input
                        type="checkbox"
                        checked={minSessionDurationEnforced}
                        onChange={(e) => setMinSessionDurationEnforced(e.target.checked)}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          accentColor: "#000",
                        }}
                      />
                    </div>
                  </label>

                  <label
                    style={{
                      padding: "12px 14px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "grid", gap: "2px" }}>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>
                        Enforce Group A & B split for courses with ≥ 60 students
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#6b7280" }}>
                        Courses meeting capacity threshold are flagged for cohort division into
                        Group A and Group B.
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: groupSplitEnforced ? "#111" : "#e5e7eb",
                          color: groupSplitEnforced ? "#fff" : "#4b5563",
                        }}
                      >
                        {groupSplitEnforced ? "ENFORCED" : "INACTIVE"}
                      </span>
                      <input
                        type="checkbox"
                        checked={groupSplitEnforced}
                        onChange={(e) => setGroupSplitEnforced(e.target.checked)}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          accentColor: "#000",
                        }}
                      />
                    </div>
                  </label>

                  <label
                    style={{
                      padding: "12px 14px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "grid", gap: "2px" }}>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>
                        Strict prohibition of Group C creation
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#6b7280" }}>
                        Academic policy constraint: no split algorithm or manual override may
                        generate a Group C.
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: prohibitGroupC ? "#111" : "#e5e7eb",
                          color: prohibitGroupC ? "#fff" : "#4b5563",
                        }}
                      >
                        {prohibitGroupC ? "ENFORCED" : "INACTIVE"}
                      </span>
                      <input
                        type="checkbox"
                        checked={prohibitGroupC}
                        onChange={(e) => setProhibitGroupC(e.target.checked)}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          accentColor: "#000",
                        }}
                      />
                    </div>
                  </label>
                </div>
              </section>

              {/* Move to Next Semester Workflow */}
              <section
                className="settings-section"
                style={{ borderTop: "2px solid #000", paddingTop: "28px" }}
              >
                <div>
                  <h3 style={{ color: "#000" }}>Move to Next Semester Workflow</h3>
                  <p>Execute academic term rollover with multi-step validation checklist.</p>
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "10px 12px",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <strong>Current Active Term:</strong>
                    <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700 }}>
                      {currentSemester} · {academicYear}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "20px",
                  }}
                >
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>
                        Rollover Validation Checklist
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#6b7280" }}>
                        {[1, 2, 3, 4].filter((s) => rolloverSteps[s]).length} of 4 verified
                      </span>
                    </div>
                    <div
                      style={{
                        height: "4px",
                        background: "#e5e7eb",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${([1, 2, 3, 4].filter((s) => rolloverSteps[s]).length / 4) * 100}%`,
                          background: "#000",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
                    {[
                      {
                        id: 1,
                        label: "Grade compilation verified from Acity 2.0 SIS",
                        detail: "All continuous assessment and exam grades synchronized",
                      },
                      {
                        id: 2,
                        label: "Level 100 Cohort 2 merged into Level 200 unified cohort",
                        detail: "Harmonization of foundational stream into standard curriculum",
                      },
                      {
                        id: 3,
                        label: "Faculty workload and confirmation sign-offs vetted",
                        detail: "Teaching allocations confirmed with departmental heads",
                      },
                      {
                        id: 4,
                        label: "Classroom audit and summer maintenance clearance passed",
                        detail: "Physical and lab facilities inspected and cleared for instruction",
                      },
                    ].map((step) => {
                      const isVerified = rolloverSteps[step.id];
                      return (
                        <div
                          key={step.id}
                          onClick={() =>
                            setRolloverSteps((prev) => ({ ...prev, [step.id]: !prev[step.id] }))
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            background: isVerified ? "#f9fafb" : "#fff",
                            border: isVerified ? "1px solid #e5e7eb" : "1px solid #fed7aa",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <input
                              type="checkbox"
                              checked={isVerified}
                              onChange={() => {}} // handled by parent onClick
                              style={{
                                width: "16px",
                                height: "16px",
                                cursor: "pointer",
                                accentColor: "#000",
                              }}
                            />
                            <div>
                              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#111" }}>
                                Step {step.id}: {step.label}
                              </div>
                              <div style={{ fontSize: "11px", color: "#6b7280" }}>
                                {step.detail}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isVerified ? "#ecfdf5" : "#fff7ed",
                              color: isVerified ? "#047857" : "#c2410c",
                            }}
                          >
                            {isVerified ? "VERIFIED" : "PENDING"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}
                  >
                    <button
                      type="button"
                      className="primary-action"
                      style={{ background: "#000", padding: "10px 18px", fontSize: "13px" }}
                      onClick={handleInitiateRollover}
                    >
                      <Icon name="arrow-right-01" /> Initiate Semester Rollover
                    </button>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      * Multi-step term migration will advance cohort rosters and archive schedules.
                    </span>
                  </div>
                </div>
              </section>

              {/* Dedicated Save Action Bar at the bottom */}
              <div
                style={{
                  marginTop: "32px",
                  padding: "16px 20px",
                  background: "#fafafa",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>
                    System Rules & Calendar Policy Configuration
                  </span>
                  <div style={{ fontSize: "11.5px", color: "#6b7280" }}>
                    Click save to update academic rules across all timetable conflict checkers and
                    student views.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    style={{
                      padding: "9px 16px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      background: "#fff",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    style={{
                      background: "#000",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 18px",
                      fontSize: "12.5px",
                    }}
                    onClick={handleSaveSettings}
                  >
                    <Icon name="checkmark-circle-02" /> Save Settings
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Permanent Liquid Glass Navigation Bar */}
      <LiquidGlassBottomBar
        items={adminNav.map(([label, icon]) => ({
          id: label,
          label,
          icon,
          badge: label === "Overview" && conflictCount > 0 ? conflictCount : undefined,
        }))}
        selectedIndex={adminNav.findIndex(([l]) => l === activeTab)}
        onSelect={(idx) => navigate(adminNav[idx][0])}
      />

      {/* =========================================================================
          MODAL: RESCHEDULE WITH AUTOMATIC CONFLICT RELOCATION ENGINE
          ========================================================================= */}
      {rescheduleModalOpen && (
        <div className="modal-backdrop" onClick={() => setRescheduleModalOpen(false)}>
          <div className="modal-dialog reschedule-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="calendar-03" /> Reschedule Session
              </h3>
              <button className="close-btn" onClick={() => setRescheduleModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body reschedule-modal-body">
              <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
                <span>Select Class Session:</span>
                <select
                  className="reschedule-modal-control"
                  value={targetEvent?.id || ""}
                  onChange={(e) => {
                    const found = events.find((ev) => ev.id === e.target.value);
                    if (found) handleOpenReschedule(found);
                  }}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.code} - {ev.title}
                    </option>
                  ))}
                </select>
              </label>

              {targetEvent && (
                <div
                  className="reschedule-event-details"
                  style={{
                    background: "#f8f9fa",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                  }}
                >
                  <p style={{ margin: "0 0 4px" }}>
                    <strong>Course:</strong> {targetEvent.code} — {targetEvent.title}
                  </p>
                  <p style={{ margin: "0 0 4px" }}>
                    <strong>Instructor:</strong> {targetEvent.person}
                  </p>
                  <p style={{ margin: "0 0 4px" }}>
                    <strong>Current:</strong>{" "}
                    {targetEvent.onlineMeeting ? ONLINE_MEETING_ROOM : targetEvent.room} ·{" "}
                    {weekDays6[targetEvent.day]} {timeSlots[targetEvent.start]}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Duration:</strong> {targetEvent.span || 1} period(s) (
                    {(targetEvent.span || 1) * 60 + ((targetEvent.span || 1) > 1 ? 10 : 0)} mins)
                  </p>
                </div>
              )}

              <label className="teacher-reschedule-label">
                <span>
                  <input
                    type="checkbox"
                    checked={rescheduleOnlineMeeting}
                    onChange={(e) => {
                      const onlineMeeting = e.target.checked;
                      const suggestions = targetEvent
                        ? getAdminScheduleSuggestions(targetEvent, onlineMeeting)
                        : [];
                      const next =
                        suggestions.find(
                          (suggestion) => suggestion.day === newDay && suggestion.slot === newSlot,
                        ) || suggestions[0];
                      setRescheduleOnlineMeeting(onlineMeeting);
                      setNewDay(next?.day ?? -1);
                      setNewSlot(next?.slot ?? -1);
                      setNewRoom(next?.roomCode ?? "");
                      setRescheduleError(null);
                    }}
                  />{" "}
                  Online meeting (no room needed)
                </span>
              </label>

              {adminRescheduleSuggestions.length > 0 ? (
                <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
                  <span>
                    {rescheduleOnlineMeeting
                      ? "Available day and time:"
                      : "Available day, time, and suitable room:"}
                  </span>
                  <select
                    className="reschedule-modal-control"
                    value={
                      isAdminRescheduleSelectionAvailable
                        ? getScheduleSuggestionKey({
                            day: newDay,
                            slot: newSlot,
                            roomCode: newRoom,
                          })
                        : ""
                    }
                    onChange={(e) => {
                      const suggestion = adminRescheduleSuggestions.find(
                        (option) => getScheduleSuggestionKey(option) === e.target.value,
                      );
                      if (!suggestion) return;
                      setNewDay(suggestion.day);
                      setNewSlot(suggestion.slot);
                      setNewRoom(suggestion.roomCode);
                      setRescheduleError(null);
                    }}
                    style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                  >
                    {adminRescheduleSuggestions.map((suggestion) => (
                      <option
                        key={getScheduleSuggestionKey(suggestion)}
                        value={getScheduleSuggestionKey(suggestion)}
                      >
                        {rescheduleOnlineMeeting
                          ? `${weekDays6[suggestion.day]} · ${getScheduleSuggestionTimeLabel(suggestion, targetEvent?.span || 1)}`
                          : getScheduleSuggestionLabel(suggestion, rooms, targetEvent?.span || 1)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="teacher-reschedule-empty" role="status">
                  No suitable free room and time are available for this class.
                </p>
              )}

              {rescheduleError && (
                <div
                  role="alert"
                  style={{
                    background: "#fff1f0",
                    border: "1px solid #f2b8b5",
                    color: "#8a1c17",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                >
                  {rescheduleError}
                </div>
              )}
            </div>
            <div className="modal-footer reschedule-modal-footer">
              <button
                type="button"
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ccc",
                  background: "#fff",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                onClick={() => setRescheduleModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={handleExecuteReschedule}
                disabled={!isAdminRescheduleSelectionAvailable}
              >
                Save & Apply Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ROOM BOOKING & RELOCATION ENGINE
          ========================================================================= */}
      {bookRoomModalOpen && (
        <div className="modal-backdrop" onClick={() => setBookRoomModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="building-03" /> Room Booking & Conflict Relocation
              </h3>
              <button className="close-btn" onClick={() => setBookRoomModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "12.5px", color: "#555", margin: 0 }}>
                Recommendations include only rooms with enough capacity and no timetable conflict at
                the selected time.
              </p>
              <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
                <span>Event Name:</span>
                <input
                  type="text"
                  value={bookingEventName}
                  onChange={(e) => setBookingEventName(e.target.value)}
                  style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "6px" }}
                />
              </label>
              <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
                <span>Expected Enrollment:</span>
                <input
                  type="number"
                  min={1}
                  value={bookingEnrollment || ""}
                  onChange={(e) => setBookingEnrollment(Number(e.target.value))}
                  style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "6px" }}
                />
              </label>
              <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
                <span>Event Type:</span>
                <select
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value as TimetableEvent["type"])}
                  style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "6px" }}
                >
                  {(["Lecture", "Practical", "Workshop", "Tutorial"] as const).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              {bookingScheduleSuggestions.length > 0 ? (
                <>
                  <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
                    <span>Available day, time, and room:</span>
                    <select
                      value={
                        isBookingSelectionAvailable
                          ? getScheduleSuggestionKey({
                              day: bookingDay,
                              slot: bookingSlot,
                              roomCode: bookingRoom,
                            })
                          : ""
                      }
                      onChange={(e) => {
                        const suggestion = bookingScheduleSuggestions.find(
                          (option) => getScheduleSuggestionKey(option) === e.target.value,
                        );
                        if (!suggestion) return;
                        setBookingDay(suggestion.day);
                        setBookingSlot(suggestion.slot);
                        setBookingRoom(suggestion.roomCode);
                        setBookingError(null);
                      }}
                      style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "6px" }}
                    >
                      {bookingScheduleSuggestions.map((suggestion) => (
                        <option
                          key={getScheduleSuggestionKey(suggestion)}
                          value={getScheduleSuggestionKey(suggestion)}
                        >
                          {getScheduleSuggestionLabel(suggestion, rooms)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {isBookingSelectionAvailable && (
                    <div
                      style={{
                        background: "#e6f4ea",
                        padding: "12px",
                        borderRadius: "8px",
                        color: "#137333",
                        fontSize: "12px",
                      }}
                    >
                      <strong>Available:</strong>{" "}
                      {getScheduleSuggestionLabel(
                        { day: bookingDay, slot: bookingSlot, roomCode: bookingRoom },
                        rooms,
                      )}
                      ; capacity meets the requested {bookingEnrollment} seats.
                    </div>
                  )}
                </>
              ) : (
                <p className="teacher-reschedule-empty" role="status">
                  No room is free with enough capacity for this event. Reduce the enrollment or
                  choose another event type.
                </p>
              )}
              {bookingError && (
                <p className="teacher-reschedule-error" role="alert">
                  {bookingError}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ccc",
                  background: "#fff",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                onClick={() => setBookRoomModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={handleConfirmRoomBooking}
                disabled={!isBookingSelectionAvailable}
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SEMESTER ROLLOVER CONFIRMATION
          ========================================================================= */}
      {rolloverModalOpen && (
        <div className="modal-backdrop" onClick={() => setRolloverModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: "#000" }}>
                <Icon name="alert-circle" /> Execute Semester Rollover
              </h3>
              <button className="close-btn" onClick={() => setRolloverModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontWeight: 500, fontSize: "13.5px" }}>
                You are about to archive{" "}
                <strong>
                  {currentSemester} ({academicYear})
                </strong>{" "}
                and advance academic cohorts to{" "}
                <strong>
                  {currentSemester === "Semester 1" ? "Semester 2" : "Semester 1"} (
                  {currentSemester === "Semester 1"
                    ? academicYear
                    : academicYear === "2025/26"
                      ? "2026/27"
                      : "2027/28"}
                  )
                </strong>
                .
              </p>
              <ul
                style={{
                  paddingLeft: "20px",
                  fontSize: "12px",
                  color: "#555",
                  marginTop: "12px",
                  lineHeight: "1.6",
                }}
              >
                <li>Level 100 Cohort 2 will merge into Level 200 unified programme.</li>
                <li>Level 400 will move to Graduating / Alumni register.</li>
                <li>All active timetables lock into read-only historical archive.</li>
                <li>All 4 SIS and facilities clearance checks confirmed passed.</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ccc",
                  background: "#fff",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                onClick={() => setRolloverModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                style={{ background: "#000" }}
                onClick={handleConfirmRollover}
              >
                Confirm Rollover
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================================================
// LECTURER PORTAL (TEACHER VIEW)
// ============================================================================

function TeacherPortal({
  events,
  setEvents,
  faculty,
  setFaculty,
  rooms,
  courses,
  saturdayEnabled,
  onLogout,
  onSwitchRole,
}: {
  events: TimetableEvent[];
  setEvents: React.Dispatch<React.SetStateAction<TimetableEvent[]>>;
  faculty: FacultyMember[];
  setFaculty: React.Dispatch<React.SetStateAction<FacultyMember[]>>;
  rooms: RoomFacility[];
  courses: CourseData[];
  saturdayEnabled: boolean;
  onLogout: () => void;
  onSwitchRole: (r: Role) => void;
}) {
  const [activeTab, setActiveTab] = useState("Home");
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const prevIndexRef = useRef(0);
  const timetableRef = useRef<HTMLElement | null>(null);
  const [teacherRescheduleOpen, setTeacherRescheduleOpen] = useState(false);
  const [teacherTargetEvent, setTeacherTargetEvent] = useState<TimetableEvent | null>(null);
  const [teacherNewDay, setTeacherNewDay] = useState(0);
  const [teacherNewSlot, setTeacherNewSlot] = useState(0);
  const [teacherNewRoom, setTeacherNewRoom] = useState("");
  const [teacherOnlineMeeting, setTeacherOnlineMeeting] = useState(false);
  const [teacherRescheduleError, setTeacherRescheduleError] = useState<string | null>(null);

  const currentFaculty = faculty.find((f) => f.name === "Kwesi Crankson") || faculty[0];

  // Personal schedule
  const teacherEvents = useMemo(
    () =>
      events.filter((ev) => ev.person.toLowerCase().includes(currentFaculty.name.toLowerCase())),
    [events, currentFaculty],
  );

  const getTeacherScheduleSuggestions = (event: TimetableEvent, onlineMeeting = false) => {
    const days =
      event.day === 5 || (saturdayEnabled && currentFaculty.saturdayOptIn === true)
        ? [0, 1, 2, 3, 4, 5]
        : [0, 1, 2, 3, 4];

    return getAvailableScheduleSuggestions({
      event,
      events,
      rooms,
      courses,
      facultyMember: currentFaculty,
      days,
      includeOnline: onlineMeeting,
    }).filter((suggestion) =>
      onlineMeeting
        ? suggestion.roomCode === ONLINE_MEETING_ROOM
        : suggestion.roomCode !== ONLINE_MEETING_ROOM,
    );
  };

  useEffect(() => {
    if (!teacherRescheduleOpen) return;

    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
    };
  }, [teacherRescheduleOpen]);

  const teacherNav = [
    ["Home", "dashboard-square-01"],
    ["Timetable", "calendar-03"],
    ["Courses", "book-open-01"],
    ["Unavailability", "time-02"],
    ["Export", "download-04"],
  ];

  const navigate = (label: string) => {
    const nextIndex = teacherNav.findIndex(([l]) => l === label);
    const dir = nextIndex > prevIndexRef.current ? "right" : "left";
    setDirection(dir);
    setAnimKey((k) => k + 1);
    prevIndexRef.current = nextIndex >= 0 ? nextIndex : prevIndexRef.current;
    setActiveTab(label);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  const handleOpenTeacherReschedule = (event: TimetableEvent) => {
    const onlineMeeting = event.onlineMeeting === true;
    const suggestions = getTeacherScheduleSuggestions(event, onlineMeeting);
    const currentRoom = onlineMeeting ? ONLINE_MEETING_ROOM : event.room;
    const suggestion =
      suggestions.find(
        (option) =>
          option.day === event.day &&
          option.slot === event.start &&
          option.roomCode === currentRoom,
      ) || suggestions[0];

    setTeacherTargetEvent(event);
    setTeacherOnlineMeeting(onlineMeeting);
    setTeacherNewDay(suggestion?.day ?? event.day);
    setTeacherNewSlot(suggestion?.slot ?? event.start);
    setTeacherNewRoom(suggestion?.roomCode ?? "");
    setTeacherRescheduleError(null);
    setTeacherRescheduleOpen(true);
  };

  const handleTeacherReschedule = () => {
    if (!teacherTargetEvent) return;

    if (
      teacherNewDay === 5 &&
      teacherTargetEvent.day !== 5 &&
      (!saturdayEnabled || currentFaculty.saturdayOptIn !== true)
    ) {
      setTeacherRescheduleError(
        "Saturday scheduling requires admin approval and this lecturer's Saturday opt-in.",
      );
      return;
    }

    const isSuggested = getTeacherScheduleSuggestions(
      teacherTargetEvent,
      teacherOnlineMeeting,
    ).some(
      (suggestion) =>
        suggestion.day === teacherNewDay &&
        suggestion.slot === teacherNewSlot &&
        suggestion.roomCode === teacherNewRoom,
    );
    if (!isSuggested) {
      setTeacherRescheduleError(
        "That room and time are no longer available. Choose one of the suggested options.",
      );
      return;
    }

    setEvents((prev) =>
      prev.map((event) =>
        event.id === teacherTargetEvent.id
          ? {
              ...event,
              day: teacherNewDay,
              start: teacherNewSlot,
              room: teacherOnlineMeeting ? event.room : teacherNewRoom,
              onlineMeeting: teacherOnlineMeeting,
            }
          : event,
      ),
    );
    setTeacherRescheduleOpen(false);
    setTeacherRescheduleError(null);
  };

  const teacherRescheduleSuggestions = teacherTargetEvent
    ? getTeacherScheduleSuggestions(teacherTargetEvent, teacherOnlineMeeting)
    : [];
  const isTeacherRescheduleSelectionAvailable = teacherRescheduleSuggestions.some(
    (suggestion) =>
      suggestion.day === teacherNewDay &&
      suggestion.slot === teacherNewSlot &&
      suggestion.roomCode === teacherNewRoom,
  );
  const teacherAvailabilityDays = currentFaculty.saturdayOptIn === true ? weekDays6 : weekDays5;

  // Toggle timetable confirmation sign-off
  const handleToggleConfirm = () => {
    setFaculty((prev) =>
      prev.map((f) =>
        f.id === currentFaculty.id
          ? {
              ...f,
              confirmed: !f.confirmed,
              confirmedAt: !f.confirmed ? "Confirmed today" : null,
            }
          : f,
      ),
    );
  };

  const handleToggleSaturdayOptIn = (saturdayOptIn: boolean) => {
    setFaculty((prev) =>
      prev.map((member) =>
        member.id === currentFaculty.id ? { ...member, saturdayOptIn } : member,
      ),
    );
  };

  const handleSetOnlineMeeting = (event: TimetableEvent, onlineMeeting: boolean) => {
    if (!onlineMeeting && event.onlineMeeting) {
      const roomConflict = events.find(
        (other) =>
          other.id !== event.id &&
          !other.onlineMeeting &&
          other.day === event.day &&
          other.room === event.room &&
          Math.max(other.start, event.start) <
            Math.min(other.start + (other.span || 1), event.start + (event.span || 1)),
      );
      if (roomConflict) {
        window.alert(`${event.room} is already occupied by ${roomConflict.code} during that time.`);
        return;
      }
    }

    setEvents((prev) =>
      prev.map((item) => (item.id === event.id ? { ...item, onlineMeeting } : item)),
    );
  };

  // Toggle unavailability slot in interactive matrix
  const handleToggleSlotUnavailability = (day: number, slot: number) => {
    setFaculty((prev) =>
      prev.map((f) => {
        if (f.id !== currentFaculty.id) return f;
        const exists = f.unavailability.some((u) => u.day === day && u.slot === slot);
        const updated = exists
          ? f.unavailability.filter((u) => !(u.day === day && u.slot === slot))
          : [...f.unavailability, { day, slot, reason: "Research / Focus Block" }];
        return { ...f, unavailability: updated };
      }),
    );
  };

  return (
    <main className="portal teacher-portal">
      <Header role="Teacher" onLogout={onLogout} onSwitchRole={onSwitchRole} />

      <div key={animKey} className={`portal-content page-slide page-slide--${direction}`}>
        {/* =========================================================================
            TEACHER TAB 1: HOME & RADAR
            ========================================================================= */}
        {activeTab === "Home" && (
          <>
            <PageHeading
              eyebrow="FACULTY PORTAL · OVERVIEW"
              title={`Welcome back, ${currentFaculty.name.split(" ")[0]}.`}
              copy="Review your weekly teaching sessions, room locations, and timetable sign-off status."
              action={
                <button className="date-button" onClick={() => navigate("Timetable")}>
                  <Icon name="calendar-03" /> Semester 2 · 2025/26
                </button>
              }
            />

            {/* Timetable Sign-Off Banner */}
            <div
              style={{
                background: currentFaculty.confirmed ? "#e6f4ea" : "#fef7e0",
                border: `1px solid ${currentFaculty.confirmed ? "#ceead6" : "#feefc3"}`,
                borderRadius: "12px",
                padding: "18px 24px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: currentFaculty.confirmed ? "#137333" : "#b06000",
                  }}
                >
                  ACADEMIC CITY TIMETABLE SIGN-OFF
                </span>
                <h3 style={{ margin: "4px 0 0", fontSize: "16px", color: "#111" }}>
                  {currentFaculty.confirmed
                    ? "✓ You have signed off your Semester 2 schedule"
                    : "Please review and confirm your Semester 2 schedule"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#666" }}>
                  {currentFaculty.confirmed
                    ? `Signed off on ${currentFaculty.confirmedAt}. Visible to Academic Planning.`
                    : "Confirming locks your schedule and signals readiness to the Scheduling Committee."}
                </p>
              </div>
              <button
                className="primary-action"
                style={{
                  background: currentFaculty.confirmed ? "#137333" : "#000",
                }}
                onClick={handleToggleConfirm}
              >
                {currentFaculty.confirmed ? "Update Sign-Off" : "Confirm My Timetable"}
              </button>
            </div>

            <NextClassRadar role="Teacher" facultyName={currentFaculty.name} />

            <div className="section-title spaced">
              <h3>Today's Agenda</h3>
              <span className="muted-label">Monday Teaching Day</span>
            </div>

            <div className="data-list teacher-agenda-list" style={{ marginTop: "12px" }}>
              {teacherEvents
                .filter((ev) => ev.day === 0)
                .map((ev) => (
                  <article key={ev.id}>
                    <time>{timeSlots[ev.start]}</time>
                    <div>
                      <span>
                        {ev.code} · {ev.type}
                      </span>
                      <h3>{ev.title}</h3>
                      <p>
                        <Icon name="building-03" />{" "}
                        {ev.onlineMeeting ? ONLINE_MEETING_ROOM : ev.room} · Level {ev.level}
                      </p>
                    </div>
                    <span className={`confirmed-text ${ev.onlineMeeting ? "is-online" : ""}`}>
                      {ev.onlineMeeting ? "Online Meeting" : "Confirmed Room"}
                    </span>
                  </article>
                ))}
            </div>
          </>
        )}

        {/* =========================================================================
            TEACHER TAB 2: TIMETABLE SHEET
            ========================================================================= */}
        {activeTab === "Timetable" && (
          <>
            <PageHeading
              eyebrow="FACULTY PORTAL · SCHEDULE"
              title="Your Teaching Timetable."
              copy="Official 9-period weekly schedule rendered with uniform Academic City borders."
              action={
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <label className="tt-sat-pill" title="Opt in to being assigned Saturday classes">
                    <input
                      type="checkbox"
                      checked={currentFaculty.saturdayOptIn === true}
                      onChange={(e) => handleToggleSaturdayOptIn(e.target.checked)}
                    />
                    <span>Accept Saturday classes</span>
                  </label>
                  <button className="timetable-print-btn" onClick={() => window.print()}>
                    <Icon name="file-export" /> Print / PDF
                  </button>
                  <TimetablePngButton
                    targetRef={timetableRef}
                    filename="academic-city-teaching-timetable.png"
                  />
                </div>
              }
            />

            <section ref={timetableRef} className="timetable-shell">
              <div className="timetable-toolbar">
                <div>
                  <strong>
                    Academic City University · {currentFaculty.name} ({currentFaculty.department})
                  </strong>
                  <span>Semester 2 · 2025/2026 Academic Year</span>
                </div>
                <button
                  style={{
                    fontSize: "11.5px",
                    padding: "4px 10px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                  disabled={teacherEvents.length === 0}
                  onClick={() => {
                    if (teacherEvents[0]) handleOpenTeacherReschedule(teacherEvents[0]);
                  }}
                >
                  <Icon name="calendar-add-01" /> Reschedule Class
                </button>
              </div>

              <WeeklyTimetableGrid
                events={teacherEvents}
                saturday={
                  currentFaculty.saturdayOptIn === true ||
                  teacherEvents.some((event) => event.day === 5)
                }
                onEventClick={handleOpenTeacherReschedule}
              />
              {teacherEvents.length === 0 ? (
                <p className="teacher-empty-state">
                  No scheduled classes are assigned to {currentFaculty.name}.
                </p>
              ) : (
                <details className="teacher-online-options">
                  <summary>Choose online meeting for a class</summary>
                  <div className="teacher-online-options__list">
                    {teacherEvents.map((event) => (
                      <label className="teacher-online-options__row" key={event.id}>
                        <span>
                          <strong>
                            {event.code} · {event.title}
                          </strong>
                          <small>
                            {weekDays6[event.day]} · {timeSlots[event.start]}
                          </small>
                        </span>
                        <select
                          aria-label={`Meeting mode for ${event.code}`}
                          value={event.onlineMeeting ? "online" : "in-person"}
                          onChange={(e) =>
                            handleSetOnlineMeeting(event, e.target.value === "online")
                          }
                        >
                          <option value="in-person">In person · {event.room}</option>
                          <option value="online">{ONLINE_MEETING_ROOM}</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </section>

            {teacherRescheduleOpen &&
              teacherTargetEvent &&
              createPortal(
                <div className="modal-backdrop" onClick={() => setTeacherRescheduleOpen(false)}>
                  <div
                    className="modal-dialog reschedule-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="teacher-reschedule-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="modal-header">
                      <h3 id="teacher-reschedule-title">
                        <Icon name="calendar-03" /> Reschedule Your Class
                      </h3>
                      <button
                        className="close-btn"
                        aria-label="Close reschedule dialog"
                        onClick={() => setTeacherRescheduleOpen(false)}
                      >
                        &times;
                      </button>
                    </div>
                    <div className="modal-body reschedule-modal-body">
                      <label className="teacher-reschedule-label">
                        <span>Class session</span>
                        <select
                          className="reschedule-modal-control"
                          value={teacherTargetEvent.id}
                          onChange={(e) => {
                            const selectedEvent = teacherEvents.find(
                              (event) => event.id === e.target.value,
                            );
                            if (selectedEvent) handleOpenTeacherReschedule(selectedEvent);
                          }}
                        >
                          {teacherEvents.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.code} · {event.title}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="reschedule-event-details">
                        <p>
                          <strong>Current schedule:</strong> {weekDays6[teacherTargetEvent.day]} ·{" "}
                          {timeSlots[teacherTargetEvent.start]}
                        </p>
                        <p>
                          <strong>Classroom:</strong>{" "}
                          {teacherTargetEvent.onlineMeeting
                            ? ONLINE_MEETING_ROOM
                            : teacherTargetEvent.room}
                        </p>
                      </div>

                      <p className="teacher-reschedule-guidance">
                        Only suitable rooms and times that fit your availability and avoid your
                        other classes are suggested.
                      </p>

                      <label className="teacher-reschedule-label">
                        <span>
                          <input
                            type="checkbox"
                            checked={teacherOnlineMeeting}
                            onChange={(e) => {
                              const onlineMeeting = e.target.checked;
                              const suggestions = teacherTargetEvent
                                ? getTeacherScheduleSuggestions(teacherTargetEvent, onlineMeeting)
                                : [];
                              const next =
                                suggestions.find(
                                  (suggestion) =>
                                    suggestion.day === teacherNewDay &&
                                    suggestion.slot === teacherNewSlot,
                                ) || suggestions[0];
                              setTeacherOnlineMeeting(onlineMeeting);
                              setTeacherNewDay(next?.day ?? -1);
                              setTeacherNewSlot(next?.slot ?? -1);
                              setTeacherNewRoom(next?.roomCode ?? "");
                              setTeacherRescheduleError(null);
                            }}
                          />{" "}
                          Online meeting (no room needed)
                        </span>
                      </label>

                      {teacherRescheduleSuggestions.length > 0 ? (
                        <label className="teacher-reschedule-label">
                          <span>
                            {teacherOnlineMeeting
                              ? "Available day and time"
                              : "Available day, time, and suitable room"}
                          </span>
                          <select
                            className="reschedule-modal-control"
                            value={
                              isTeacherRescheduleSelectionAvailable
                                ? getScheduleSuggestionKey({
                                    day: teacherNewDay,
                                    slot: teacherNewSlot,
                                    roomCode: teacherNewRoom,
                                  })
                                : ""
                            }
                            onChange={(e) => {
                              const suggestion = teacherRescheduleSuggestions.find(
                                (option) => getScheduleSuggestionKey(option) === e.target.value,
                              );
                              if (!suggestion) return;
                              setTeacherNewDay(suggestion.day);
                              setTeacherNewSlot(suggestion.slot);
                              setTeacherNewRoom(suggestion.roomCode);
                              setTeacherRescheduleError(null);
                            }}
                          >
                            {teacherRescheduleSuggestions.map((suggestion) => (
                              <option
                                key={getScheduleSuggestionKey(suggestion)}
                                value={getScheduleSuggestionKey(suggestion)}
                              >
                                {teacherOnlineMeeting
                                  ? `${weekDays6[suggestion.day]} · ${getScheduleSuggestionTimeLabel(suggestion, teacherTargetEvent?.span || 1)}`
                                  : getScheduleSuggestionLabel(
                                      suggestion,
                                      rooms,
                                      teacherTargetEvent?.span || 1,
                                    )}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="teacher-reschedule-empty" role="status">
                          No suitable free room and time match this class and your availability.
                        </p>
                      )}

                      {teacherRescheduleError && (
                        <p className="teacher-reschedule-error" role="alert">
                          {teacherRescheduleError}
                        </p>
                      )}
                    </div>
                    <div className="modal-footer reschedule-modal-footer">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => setTeacherRescheduleOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="primary-action"
                        onClick={handleTeacherReschedule}
                        disabled={!isTeacherRescheduleSelectionAvailable}
                      >
                        Save New Schedule
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )}
          </>
        )}

        {/* =========================================================================
            TEACHER TAB 3: ASSIGNED COURSES
            ========================================================================= */}
        {activeTab === "Courses" && (
          <>
            <PageHeading
              eyebrow="FACULTY PORTAL · CURRICULUM"
              title="Your Courses & Contact Hours."
              copy="Course sections assigned to you for Semester 2, including lecture and laboratory allocations."
            />
            <div className="data-table" role="table">
              <div className="table-head" role="row">
                <span>Course</span>
                <span>Department</span>
                <span>Cohort / Level</span>
                <span>Contact Hours</span>
                <span>Status</span>
              </div>
              <div className="table-row" role="row">
                <span>
                  <b>CS 4134</b>
                  <small>Human-Computer Interaction</small>
                </span>
                <span>Informatics & Computer Science</span>
                <span>Level 400 (52 students)</span>
                <span>2h Lecture + 2h Lab</span>
                <span className="badge-confirmed">Active</span>
              </div>
              <div className="table-row" role="row">
                <span>
                  <b>CS 301</b>
                  <small>Data Structures & Algorithms</small>
                </span>
                <span>Informatics & Computer Science</span>
                <span>Level 300 (64 students)</span>
                <span>3h Lecture</span>
                <span className="badge-confirmed">Active</span>
              </div>
            </div>
          </>
        )}

        {/* =========================================================================
            TEACHER TAB 4: INTERACTIVE UNAVAILABILITY DECLARATION MATRIX
            ========================================================================= */}
        {activeTab === "Unavailability" && (
          <>
            <PageHeading
              eyebrow="FACULTY PORTAL · AVAILABILITY"
              title="Declare Teaching Unavailability."
              copy="Click on slots in the interactive weekly grid below to block times you cannot teach."
            />

            <div className="split-box">
              <p style={{ margin: 0, fontSize: "12.5px" }}>
                <strong>Interactive Mode:</strong> Click any cell in the 9-period matrix to toggle
                unavailability. Red cross-hatched slots are communicated directly to the Automated
                Scheduling Engine.
              </p>
            </div>

            {/* Interactive Unavailability Matrix Grid */}
            <div className="unavail-matrix-shell">
              <div
                className="unavail-matrix"
                style={{
                  gridTemplateColumns: `80px repeat(${teacherAvailabilityDays.length}, minmax(130px, 1fr))`,
                }}
              >
                <div className="unavail-header-cell">Time</div>
                {teacherAvailabilityDays.map((d) => (
                  <div className="unavail-header-cell" key={d}>
                    {d}
                  </div>
                ))}

                {timeSlots.map((time, rowIdx) => {
                  return (
                    <React.Fragment key={time}>
                      <div className="unavail-time-cell">{time}</div>
                      {teacherAvailabilityDays.map((_, colIdx) => {
                        const isBlocked = currentFaculty.unavailability.some(
                          (u) => u.day === colIdx && u.slot === rowIdx,
                        );
                        return (
                          <div
                            key={`${colIdx}-${rowIdx}`}
                            className={`unavail-slot ${isBlocked ? "is-blocked" : ""}`}
                            onClick={() => handleToggleSlotUnavailability(colIdx, rowIdx)}
                            title={
                              isBlocked
                                ? "Blocked: Click to unblock"
                                : "Available: Click to mark unavailable"
                            }
                          >
                            {isBlocked ? "Unavailable" : ""}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <span className="muted-label">Active Blocked Windows:</span>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                {currentFaculty.unavailability.map((u, i) => (
                  <span
                    key={i}
                    style={{
                      background: "#f5f5f5",
                      color: "#111",
                      border: "1px solid #bbb",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {weekDays6[u.day]} {timeSlots[u.slot]} ({u.reason})
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* =========================================================================
            TEACHER TAB 5: EXPORT & CALENDAR
            ========================================================================= */}
        {activeTab === "Export" && (
          <>
            <PageHeading
              eyebrow="FACULTY PORTAL · EXPORT"
              title="Export Your Schedule."
              copy="Download print-ready PDFs, export Apple/Google calendar files, or subscribe to live feeds."
            />
            <div className="export-grid">
              <article>
                <Icon name="pdf-02" />
                <h3>PDF Timetable</h3>
                <p>Print-ready landscape sheet with complete room and cohort details.</p>
                <button onClick={() => window.print()}>
                  Download PDF <Icon name="download-04" />
                </button>
              </article>
              <article>
                <Icon name="calendar-03" />
                <h3>iCalendar Sync</h3>
                <p>Direct .ics file export for Apple Calendar, Outlook, and Google Calendar.</p>
                <button onClick={() => alert("Schedule.ics downloaded.")}>
                  Export .ics <Icon name="download-04" />
                </button>
              </article>
              <article className="calendar-subscribe">
                <Icon name="link-04" />
                <h3>Live WebCal Feed</h3>
                <p>Auto-updating subscription URL for your calendar applications.</p>
                <button onClick={() => alert("Live calendar link copied to clipboard.")}>
                  Copy WebCal URL <Icon name="copy-01" />
                </button>
              </article>
            </div>
          </>
        )}
      </div>

      <LiquidGlassBottomBar
        items={teacherNav.map(([label, icon]) => ({ id: label, label, icon }))}
        selectedIndex={teacherNav.findIndex(([l]) => l === activeTab)}
        onSelect={(idx) => navigate(teacherNav[idx][0])}
      />
    </main>
  );
}

// ============================================================================
// STUDENT PORTAL (STUDENT EXPERIENCE)
// ============================================================================

function StudentElectiveTrackSelect({
  value,
  tracks,
  onChange,
}: {
  value: string;
  tracks: ElectiveTrack[];
  onChange: (trackName: string) => void;
}) {
  return (
    <label className="tt-filter-item">
      <span className="tt-filter-label">Elective track</span>
      <select
        className="tt-filter-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Regular programme · core courses only</option>
        {tracks.map((track) => (
          <option key={track.name} value={track.name}>
            {track.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function StudentPortal({
  events,
  courses,
  electiveTracks,
  exams,
  demoAccount,
  currentSemester,
  onLogout,
  onSwitchRole,
}: {
  events: TimetableEvent[];
  courses: CourseData[];
  electiveTracks: ElectiveTrack[];
  exams: ExamEntry[];
  demoAccount: DemoAccount;
  currentSemester: "Semester 1" | "Semester 2";
  onLogout: () => void;
  onSwitchRole: (r: Role) => void;
}) {
  const [activeTab, setActiveTab] = useState("Home");
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const prevIndexRef = useRef(0);
  const timetableRef = useRef<HTMLElement | null>(null);

  // Student Profile State
  const studentMajor = demoAccount.major ?? "CS";
  const studentLevel = demoAccount.level ?? "400";

  // Elective Selection State
  const [selectedTrack, setSelectedTrack] = useState(demoAccount.track ?? "");
  const [selectedElectives, setSelectedElectives] = useState<string[]>(
    demoAccount.track ? [] : (demoAccount.electives ?? []),
  );
  const selectedSemester = currentSemester === "Semester 1" ? 1 : 2;
  const activeTrack = electiveTracks.find((track) => track.name === selectedTrack);
  const isTrackDemo = activeTrack !== undefined;
  const activeTrackElectiveCourses = [
    ...trackElectiveCourses,
    ...courses.filter((course) => course.electiveTrack !== undefined),
  ];
  const activeTrackSchedule = activeTrack
    ? getTrackElectiveEvents(activeTrack, activeTrackElectiveCourses, electiveTracks, events)
    : { events: [], unscheduledCourseCodes: [] };
  const activeTrackElectiveEvents = activeTrackSchedule.events;
  const trackElectiveCodes = activeTrack
    ? [...activeTrack.semester1, ...activeTrack.semester2]
    : [];
  const enrolledElectiveCodes = isTrackDemo ? trackElectiveCodes : selectedElectives;
  const [activeStudentElective, setActiveStudentElective] = useState(
    demoAccount.electives?.[0] ?? "core",
  );
  const handleTrackSelection = (trackName: string) => {
    setSelectedTrack(trackName);
    setSelectedElectives([]);
    setActiveStudentElective("core");
  };
  const activeTimetableElective = activeStudentElective;
  const setActiveTimetableElective = setActiveStudentElective;
  const studentElectiveCourses = isTrackDemo ? [...courses, ...trackElectiveCourses] : courses;
  const selectedElectiveCourses = enrolledElectiveCodes.map((code) =>
    studentElectiveCourses.find(
      (course) => normalizeCourseIdentifier(course.code) === normalizeCourseIdentifier(code),
    ),
  );
  const selectedElectiveCourse = selectedElectiveCourses[0];
  const studentElectiveOptions = activeTrack
    ? activeTrackElectiveCourses
        .filter((course) =>
          trackElectiveCodes.some(
            (code) => normalizeCourseIdentifier(code) === normalizeCourseIdentifier(course.code),
          ),
        )
        .map((course) => ({
          ...course,
          seats: Math.max(8, 50 - course.enrollment),
          prereqs: course.prerequisites ?? [],
          semester: activeTrack.semester1.some(
            (code) => normalizeCourseIdentifier(code) === normalizeCourseIdentifier(course.code),
          )
            ? 1
            : 2,
        }))
        .sort((a, b) => a.semester - b.semester)
    : [
        {
          code: "AI 412",
          title: "Artificial Intelligence & Robotics",
          faculty: "Dr. Peter Yamak",
          credits: 3,
          seats: 8,
          prereqs: ["CS 201", "MATH 201"],
        },
        {
          code: "CS/IT 4131",
          title: "Cloud Application Development",
          faculty: "Prince Yanum",
          credits: 3,
          seats: 12,
          prereqs: ["CS 301"],
        },
        {
          code: "CS 425",
          title: "Distributed Systems & Cloud Computing",
          faculty: "Dr. E. Adjei",
          credits: 3,
          seats: 16,
          prereqs: ["CS 310"],
        },
      ];
  const timetableElectiveOptions = studentElectiveOptions.filter((course) => {
    if (
      !enrolledElectiveCodes.some(
        (code) => normalizeCourseIdentifier(code) === normalizeCourseIdentifier(course.code),
      )
    ) {
      return false;
    }
    return !isTrackDemo || ("semester" in course && course.semester === selectedSemester);
  });
  const selectedSemesterElectives = activeTrack
    ? selectedSemester === 1
      ? activeTrack.semester1
      : activeTrack.semester2
    : [];
  const studentPassedCourses = ["CS 101", "CS 102", "CS 201", "MATH 201", "CS 301"];
  const studentProgressionStatus = "Approved";

  const studentNav = [
    ["Home", "dashboard-square-01"],
    ["Timetable", "calendar-03"],
    ["Electives", "book-open-01"],
    ["Exams", "test-tube-01"],
    ["Export", "download-04"],
  ];

  const navigate = (label: string) => {
    const nextIndex = studentNav.findIndex(([l]) => l === label);
    const dir = nextIndex > prevIndexRef.current ? "right" : "left";
    setDirection(dir);
    setAnimKey((k) => k + 1);
    prevIndexRef.current = nextIndex >= 0 ? nextIndex : prevIndexRef.current;
    setActiveTab(label);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  // Apply major-specific split groups and show only the student's selected electives.
  const studentEvents = useMemo(() => {
    const regularCoreCourseCodes = new Set<string>();
    return [
      ...events,
      ...(selectedSemester === 1 ? trackCoreEventsSemester1 : []),
      ...activeTrackElectiveEvents,
    ].filter((event) => {
      if (event.semester !== selectedSemester) return false;
      if ((event.major !== studentMajor && event.major !== "ALL") || event.level !== studentLevel) {
        return false;
      }

      const course = findCourseForEvent(event, courses);
      if (event.group && event.group !== "All" && course?.requiresSplit) {
        const assignedGroup = getAssignedGroupForMajor(course, studentMajor);
        if (assignedGroup === undefined || event.group !== assignedGroup) return false;
      }

      const electiveCourse = getElectiveCourseForEvent(event, studentElectiveCourses);
      const isTrackElectiveEvent = trackElectiveCatalog.some((course) =>
        normalizeCourseIdentifier(event.code).includes(normalizeCourseIdentifier(course.code)),
      );
      if (isTrackDemo && electiveCourse) {
        return (
          event.id.startsWith("track-elective-") &&
          selectedSemesterElectives.some(
            (code) =>
              normalizeCourseIdentifier(code) === normalizeCourseIdentifier(electiveCourse.code),
          )
        );
      }

      if (!isTrackDemo && (electiveCourse || isTrackElectiveEvent)) {
        return (
          electiveCourse !== undefined &&
          activeTimetableElective !== "core" &&
          normalizeCourseIdentifier(activeTimetableElective) ===
            normalizeCourseIdentifier(electiveCourse.code)
        );
      }

      if (isTrackDemo) {
        return trackCoreCourseCodes.some((code) =>
          normalizeCourseIdentifier(event.code).includes(normalizeCourseIdentifier(code)),
        );
      }

      if (!isTrackDemo) {
        const courseCode = normalizeCourseIdentifier(event.code);
        if (!regularCoreCourseCodes.has(courseCode) && regularCoreCourseCodes.size >= 9) {
          return false;
        }
        regularCoreCourseCodes.add(courseCode);
      }

      return (
        !electiveCourse ||
        (activeTimetableElective !== "core" &&
          normalizeCourseIdentifier(activeTimetableElective) ===
            normalizeCourseIdentifier(electiveCourse.code))
      );
    });
  }, [
    activeTimetableElective,
    activeTrackElectiveEvents,
    events,
    isTrackDemo,
    selectedSemesterElectives,
    selectedSemester,
    studentElectiveCourses,
    studentMajor,
    studentLevel,
  ]);

  return (
    <main className="portal student-portal">
      <Header
        role="Student"
        onLogout={onLogout}
        onSwitchRole={onSwitchRole}
        userName={demoAccount.name}
        term={`${currentSemester} · 2025/26`}
      />

      <div key={animKey} className={`portal-content page-slide page-slide--${direction}`}>
        {/* =========================================================================
            STUDENT TAB 1: HOME (RADAR + GHANA HOLIDAYS + ACADEMIC STANDING)
            ========================================================================= */}
        {activeTab === "Home" && (
          <>
            <PageHeading
              eyebrow="STUDENT PORTAL · OVERVIEW"
              title={`Welcome back, ${demoAccount.name}.`}
              copy={`Bachelor of Science in ${studentMajor === "CS" ? "Computer Science" : studentMajor} · Level ${studentLevel} · ${activeTrack?.name ?? "Cohort 1 (September Intake)"}`}
              action={
                <button className="date-button" onClick={() => navigate("Timetable")}>
                  <Icon name="calendar-03" /> {currentSemester} · 2025/26
                </button>
              }
            />

            <NextClassRadar role="Student" />

            {/* Academic Standing & Ghana Statutory Holidays Grid */}
            <div className="admin-grid" style={{ marginTop: "24px" }}>
              {/* Academic Standing Card */}
              <section className="operations">
                <div className="section-title">
                  <div>
                    <span>ACADEMIC INTEGRITY</span>
                    <h3>Progression & Standing</h3>
                  </div>
                  <span className="badge-confirmed">
                    <Icon name="checkmark-circle-02" /> Good Standing
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginTop: "14px",
                  }}
                >
                  <div
                    style={{
                      padding: "12px",
                      background: "#f8f9fa",
                      borderRadius: "8px",
                      border: "1px solid #eee",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "#666" }}>CUMULATIVE GPA</span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "24px",
                        color: "#166534",
                        marginTop: "4px",
                      }}
                    >
                      3.72
                    </strong>
                    <small style={{ fontSize: "11px", color: "#555" }}>Dean's Honor List</small>
                  </div>
                  <div
                    style={{
                      padding: "12px",
                      background: "#f8f9fa",
                      borderRadius: "8px",
                      border: "1px solid #eee",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "#666" }}>DEGREE PROGRESS</span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "24px",
                        color: "#111",
                        marginTop: "4px",
                      }}
                    >
                      108 / 136
                    </strong>
                    <small style={{ fontSize: "11px", color: "#555" }}>Credits Earned</small>
                  </div>
                </div>
                <div style={{ marginTop: "14px", fontSize: "12px", color: "#666" }}>
                  Course groups are assigned automatically by major for each course. · Progression
                  Status: <b>Approved</b>
                </div>
              </section>

              {/* Ghana Statutory Holidays Widget */}
              <aside
                className="attention-card"
                style={{ background: "#fafafa", border: "1px solid #e0e0e0" }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ color: "#000" }}>GHANA STATUTORY HOLIDAYS</span>
                  <span className="muted-label">Semester 2 Observances</span>
                </div>
                <h3 style={{ marginTop: "6px" }}>Campus Holiday Calendar</h3>
                <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                  {ghanaHolidays.slice(0, 4).map((h) => (
                    <div
                      key={h.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: "6px",
                        fontSize: "11.5px",
                      }}
                    >
                      <span>
                        <strong>{h.name}</strong> ({h.day})
                      </span>
                      <b style={{ color: "#000" }}>{h.date}</b>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </>
        )}

        {/* =========================================================================
            STUDENT TAB 2: TIMETABLE SHEET
            ========================================================================= */}
        {activeTab === "Timetable" && (
          <>
            <PageHeading
              eyebrow="STUDENT PORTAL · SCHEDULE"
              title="Your Weekly Timetable."
              copy={
                isTrackDemo
                  ? `The admin has set ${currentSemester}. Your timetable shows 3 core courses and ${selectedSemesterElectives.length} ${selectedSemesterElectives.length === 1 ? "elective" : "electives"} from ${activeTrack.name} for this semester.`
                  : selectedElectives.length === 0
                    ? "Regular course load: up to 9 distinct core courses for the admin-selected semester."
                    : "Official 9-period Academic City University timetable matching Department of Informatics layout."
              }
              action={
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <StudentElectiveTrackSelect
                    value={selectedTrack}
                    tracks={electiveTracks}
                    onChange={handleTrackSelection}
                  />
                  {isTrackDemo ? (
                    <span className="badge-confirmed">
                      {currentSemester} electives: {selectedSemesterElectives.join(" · ")}
                    </span>
                  ) : (
                    <div className="tt-filter-item">
                      <span className="tt-filter-label">Elective schedule</span>
                      <select
                        className="tt-filter-select"
                        value={activeTimetableElective}
                        onChange={(event) => setActiveTimetableElective(event.target.value)}
                      >
                        <option value="core">Core courses only</option>
                        {timetableElectiveOptions.map((course) => (
                          <option key={course.code} value={course.code}>
                            {course.code} · {course.title.replace(/\s*\(Elective\)/i, "")}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <span className="badge-confirmed">Course groups assigned automatically</span>
                  {activeTrackSchedule.unscheduledCourseCodes.some((code) =>
                    code.endsWith(`Semester ${selectedSemester}`),
                  ) && (
                    <span className="badge-pending" role="alert">
                      Could not schedule all sessions for{" "}
                      {activeTrackSchedule.unscheduledCourseCodes
                        .filter((code) => code.endsWith(`Semester ${selectedSemester}`))
                        .join(", ")}
                      .
                    </span>
                  )}
                  <button className="timetable-print-btn" onClick={() => window.print()}>
                    <Icon name="file-export" /> Print / PDF
                  </button>
                  <TimetablePngButton
                    targetRef={timetableRef}
                    filename="academic-city-student-timetable.png"
                  />
                </div>
              }
            />

            <section ref={timetableRef} className="timetable-shell">
              <div className="timetable-toolbar">
                <div>
                  <strong>
                    Academic City University · Department of Informatics · Computer Science Level
                    400
                  </strong>
                  <span>
                    {isTrackDemo
                      ? `${currentSemester} · 3 core courses + ${selectedSemesterElectives.join(", ")}`
                      : `${currentSemester} · 2025/2026 Academic Year · Core courses + ${activeTimetableElective === "core" ? "no elective" : (selectedElectiveCourse?.code ?? activeTimetableElective)}`}
                  </span>
                </div>
              </div>

              <WeeklyTimetableGrid
                events={studentEvents}
                saturday={studentEvents.some((event) => event.day === 5)}
              />
            </section>
          </>
        )}

        {/* =========================================================================
            STUDENT TAB 3: ELECTIVE PREREQUISITE GATING MODULE
            Formula: Eligible = (Progression Status == "Approved") && Passed(Prereqs)
            ========================================================================= */}
        {activeTab === "Electives" && (
          <>
            <PageHeading
              eyebrow="STUDENT PORTAL · REGISTRATION"
              title="Elective Course Selection."
              copy={
                isTrackDemo
                  ? `The electives assigned to your selected track follow the admin's current semester automatically.`
                  : "Choose an elective track to see its semester-specific electives, or remain in the regular core programme."
              }
              action={
                <span className="badge-confirmed">
                  <Icon name="checkmark-circle-02" /> REGISTRATION OPEN
                </span>
              }
            />

            <section className="operations" style={{ marginTop: "16px" }}>
              <div className="section-title">
                <div>
                  <span>COMPUTER SCIENCE · LEVEL 400</span>
                  <h3>Choose Your Elective Track</h3>
                </div>
                <StudentElectiveTrackSelect
                  value={selectedTrack}
                  tracks={electiveTracks}
                  onChange={handleTrackSelection}
                />
              </div>
              <p style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
                Admin Settings controls the current semester ({currentSemester}); assigned
                sub-electives for that term appear automatically.
              </p>
            </section>

            {/* Selected Elective Feature Banner */}
            <div className="feature-banner">
              <div>
                <span>{isTrackDemo ? "YOUR SELECTED TRACK" : "YOUR CONFIRMED ELECTIVE"}</span>
                <h2>
                  {isTrackDemo
                    ? activeTrack.name
                    : (selectedElectiveCourse?.title.replace(/\s*\(Elective\)/i, "") ??
                      "No elective selected")}
                </h2>
                {isTrackDemo ? (
                  <p>
                    Semester 1: {activeTrack.semester1.join(", ")} · Semester 2:{" "}
                    {activeTrack.semester2.join(", ")}
                  </p>
                ) : (
                  selectedElectiveCourse && (
                    <p>
                      {selectedElectiveCourse.code} · {selectedElectiveCourse.credits} Credits ·{" "}
                      {selectedElectiveCourse.faculty}
                    </p>
                  )
                )}
              </div>
              <strong>
                {isTrackDemo
                  ? `${trackElectiveCodes.length} ELECTIVES`
                  : selectedElectiveCourse
                    ? "ENROLLED"
                    : "NO TRACK"}
              </strong>
            </div>

            <div className="section-title spaced">
              <h3>Available Electives</h3>
              <span className="muted-label">Prerequisite Gating Verified</span>
            </div>

            <div className="card-grid" style={{ marginTop: "16px" }}>
              {studentElectiveOptions.map((course) => {
                const passedPrereqs = course.prereqs.every((p) => studentPassedCourses.includes(p));
                const isEligible =
                  isTrackDemo || (studentProgressionStatus === "Approved" && passedPrereqs);
                const isSelected = enrolledElectiveCodes.includes(course.code);

                return (
                  <article
                    className={`course-card ${isSelected ? "selected" : ""}`}
                    key={course.code}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>
                        {course.code} · {course.credits} CREDITS
                        {"semester" in course ? ` · SEMESTER ${course.semester}` : ""}
                      </span>
                      {isEligible ? (
                        <span className="badge-confirmed" style={{ fontSize: "10px" }}>
                          Eligible
                        </span>
                      ) : (
                        <span className="badge-locked" style={{ fontSize: "10px", color: "#000" }}>
                          Prereq Missing
                        </span>
                      )}
                    </div>

                    <h3 style={{ marginTop: "8px" }}>{course.title}</h3>
                    <p>{course.faculty}</p>

                    <div style={{ margin: "8px 0", fontSize: "11px", color: "#666" }}>
                      Prerequisites: {course.prereqs.join(", ")}
                    </div>

                    <div>
                      <small>{course.seats} seats remaining</small>
                      {isTrackDemo ? (
                        <button type="button" disabled>
                          Enrolled · Semester {"semester" in course ? course.semester : 2}
                        </button>
                      ) : isEligible ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedElectives([course.code]);
                            setActiveTimetableElective(course.code);
                            alert(
                              `Enrolled into ${course.code} - ${course.title}. Timetable updated!`,
                            );
                          }}
                        >
                          {isSelected ? "Selected" : "Select Elective"}
                        </button>
                      ) : (
                        <button disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                          Locked (CS 310)
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* =========================================================================
            STUDENT TAB 4: EXAMINATIONS & DESK ALLOCATIONS
            ========================================================================= */}
        {activeTab === "Exams" && (
          <>
            <PageHeading
              eyebrow="STUDENT PORTAL · EXAMINATIONS"
              title="Your Confirmed Exam Timetable."
              copy="Semester 2 final examination schedule with designated hall seating and invigilator details."
              action={
                <button className="primary-action" onClick={() => window.print()}>
                  <Icon name="file-export" /> Download Exam Slip
                </button>
              }
            />

            <div className="notice-strip">
              <Icon name="notification-02" />
              <span>
                <strong>Venue Seating Notice:</strong> Social distancing seating is strictly
                enforced. Arrive 20 minutes before designated start time with your student ID card.
              </span>
            </div>

            <div className="data-list exams-list" style={{ marginTop: "20px" }}>
              {exams.map((ex) => (
                <article key={ex.id}>
                  <div className="date-block">
                    <strong>{ex.date.split(" ")[0]}</strong>
                    <span>{ex.date.split(" ")[1]}</span>
                  </div>
                  <time>{ex.time}</time>
                  <div>
                    <span>{ex.code}</span>
                    <h3>{ex.title}</h3>
                    <p>
                      <Icon name="building-03" /> {ex.venue} · <b>{ex.studentDesk}</b>
                    </p>
                  </div>
                  <span className="confirmed-text">Hall Slip Ready</span>
                </article>
              ))}
            </div>
          </>
        )}

        {/* =========================================================================
            STUDENT TAB 5: EXPORT & CALENDAR
            ========================================================================= */}
        {activeTab === "Export" && (
          <>
            <PageHeading
              eyebrow="STUDENT PORTAL · EXPORT"
              title="Export Your Schedule."
              copy="Download print-ready timetable sheets, iCalendar feeds, or examination hall slips."
            />
            <div className="export-grid">
              <article>
                <Icon name="pdf-02" />
                <h3>PDF Timetable</h3>
                <p>Official print-ready landscape weekly timetable sheet.</p>
                <button onClick={() => window.print()}>
                  Print / Download PDF <Icon name="download-04" />
                </button>
              </article>
              <article>
                <Icon name="calendar-03" />
                <h3>Apple & Google Calendar</h3>
                <p>Import all classes into your phone or calendar client via .ics file.</p>
                <button onClick={() => alert("StudentTimetable.ics downloaded.")}>
                  Download .ics <Icon name="download-04" />
                </button>
              </article>
              <article className="calendar-subscribe">
                <Icon name="link-04" />
                <h3>Live WebCal Feed</h3>
                <p>Automatic live schedule updates on your calendar.</p>
                <button onClick={() => alert("WebCal subscription link copied to clipboard.")}>
                  Copy Subscription URL <Icon name="copy-01" />
                </button>
              </article>
            </div>
          </>
        )}
      </div>

      <LiquidGlassBottomBar
        items={studentNav.map(([label, icon]) => ({ id: label, label, icon }))}
        selectedIndex={studentNav.findIndex(([l]) => l === activeTab)}
        onSelect={(idx) => navigate(studentNav[idx][0])}
      />
    </main>
  );
}

// ============================================================================
// MAIN APP COMPONENT (ROUTER & ROOT STATE)
// ============================================================================

export default function App() {
  const [portal, setPortal] = useState<Role | null>("Admin"); // Default to Admin for immediate review
  const [studentDemo, setStudentDemo] = useState<DemoAccount>(demos[0]);
  const [currentSemester, setCurrentSemester] = useState<"Semester 1" | "Semester 2">("Semester 1");
  const [saturdayEnabled, setSaturdayEnabled] = useState(false);
  const [events, setEvents] = useState<TimetableEvent[]>(initialMasterEvents);
  const [faculty, setFaculty] = useState<FacultyMember[]>(initialFaculty);
  const [rooms, setRooms] = useState<RoomFacility[]>(initialRooms);
  const [courses, setCourses] = useState<CourseData[]>(initialCourses);
  const [electiveTracks, setElectiveTracks] = useState<ElectiveTrack[]>(initialElectiveTracks);
  const [exams, setExams] = useState<ExamEntry[]>(initialExams);

  if (!portal) {
    return (
      <Login
        onSuccess={(role, email) => {
          if (role === "Student") {
            const selectedDemo = demos.find((demo) => demo.role === role && demo.email === email);
            setStudentDemo(selectedDemo ?? demos[0]);
          }
          setPortal(role);
        }}
      />
    );
  }

  if (portal === "Admin") {
    return (
      <AdminPortal
        events={events}
        setEvents={setEvents}
        faculty={faculty}
        setFaculty={setFaculty}
        rooms={rooms}
        setRooms={setRooms}
        courses={courses}
        setCourses={setCourses}
        electiveTracks={electiveTracks}
        setElectiveTracks={setElectiveTracks}
        exams={exams}
        setExams={setExams}
        currentSemester={currentSemester}
        setCurrentSemester={setCurrentSemester}
        saturdayEnabled={saturdayEnabled}
        setSaturdayEnabled={setSaturdayEnabled}
        onLogout={() => setPortal(null)}
        onSwitchRole={(r) => setPortal(r)}
      />
    );
  }

  if (portal === "Teacher") {
    return (
      <TeacherPortal
        events={events}
        setEvents={setEvents}
        faculty={faculty}
        setFaculty={setFaculty}
        rooms={rooms}
        courses={courses}
        saturdayEnabled={saturdayEnabled}
        onLogout={() => setPortal(null)}
        onSwitchRole={(r) => setPortal(r)}
      />
    );
  }

  return (
    <StudentPortal
      events={events}
      courses={courses}
      electiveTracks={electiveTracks}
      exams={exams}
      demoAccount={studentDemo}
      currentSemester={currentSemester}
      onLogout={() => setPortal(null)}
      onSwitchRole={(r) => setPortal(r)}
    />
  );
}
