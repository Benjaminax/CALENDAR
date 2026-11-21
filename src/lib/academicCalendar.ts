export type AcademicSemesterName = "Semester 1" | "Semester 2";
export type CalendarEntryType = "Holiday" | "Mid-semester break" | "Vacate" | "University event";
export type CalendarAudience = "All" | "Students" | "Lecturers";
export type CalendarEntrySource = "admin" | "holiday-library";

export interface AcademicCalendarEntry {
  id: string;
  title: string;
  type: CalendarEntryType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  audience: CalendarAudience;
  description: string;
  source: CalendarEntrySource;
}

export interface AcademicSemesterCalendar {
  key: string;
  academicYear: string;
  semester: AcademicSemesterName;
  startDate: string;
  endDate: string;
  entries: AcademicCalendarEntry[];
}

export interface ParsedAcademicCalendarSpreadsheet {
  academicYear?: string;
  semester?: AcademicSemesterName;
  semesterStartDate?: string;
  semesterEndDate?: string;
  entries: AcademicCalendarEntry[];
}

const DATABASE_NAME = "academic-city-local-calendar";
const DATABASE_VERSION = 2;
const CALENDAR_STORE = "semester-calendars";
const SETTINGS_STORE = "app-settings";

export function getSemesterCalendarKey(
  academicYear: string,
  semester: AcademicSemesterName,
) {
  return `${academicYear.trim()}::${semester}`;
}

export function createEmptySemesterCalendar(
  academicYear: string,
  semester: AcademicSemesterName,
): AcademicSemesterCalendar {
  return {
    key: getSemesterCalendarKey(academicYear, semester),
    academicYear,
    semester,
    startDate: "",
    endDate: "",
    entries: [],
  };
}

function openCalendarDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support a local calendar database."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CALENDAR_STORE)) {
        database.createObjectStore(CALENDAR_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("The local calendar database could not be opened."));
    };
    request.onblocked = () => {
      reject(new Error("The local calendar database is blocked by another open app tab."));
    };
  });
}

export async function loadActiveAcademicTerm(): Promise<{
  academicYear: string;
  semester: AcademicSemesterName;
} | null> {
  const database = await openCalendarDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE, "readonly");
    const request = transaction.objectStore(SETTINGS_STORE).get("active-term");
    request.onsuccess = () =>
      resolve(
        (request.result as
          | { academicYear: string; semester: AcademicSemesterName }
          | undefined) ?? null,
      );
    request.onerror = () => {
      reject(request.error ?? new Error("The active academic term could not be loaded."));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("The active academic term read was interrupted."));
    };
    transaction.oncomplete = () => database.close();
  });
}

export async function saveActiveAcademicTerm(
  academicYear: string,
  semester: AcademicSemesterName,
): Promise<void> {
  const database = await openCalendarDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE, "readwrite");
    transaction.objectStore(SETTINGS_STORE).put({
      key: "active-term",
      academicYear,
      semester,
    });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("The active academic term could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("The active academic term save was interrupted."));
    };
  });
}

export async function loadSemesterCalendar(
  academicYear: string,
  semester: AcademicSemesterName,
): Promise<AcademicSemesterCalendar | null> {
  const database = await openCalendarDatabase();
  const key = getSemesterCalendarKey(academicYear, semester);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CALENDAR_STORE, "readonly");
    const request = transaction.objectStore(CALENDAR_STORE).get(key);
    request.onsuccess = () => resolve((request.result as AcademicSemesterCalendar | undefined) ?? null);
    request.onerror = () => {
      reject(request.error ?? new Error("The semester calendar could not be loaded."));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("The semester calendar read was interrupted."));
    };
    transaction.oncomplete = () => database.close();
  });
}

export async function saveSemesterCalendar(calendar: AcademicSemesterCalendar): Promise<void> {
  const expectedKey = getSemesterCalendarKey(calendar.academicYear, calendar.semester);
  if (calendar.key !== expectedKey) {
    throw new Error("The semester calendar key does not match its academic year and semester.");
  }
  if ((calendar.startDate && !calendar.endDate) || (!calendar.startDate && calendar.endDate)) {
    throw new Error("Enter both the semester start date and end date.");
  }
  if (calendar.startDate && calendar.startDate > calendar.endDate) {
    throw new Error("The semester end date must be on or after the start date.");
  }

  const database = await openCalendarDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CALENDAR_STORE, "readwrite");
    transaction.objectStore(CALENDAR_STORE).put(calendar);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("The semester calendar could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("The semester calendar save was interrupted."));
    };
  });
}

function formatCalendarDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addYears(date: Date, count: number) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + count);
  return result;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getGhanaPublicHolidays(
  semesterStartDate?: string,
  semesterEndDate?: string,
): Promise<AcademicCalendarEntry[]> {
  const today = formatCalendarDate(new Date());
  const startDate = semesterStartDate || today;
  const endDate =
    semesterEndDate || formatCalendarDate(addYears(new Date(`${startDate}T00:00:00`), 2));
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const entries: AcademicCalendarEntry[] = [];
  const { default: Holidays } = await import("date-holidays");
  const holidayLibrary = new Holidays("GH", {
    languages: ["en"],
    timezone: "Africa/Accra",
    types: ["public"],
  });

  for (let year = startYear; year <= endYear; year += 1) {
    for (const holiday of holidayLibrary.getHolidays(year, "en")) {
      if (holiday.type !== "public") continue;

      const start = holiday.date.slice(0, 10);
      const durationDays = Math.max(
        1,
        Math.ceil((holiday.end.getTime() - holiday.start.getTime()) / (24 * 60 * 60 * 1000)),
      );
      const endDateValue = new Date(`${start}T00:00:00Z`);
      endDateValue.setUTCDate(endDateValue.getUTCDate() + durationDays - 1);
      const end = formatCalendarDate(endDateValue);
      if (end < startDate || start > endDate) continue;

      entries.push({
        id: `ghana-${start}-${slug(holiday.name)}`,
        title: holiday.name,
        type: "Holiday",
        startDate: start,
        endDate: end,
        startTime: "",
        endTime: "",
        audience: "All",
        description: /eid|ramadan/i.test(holiday.name)
          ? "Calculated date; check official announcements for lunar calendar updates."
          : holiday.substitute
            ? "Ghana public holiday (substitute date)."
            : "Ghana public holiday.",
        source: "holiday-library",
      });
    }
  }

  return entries;
}

export async function getSemesterCalendarEntries(
  calendar: AcademicSemesterCalendar,
): Promise<AcademicCalendarEntry[]> {
  const publicHolidays = await getGhanaPublicHolidays(calendar.startDate, calendar.endDate);
  const uniqueEntries = new Map<string, AcademicCalendarEntry>();

  for (const entry of [...publicHolidays, ...calendar.entries]) {
    const key = `${entry.title.trim().toLowerCase()}|${entry.startDate}|${entry.endDate}`;
    uniqueEntries.set(key, entry);
  }

  return [...uniqueEntries.values()].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title),
  );
}

export function getUpcomingCalendarEntries(
  entries: AcademicCalendarEntry[],
  audience: Exclude<CalendarAudience, "All">,
  limit = 6,
): AcademicCalendarEntry[] {
  const today = formatCalendarDate(new Date());
  return entries
    .filter(
      (entry) =>
        entry.endDate >= today && (entry.audience === "All" || entry.audience === audience),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function getCellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  return String(value).trim();
}

function parseDateCell(value: unknown, column: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = getCellText(value);
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${column} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`${column} contains an invalid date.`);
  }
  return text;
}

function parseTimeCell(value: unknown, column: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  const text = getCellText(value);
  if (text === "") return "";
  if (typeof text !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new Error(`${column} must use 24-hour HH:MM format.`);
  }
  return text;
}

function parseEntryType(value: unknown): CalendarEntryType {
  const text = getCellText(value);
  const normalized = (typeof text === "string" ? text : "").toLowerCase().replace(/[\s_-]+/g, "");
  const options: Record<string, CalendarEntryType> = {
    holiday: "Holiday",
    midsemesterbreak: "Mid-semester break",
    midterm: "Mid-semester break",
    midtermbreak: "Mid-semester break",
    vacate: "Vacate",
    universityevent: "University event",
    event: "University event",
  };
  const type = options[normalized];
  if (!type) {
    throw new Error(
      "Type must be Holiday, Mid-semester break, Vacate, or University event.",
    );
  }
  return type;
}

function parseAudience(value: unknown): CalendarAudience {
  const text = getCellText(value);
  const normalized = (typeof text === "string" ? text : "").toLowerCase();
  if (!normalized || normalized === "all") return "All";
  if (normalized === "student" || normalized === "students") return "Students";
  if (normalized === "lecturer" || normalized === "lecturers" || normalized === "faculty") {
    return "Lecturers";
  }
  throw new Error("Audience must be All, Students, or Lecturers.");
}

