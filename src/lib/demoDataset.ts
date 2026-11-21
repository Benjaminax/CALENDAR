import type {
  AcademicLevel,
  CourseData,
  FacultyMember,
  Programme,
  RoomFacility,
  TimetableEvent,
} from "../App";
import academicCatalogue from "../data/academic-catalogue.json";
import { ACADEMIC_PROGRAMMES } from "./academicProgrammes";
import { findClassroomTimeConflict } from "./timetableConflicts";

export interface DemoStudentRecord {
  id: string;
  name: string;
  email: string;
  major: Programme;
  level: AcademicLevel;
  cohort: "Cohort 1 (Sept)" | "Cohort 2 (Jan)";
  enrolledCourseCodes: string[];
}

export interface CampusDemoDataset {
  key: string;
  schemaVersion: number;
  faculty: FacultyMember[];
  students: DemoStudentRecord[];
  courses: CourseData[];
  events: TimetableEvent[];
  rooms: RoomFacility[];
}

interface BaseDataset {
  faculty: FacultyMember[];
  courses: CourseData[];
  events: TimetableEvent[];
  rooms: RoomFacility[];
}

const DATABASE_NAME = "academic-city-demo-database";
const DATABASE_VERSION = 1;
const DATA_STORE = "datasets";
const DATASET_KEY = "campus-load-test";
const DATASET_SCHEMA_VERSION = 12;
const TARGET_FACULTY_COUNT = 50;
const TARGET_STUDENT_COUNT = 1200;
const ACADEMIC_LEVELS: AcademicLevel[] = ["100", "200", "300", "400"];
const COURSES_PER_PROGRAMME_TERM = 3;
const DAILY_SLOT_COUNT = 9;
const PROGRAMME_CODES = ACADEMIC_PROGRAMMES.map((programme) => programme.code);
const SEMESTERS = [1, 2] as const;
const syntheticFacultyDepartments = [
  ...Array<string>(7).fill("Business Administration and Entrepreneurship"),
  ...Array<string>(4).fill("Communication Arts"),
  ...Array<string>(7).fill("Electrical, Electronics & Computer Engineering"),
  ...Array<string>(7).fill("Mechanical, Industrial & Systems Engineering"),
  ...Array<string>(3).fill("Biomedical Engineering"),
  ...Array<string>(5).fill("Computational Sciences"),
  ...Array<string>(7).fill("Informatics"),
];

const legacyFacultyDepartments: Record<string, string> = {
  "Informatics & Computer Science": "Computational Sciences",
  "Cyber Security & Networks": "Electrical, Electronics & Computer Engineering",
  "Artificial Intelligence & Robotics": "Mechanical, Industrial & Systems Engineering",
  "Software Engineering": "Informatics",
  "Mobile & Web Technologies": "Informatics",
  "Network & Infrastructure": "Electrical, Electronics & Computer Engineering",
  "Cloud & Distributed Systems": "Informatics",
  "Professional Development & Careers": "Business Administration and Entrepreneurship",
  "Computational Sciences": "Computational Sciences",
  "Data Analytics & Statistics": "Computational Sciences",
};

const academicCityFacultyNames = [
  "Abdul Razak Sulemana",
  "Bismark Budu",
  "Christian Kojo Akumaglo",
  "Desmond Adusah",
  "Dr Aaron Agbeshie Agorsor",
  "Dr Abdul Rahim Adada Mohammed",
  "Dr Hephzi Angela Tagoe",
  "Dr Mark Yama Tampuri",
  "Dr Paul Appiah Konadu",
  "Dr Paul Kwabena Obeng",
  "Dr Raymond Nwinikom Dumeh",
  "Dr Reginald Arthur",
  "Dr Yiporo Danyuo",
  "Ebenezer Nyamekye Nkrumah",
  "Emmanuel Kwame Yeboah",
  "Emmanuel Prah",
  "Felix Ofori",
  "George Boateng Ansah",
  "Gertrude Oforiwaa Brako",
  "Isaac Afari Addo",
  "John Yirijor",
  "Louis Kwesi Sekyere Darko",
  "Michael Mensah",
  "Michael Yamoah",
  "Professor Benjamin Jabez Botwe Nyarko",
  "Racheal Abrokwah",
  "Ramael Ekua Darko",
  "Rebecca Awerigiya",
  "Sheriff Adonoo",
  "Julius Kwaku Amegadzie",
  "Dr Joshua Tuah Asante",
  "Ebenezer Yeboah",
  "Dr Nana Akua Owusu Ansah",
  "Dr Edward Oscar Ampoansah-Abu",
  "Grace Ofeibea Ofori-Agyei",
  "Rita Oku",
  "Nana Kojo Dadzie",
  "Dr Felix Kwame Nyarko",
  "Christian Priestly Kofi Dagadu",
  "Eulalia Kangwongnuah",
];

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support the local demo database."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DATA_STORE)) {
        request.result.createObjectStore(DATA_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("The local demo database could not be opened."));
    };
    request.onblocked = () => {
      reject(new Error("The local demo database is blocked by another open app tab."));
    };
  });
}