function createEntryId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseRows(rows: unknown[][]): ParsedAcademicCalendarSpreadsheet {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) throw new Error("The spreadsheet is empty.");

  const headers = headerRow.map((value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, ""),
  );
  const required = ["title", "type", "startdate", "enddate"];
  const missing = required.filter((name) => !headers.includes(name));
  if (missing.length > 0) {
    throw new Error(`Missing required spreadsheet columns: ${missing.join(", ")}.`);
  }
  const cell = (row: unknown[], name: string) => {
    const index = headers.indexOf(name);
    return index < 0 ? "" : row[index];
  };
  const entries: AcademicCalendarEntry[] = [];
  let academicYear: string | undefined;
  let semester: AcademicSemesterName | undefined;
  let semesterStartDate: string | undefined;
  let semesterEndDate: string | undefined;

  dataRows.forEach((row, index) => {
    if (row.every((value) => getCellText(value) === "")) return;
    const rowNumber = index + 2;
    try {
      const titleValue = getCellText(cell(row, "title"));
      if (typeof titleValue !== "string" || !titleValue) {
        throw new Error("Title is required.");
      }
      const startDate = parseDateCell(cell(row, "startdate"), "startDate");
      const endDateValue = getCellText(cell(row, "enddate"));
      const endDate =
        endDateValue === "" ? startDate : parseDateCell(cell(row, "enddate"), "endDate");
      if (endDate < startDate) throw new Error("endDate must be on or after startDate.");

      const startTime = parseTimeCell(cell(row, "starttime"), "startTime");
      const endTime = parseTimeCell(cell(row, "endtime"), "endTime");
      if ((startTime && !endTime) || (!startTime && endTime)) {
        throw new Error("Enter both startTime and endTime, or leave both blank for an all-day event.");
      }
      if (startTime && endDate !== startDate) {
        throw new Error("Timed events must start and end on the same date.");
      }
      if (startTime && endTime <= startTime) {
        throw new Error("endTime must be later than startTime.");
      }

      const descriptionValue = getCellText(cell(row, "description"));
      const academicYearValue = getCellText(cell(row, "academicyear"));
      if (academicYearValue) {
        if (typeof academicYearValue !== "string" || !/^\d{4}\/\d{2}$/.test(academicYearValue)) {
          throw new Error("academicYear must use YYYY/YY format.");
        }
        if (academicYear && academicYear !== academicYearValue) {
          throw new Error("academicYear must be the same on every spreadsheet row.");
        }
        academicYear = academicYearValue;
      }

      const semesterValue = getCellText(cell(row, "semester"));
      if (semesterValue) {
        const normalizedSemester = String(semesterValue).trim().toLowerCase();
        const parsedSemester =
          normalizedSemester === "semester 1" || normalizedSemester === "1"
            ? "Semester 1"
            : normalizedSemester === "semester 2" || normalizedSemester === "2"
              ? "Semester 2"
              : null;
        if (!parsedSemester) throw new Error("semester must be Semester 1 or Semester 2.");
        if (semester && semester !== parsedSemester) {
          throw new Error("semester must be the same on every spreadsheet row.");
        }
        semester = parsedSemester;
      }

      const semesterStartValue = getCellText(cell(row, "semesterstartdate"));
      if (semesterStartValue) {
        const parsedDate = parseDateCell(semesterStartValue, "semesterStartDate");
        if (semesterStartDate && semesterStartDate !== parsedDate) {
          throw new Error("semesterStartDate must be the same on every spreadsheet row.");
        }
        semesterStartDate = parsedDate;
      }
      const semesterEndValue = getCellText(cell(row, "semesterenddate"));
      if (semesterEndValue) {
        const parsedDate = parseDateCell(semesterEndValue, "semesterEndDate");
        if (semesterEndDate && semesterEndDate !== parsedDate) {
          throw new Error("semesterEndDate must be the same on every spreadsheet row.");
        }
        semesterEndDate = parsedDate;
      }

      entries.push({
        id: createEntryId(),
        title: titleValue,
        type: parseEntryType(cell(row, "type")),
        startDate,
        endDate,
        startTime,
        endTime,
        audience: parseAudience(cell(row, "audience")),
        description: typeof descriptionValue === "string" ? descriptionValue : "",
        source: "admin",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Spreadsheet row ${rowNumber}: ${message}`);
    }
  });

  if (entries.length === 0) throw new Error("The spreadsheet has no calendar events to import.");
  if ((semesterStartDate && !semesterEndDate) || (!semesterStartDate && semesterEndDate)) {
    throw new Error("Provide both semesterStartDate and semesterEndDate in the spreadsheet.");
  }
  if (semesterStartDate && semesterEndDate && semesterEndDate < semesterStartDate) {
    throw new Error("semesterEndDate must be on or after semesterStartDate.");
  }
  return { academicYear, semester, semesterStartDate, semesterEndDate, entries };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (quoted) throw new Error("The CSV file contains an unclosed quoted field.");
  return rows;
}

export async function parseCalendarSpreadsheet(
  file: File,
): Promise<ParsedAcademicCalendarSpreadsheet> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseRows(parseCsv((await file.text()).replace(/^\uFEFF/, "")));
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Choose an .xlsx or .csv spreadsheet.");
  }

  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  return parseRows(rows);
}

export function createCalendarEntry(
  input: Omit<AcademicCalendarEntry, "id" | "source">,
): AcademicCalendarEntry {
  return {
    ...input,
    id: createEntryId(),
    source: "admin",
  };
}

export function getCalendarEntryKey(entry: AcademicCalendarEntry) {
  return `${entry.title.trim().toLowerCase()}|${entry.startDate}|${entry.endDate}`;
}

export function formatCalendarEntryDate(entry: AcademicCalendarEntry) {
  const start = new Date(`${entry.startDate}T00:00:00`);
  const end = new Date(`${entry.endDate}T00:00:00`);
  const format = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return entry.startDate === entry.endDate ? format(start) : `${format(start)} – ${format(end)}`;
}