function getSlotKey(semester: number, day: number, slot: number) {
  return `${semester}:${day}:${slot}`;
}

function getTeachingSlotKeys(event: TimetableEvent) {
  return Array.from({ length: Math.max(1, event.span) }, (_, index) =>
    getSlotKey(event.semester, event.day, event.start + index),
  );
}

type CatalogueCourse = (typeof academicCatalogue.courses)[number];

function normalizeCourseIdentifier(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getCourseKey(
  programme: Programme,
  level: AcademicLevel,
  course: Pick<CatalogueCourse, "code" | "title">,
) {
  return `${programme}:${level}:${normalizeCourseIdentifier(course.code)}:${normalizeCourseIdentifier(course.title)}`;
}

function getCourseContactHours(course: CatalogueCourse) {
  const lectureHours = course.lectureHours ?? 0;
  const tutorialHours = course.tutorialHours ?? 0;
  const practicalHours = course.practicalHours ?? 0;
  return {
    lectureHours,
    tutorialHours,
    practicalHours,
  };
}

function getCatalogueCourses(
  programme: (typeof ACADEMIC_PROGRAMMES)[number],
  level: AcademicLevel,
  semester: (typeof SEMESTERS)[number],
) {
  const eligible = (course: CatalogueCourse) =>
    course.programmeId === programme.catalogueId &&
    course.level === level &&
    course.semester === semester &&
    typeof course.credits === "number" &&
    course.credits > 0 &&
    !/XX/i.test(course.code) &&
    course.title.trim().length > 0;
  const coreCourses = academicCatalogue.courses.filter(
    (course) => eligible(course) && course.section === "course-diet",
  );
  const fallbackCourses =
    coreCourses.length >= COURSES_PER_PROGRAMME_TERM
      ? []
      : academicCatalogue.courses.filter(
          (course) =>
            eligible(course) &&
            (course.section === "elective-options" || course.section === "specialisation-options"),
        );
  const candidates = [...coreCourses, ...fallbackCourses];
  const programmeCourses = candidates.filter((course) =>
    normalizeCourseIdentifier(course.code).startsWith(programme.code),
  );
  const otherCourses = candidates.filter(
    (course) =>
      !normalizeCourseIdentifier(course.code).startsWith(programme.code) &&
      !normalizeCourseIdentifier(course.code).startsWith("UC"),
  );
  const commonCourses = candidates.filter((course) =>
    normalizeCourseIdentifier(course.code).startsWith("UC"),
  );
  const selected: CatalogueCourse[] = [];
  const seenCodes = new Set<string>();

  for (const course of [...programmeCourses, ...otherCourses, ...commonCourses]) {
    const code = normalizeCourseIdentifier(course.code);
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    selected.push(course);
    if (selected.length === COURSES_PER_PROGRAMME_TERM) break;
  }

  if (selected.length !== COURSES_PER_PROGRAMME_TERM) {
    throw new Error(
      `${programme.name} Level ${level} Semester ${semester} has fewer than ${COURSES_PER_PROGRAMME_TERM} usable catalogue courses.`,
    );
  }

  return selected;
}

function getMeetingSpans(courseOrdinal: number): [number, number] {
  return courseOrdinal % 12 === 0 ? [2, 3] : [2, 2];
}

function createSyntheticFaculty(baseFaculty: FacultyMember[]): FacultyMember[] {
  const missingCount = Math.max(0, TARGET_FACULTY_COUNT - baseFaculty.length);
  if (missingCount > academicCityFacultyNames.length) {
    throw new Error(
      "There are not enough listed faculty names to create the requested demo staff.",
    );
  }

  return Array.from({ length: missingCount }, (_, index) => {
    const number = baseFaculty.length + index + 1;
    return {
      id: `demo-lecturer-${number}`,
      name: academicCityFacultyNames[index],
      department: syntheticFacultyDepartments[index % syntheticFacultyDepartments.length],
      email: `lecturer${String(number).padStart(2, "0")}@demo.test`,
      confirmed: false,
      confirmedAt: null,
      loadHours: 0,
      unavailability: [],
    };
  });
}

function createSyntheticStudents(): DemoStudentRecord[] {
  const students: DemoStudentRecord[] = [];
  const groupsCount = ACADEMIC_PROGRAMMES.length * ACADEMIC_LEVELS.length;
  const studentsPerGroup = Math.floor(TARGET_STUDENT_COUNT / groupsCount);
  const largerGroupCount = TARGET_STUDENT_COUNT % groupsCount;

  ACADEMIC_PROGRAMMES.forEach((programme, programmeIndex) => {
    ACADEMIC_LEVELS.forEach((level, levelIndex) => {
      const groupIndex = programmeIndex * ACADEMIC_LEVELS.length + levelIndex;
      const groupSize = studentsPerGroup + (groupIndex < largerGroupCount ? 1 : 0);
      const firstCohortSize = Math.ceil(groupSize / 2);

      for (let studentIndex = 0; studentIndex < groupSize; studentIndex += 1) {
        const number = students.length + 1;
        students.push({
          id: `demo-student-${String(number).padStart(4, "0")}`,
          name: `Demo Student ${String(number).padStart(4, "0")}`,
          email: `student${String(number).padStart(4, "0")}@demo.test`,
          major: programme.code,
          level,
          cohort: studentIndex < firstCohortSize ? "Cohort 1 (Sept)" : "Cohort 2 (Jan)",
          enrolledCourseCodes: [],
        });
      }
    });
  });

  return students;
}

function createDemoDataset(
  base: BaseDataset,
  additionalReservedEvents: TimetableEvent[],
): CampusDemoDataset {
  const syntheticFaculty = createSyntheticFaculty(base.faculty);
  const faculty = [...base.faculty, ...syntheticFaculty];
  const students = createSyntheticStudents();
  const courses = base.courses.map((course) => ({ ...course }));
  const events: TimetableEvent[] = [...base.events];
  const occupiedTeachers = new Set<string>();
  const occupiedRooms = new Set<string>();
  const occupiedCohorts = new Set<string>();
  const baseCohorts = new Set<string>();
  const studentCourseSets = new Map(students.map((student) => [student.id, new Set<string>()]));
  const courseRecords = new Map<string, CourseData>();
  const courseTeachers = new Map<string, FacultyMember>();
  const nextTeacherIndexByDepartment = new Map<string, number>();

  const reserveEvent = (event: TimetableEvent, isGenerated: boolean) => {
    for (const slotKey of getTeachingSlotKeys(event)) {
      occupiedTeachers.add(`${event.person}:${slotKey}`);
      occupiedRooms.add(`${event.room}:${slotKey}`);
      const cohortSlots = isGenerated ? occupiedCohorts : baseCohorts;
      if (event.major === "ALL") {
        for (const programme of PROGRAMME_CODES) {
          cohortSlots.add(`${programme}:${event.level}:${slotKey}`);
        }
      } else {
        cohortSlots.add(`${event.major}:${event.level}:${slotKey}`);
      }
    }
  };

  const releaseGeneratedEvent = (event: TimetableEvent) => {
    for (const slotKey of getTeachingSlotKeys(event)) {
      occupiedTeachers.delete(`${event.person}:${slotKey}`);
      occupiedRooms.delete(`${event.room}:${slotKey}`);
      if (event.major === "ALL") {
        for (const programme of PROGRAMME_CODES) {
          occupiedCohorts.delete(`${programme}:${event.level}:${slotKey}`);
        }
      } else {
        occupiedCohorts.delete(`${event.major}:${event.level}:${slotKey}`);
      }
    }
  };

  [...base.events, ...additionalReservedEvents].forEach((event) => reserveEvent(event, false));

  const lectureRooms = base.rooms.filter(
    (room) => room.type !== "Lab" && room.status !== "Maintenance",
  );
  const labRooms = base.rooms.filter(
    (room) => room.type === "Lab" && room.status !== "Maintenance",
  );
  if (lectureRooms.length === 0) {
    throw new Error("The demo timetable needs an available lecture room.");
  }

  const offerings = ACADEMIC_PROGRAMMES.flatMap((programme) =>
    ACADEMIC_LEVELS.flatMap((level) =>
      SEMESTERS.map((semester) => ({
        programme,
        level,
        semester,
        students: students.filter(
          (student) =>
            student.major === programme.code &&
            student.level === level &&
            (level !== "100" || semester !== 1 || student.cohort === "Cohort 1 (Sept)"),
        ),
        catalogueCourses: getCatalogueCourses(programme, level, semester),
      })),
    ),
  );

  for (const [offeringIndex, offering] of offerings.entries()) {
    const { programme, level, students: cohortStudents } = offering;
    const departmentFaculty = faculty.filter(
      (member) =>
        member.department === programme.department ||
        legacyFacultyDepartments[member.department] === programme.department,
    );
    if (departmentFaculty.length === 0) {
      throw new Error(`No demo lecturers are available for ${programme.department}.`);
    }

    offering.catalogueCourses.forEach((catalogueCourse, courseIndex) => {
      const courseKey = getCourseKey(programme.code, level, catalogueCourse);
      const courseOrdinal =
        Math.floor(offeringIndex / SEMESTERS.length) * COURSES_PER_PROGRAMME_TERM + courseIndex;
      const meetingSpans = getMeetingSpans(courseOrdinal);
      let course = courseRecords.get(courseKey);
      if (!course) {
        const existingBaseCourse = courses.find(
          (candidate) =>
            !candidate.programme &&
            normalizeCourseIdentifier(candidate.code) ===
              normalizeCourseIdentifier(catalogueCourse.code) &&
            normalizeCourseIdentifier(candidate.title) ===
              normalizeCourseIdentifier(catalogueCourse.title),
        );
        const existingTeacher = existingBaseCourse
          ? faculty.find((member) => member.name === existingBaseCourse.faculty)
          : undefined;
        const teacherIndex = nextTeacherIndexByDepartment.get(programme.department) ?? 0;
        const teacher =
          existingTeacher ?? departmentFaculty[teacherIndex % departmentFaculty.length];
        if (!existingTeacher) {
          nextTeacherIndexByDepartment.set(programme.department, teacherIndex + 1);
        }
        courseTeachers.set(courseKey, teacher);

        const { lectureHours, tutorialHours, practicalHours } =
          getCourseContactHours(catalogueCourse);
        const courseRecord: CourseData = existingBaseCourse ?? {
          code: catalogueCourse.code,
          title: catalogueCourse.title,
          department: programme.department,
          credits: catalogueCourse.credits ?? 0,
          lectureHours: lectureHours + tutorialHours,
          labHours: practicalHours,
          weeklySessionHours: meetingSpans,
          enrollment: cohortStudents.length,
          faculty: teacher.name,
          requiresSplit: false,
          groupAllocation: "Single Group",
          examPaperStatus: "Submitted",
        };
        courseRecord.weeklySessionHours = meetingSpans;
        courseRecord.programme = programme.code;
        courseRecord.level = level;
        courseRecord.enrollment = Math.max(courseRecord.enrollment, cohortStudents.length);
        if (existingBaseCourse && !existingTeacher) {
          courseRecord.faculty = teacher.name;
        }
        if (!existingBaseCourse) courses.push(courseRecord);
        courseRecords.set(courseKey, courseRecord);
        course = courseRecord;
      }

      cohortStudents.forEach((student) => {
        const enrolledCodes = studentCourseSets.get(student.id);
        if (!enrolledCodes?.has(course.code)) {
          student.enrolledCourseCodes.push(course.code);
          enrolledCodes?.add(course.code);
        }
      });
    });
  }

  let sessionOrdinal = 0;
  for (const [offeringIndex, offering] of offerings.entries()) {
    const { programme, level, semester, students: cohortStudents, catalogueCourses } = offering;
    const levelIndex = ACADEMIC_LEVELS.indexOf(level);

    for (const [courseIndex, catalogueCourse] of catalogueCourses.entries()) {
      const courseKey = getCourseKey(programme.code, level, catalogueCourse);
      const course = courseRecords.get(courseKey);
      const preferredTeacher = courseTeachers.get(courseKey);
      if (!course || !preferredTeacher) {
        throw new Error(`The demo course assignment for ${catalogueCourse.code} is incomplete.`);
      }

      const departmentFaculty = faculty.filter(
        (member) =>
          member.department === programme.department ||
          legacyFacultyDepartments[member.department] === programme.department,
      );
      const candidateTeachers = [
        preferredTeacher,
        ...departmentFaculty.filter((member) => member.id !== preferredTeacher.id),
      ];
      const courseOrdinal =
        Math.floor(offeringIndex / SEMESTERS.length) * COURSES_PER_PROGRAMME_TERM + courseIndex;
      const meetingSpans = getMeetingSpans(courseOrdinal);
      const { lectureHours, tutorialHours, practicalHours } =
        getCourseContactHours(catalogueCourse);
      const hasLecture = lectureHours + tutorialHours > 0;
      let scheduledCourseEvents: TimetableEvent[] | undefined;
      let assignedTeacher: FacultyMember | undefined;

      for (const teacher of candidateTeachers) {
        const tentativeEvents: TimetableEvent[] = [];
        let firstMeetingDay: number | null = null;
        let nextSessionOrdinal = sessionOrdinal;
        let canScheduleCourse = true;

        for (let meetingIndex = 0; meetingIndex < meetingSpans.length; meetingIndex += 1) {
          let scheduledEvent: TimetableEvent | null = null;
          const span = meetingSpans[meetingIndex];
          const isPracticalMeeting = practicalHours > 0 && (!hasLecture || meetingIndex === 1);
          const preferredRooms = isPracticalMeeting ? labRooms : lectureRooms;
          const otherRooms = isPracticalMeeting ? lectureRooms : labRooms;
          const candidateRooms = [...preferredRooms, ...otherRooms].filter(
            (room) => room.capacity >= cohortStudents.length,
          );
          const slotsPerDay = DAILY_SLOT_COUNT - span + 1;
          const candidateCount = 5 * slotsPerDay;
          const preferredDay = (levelIndex + courseIndex * 2 + semester - 1) % 5;
          const preferredCandidate =
            preferredDay * slotsPerDay + ((nextSessionOrdinal * 3) % slotsPerDay);

          for (
            let allowBaseCohortOverlap = 0;
            allowBaseCohortOverlap <= 1 && !scheduledEvent;
            allowBaseCohortOverlap += 1
          ) {
            for (let attempt = 0; attempt < candidateCount && !scheduledEvent; attempt += 1) {
              const candidate = (preferredCandidate + attempt) % candidateCount;
              const day = Math.floor(candidate / slotsPerDay);
              const start = candidate % slotsPerDay;
              if (firstMeetingDay === day) continue;

              const slots = Array.from({ length: span }, (_, index) =>
                getSlotKey(semester, day, start + index),
              );
              const teacherUnavailable = teacher.unavailability.some(
                (item) => item.day === day && item.slot >= start && item.slot < start + span,
              );
              const cohortConflict = slots.some((slotKey) =>
                occupiedCohorts.has(`${programme.code}:${level}:${slotKey}`),
              );
              const conflictsWithBaseCohort = slots.some((slotKey) =>
                baseCohorts.has(`${programme.code}:${level}:${slotKey}`),
              );
              if (
                teacherUnavailable ||
                cohortConflict ||
                (allowBaseCohortOverlap === 0 && conflictsWithBaseCohort)
              ) {
                continue;
              }
              if (slots.some((slotKey) => occupiedTeachers.has(`${teacher.name}:${slotKey}`))) {
                continue;
              }

              const room = candidateRooms.find((item) =>
                slots.every((slotKey) => !occupiedRooms.has(`${item.code}:${slotKey}`)),
              );
              if (!room) continue;

              scheduledEvent = {
                id: `demo-event-${programme.code.toLowerCase()}-${level}-${semester}-${courseIndex + 1}-${meetingIndex + 1}`,
                code: course.code,
                title: course.title,
                person: teacher.name,
                room: room.code,
                day,
                start,
                span,
                major: programme.code,
                level,
                semester,
                group: "All",
                cohort: level === "100" && semester === 1 ? "Cohort 1 (Sept)" : "Both",
                type: isPracticalMeeting ? "Practical" : "Lecture",
              };
              reserveEvent(scheduledEvent, true);
              tentativeEvents.push(scheduledEvent);
              if (firstMeetingDay === null) firstMeetingDay = day;
            }
          }

          if (!scheduledEvent) {
            canScheduleCourse = false;
            break;
          }
          nextSessionOrdinal += 1;
        }

        if (canScheduleCourse) {
          scheduledCourseEvents = tentativeEvents;
          assignedTeacher = teacher;
          sessionOrdinal = nextSessionOrdinal;
          break;
        }

        tentativeEvents.forEach(releaseGeneratedEvent);
      }

      if (!scheduledCourseEvents || !assignedTeacher) {
        throw new Error(
          `The demo timetable could not schedule ${course.code} for ${programme.name} Level ${level} twice in Semester ${semester} with the available faculty, rooms, and cohort slots.`,
        );
      }

      course.faculty = assignedTeacher.name;
      courseTeachers.set(courseKey, assignedTeacher);
      events.push(...scheduledCourseEvents);
    }
  }

  const facultyWithLoads = faculty.map((member) => {
    if (!member.id.startsWith("demo-lecturer-")) return member;
    const semesterLoads = SEMESTERS.map((semester) =>
      events
        .filter((event) => event.person === member.name && event.semester === semester)
        .reduce((hours, event) => hours + event.span, 0),
    );
    return { ...member, loadHours: Math.max(...semesterLoads) };
  });

  const roomConflict = findClassroomTimeConflict(events);
  if (roomConflict) {
    throw new Error(
      `${roomConflict.room} is double-booked by ${roomConflict.first.code} and ${roomConflict.second.code}.`,
    );
  }

  return {
    key: DATASET_KEY,
    schemaVersion: DATASET_SCHEMA_VERSION,
    faculty: facultyWithLoads,
    students,
    courses,
    events,
    rooms: base.rooms,
  };
}

export async function loadOrSeedDemoDataset(
  base: BaseDataset,
  additionalReservedEvents: TimetableEvent[] = [],
): Promise<CampusDemoDataset> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let dataset: CampusDemoDataset | undefined;
    let failure: Error | undefined;
    const transaction = database.transaction(DATA_STORE, "readwrite");
    const store = transaction.objectStore(DATA_STORE);
    const request = store.get(DATASET_KEY);

    request.onsuccess = () => {
      try {
        const saved = request.result as CampusDemoDataset | undefined;
        if (saved?.schemaVersion === DATASET_SCHEMA_VERSION && Array.isArray(saved.events)) {
          if (findClassroomTimeConflict(saved.events)) {
            dataset = createDemoDataset(base, additionalReservedEvents);
            store.put(dataset);
          } else {
            dataset = saved;
          }
        } else {
          dataset = createDemoDataset(base, additionalReservedEvents);
          store.put(dataset);
        }
      } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error));
        transaction.abort();
      }
    };
    request.onerror = () => {
      failure = request.error ?? new Error("The local demo dataset could not be read.");
    };
    transaction.oncomplete = () => {
      database.close();
      if (dataset) {
        resolve(dataset);
      } else {
        reject(failure ?? new Error("The local demo dataset was not available after loading."));
      }
    };
    transaction.onerror = () => {
      database.close();
      reject(
        failure ?? transaction.error ?? new Error("The local demo dataset could not be saved."),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(
        failure ??
          transaction.error ??
          new Error("The local demo dataset transaction was interrupted."),
      );
    };
  });
}

export async function saveDemoDataset(
  dataset: Omit<CampusDemoDataset, "key" | "schemaVersion">,
): Promise<void> {
  const roomConflict = findClassroomTimeConflict(dataset.events);
  if (roomConflict) {
    throw new Error(
      `${roomConflict.room} is double-booked by ${roomConflict.first.code} and ${roomConflict.second.code}.`,
    );
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATA_STORE, "readwrite");
    transaction.objectStore(DATA_STORE).put({
      ...dataset,
      key: DATASET_KEY,
      schemaVersion: DATASET_SCHEMA_VERSION,
    });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("The local demo dataset could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("The local demo dataset save was interrupted."));
    };
  });
}
