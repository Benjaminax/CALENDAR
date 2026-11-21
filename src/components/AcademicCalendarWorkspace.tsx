import { FormEvent, useEffect, useState } from "react";
import {
  AcademicCalendarEntry,
  AcademicSemesterCalendar,
  AcademicSemesterName,
  CalendarAudience,
  CalendarEntryType,
  createCalendarEntry,
  formatCalendarEntryDate,
  getCalendarEntryKey,
  getSemesterCalendarKey,
  parseCalendarSpreadsheet,
} from "../lib/academicCalendar";

type ViewerAudience = Exclude<CalendarAudience, "All">;

const entryTypes: CalendarEntryType[] = [
  "Holiday",
  "Mid-semester break",
  "Vacate",
  "University event",
];
const audiences: CalendarAudience[] = ["All", "Students", "Lecturers"];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatEntryTime(entry: AcademicCalendarEntry) {
  return entry.startTime && entry.endTime
    ? `${entry.startTime}–${entry.endTime}`
    : "All day";
}

function CalendarEntries({
  entries,
  audience,
  onRemove,
}: {
  entries: AcademicCalendarEntry[];
  audience: ViewerAudience | "Admin";
  onRemove?: (entry: AcademicCalendarEntry) => void;
}) {
  const visibleEntries =
    audience === "Admin"
      ? entries
      : entries.filter((entry) => entry.audience === "All" || entry.audience === audience);

  if (visibleEntries.length === 0) {
    return <p className="academic-calendar-empty">No holidays or events are scheduled yet.</p>;
  }

  return (
    <div className="academic-calendar-entries">
      {visibleEntries.map((entry) => (
        <article className="academic-calendar-entry" key={entry.id}>
          <div className="academic-calendar-entry-date">{formatCalendarEntryDate(entry)}</div>
          <div className="academic-calendar-entry-main">
            <div className="academic-calendar-entry-title">
              <h4>{entry.title}</h4>
              <span className="academic-calendar-type">{entry.type}</span>
            </div>
            {entry.description && <p>{entry.description}</p>}
            <small>
              {formatEntryTime(entry)} · {entry.audience === "All" ? "Everyone" : entry.audience}
              {entry.source === "holiday-library" ? " · Ghana public holiday" : ""}
            </small>
          </div>
          {onRemove && entry.source === "admin" && (
            <button type="button" className="academic-calendar-remove" onClick={() => onRemove(entry)}>
              Remove
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

export function AcademicCalendarView({
  calendar,
  entries,
  audience,
  error,
  loading,
}: {
  calendar: AcademicSemesterCalendar;
  entries: AcademicCalendarEntry[];
  audience: ViewerAudience;
  error: string | null;
  loading: boolean;
}) {
  return (
    <section className="academic-calendar-panel">
      <header className="academic-calendar-panel-header">
        <div>
          <span className="academic-calendar-eyebrow">ACADEMIC CALENDAR</span>
          <h2>Holidays, breaks &amp; events</h2>
        </div>
        <span className="academic-calendar-term">
          {calendar.semester} · {calendar.academicYear}
        </span>
      </header>
      {calendar.startDate && calendar.endDate ? (
        <p className="academic-calendar-period">
          Semester runs {formatCalendarEntryDate({
            id: "semester-period",
            title: "Semester",
            type: "University event",
            startDate: calendar.startDate,
            endDate: calendar.endDate,
            startTime: "",
            endTime: "",
            audience: "All",
            description: "",
            source: "admin",
          })}
        </p>
      ) : (
        <p className="academic-calendar-period">
          Semester dates have not been set by the administrator yet.
        </p>
      )}
      {error && <p className="academic-calendar-error">{error}</p>}
      {loading ? (
        <p className="academic-calendar-empty">Loading the local semester calendar…</p>
      ) : (
        <CalendarEntries entries={entries} audience={audience} />
      )}
    </section>
  );
}

export function AcademicCalendarManager({
  calendar,
  entries,
  error,
  loading,
  onSave,
}: {
  calendar: AcademicSemesterCalendar;
  entries: AcademicCalendarEntry[];
  error: string | null;
  loading: boolean;
  onSave: (calendar: AcademicSemesterCalendar) => Promise<void>;
}) {
  const [draft, setDraft] = useState(calendar);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEntryType>("University event");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventAudience, setEventAudience] = useState<CalendarAudience>("All");
  const [eventDescription, setEventDescription] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(calendar);
  }, [calendar]);

  const saveCalendar = async (updated: AcademicSemesterCalendar, successMessage: string) => {
    setIsSaving(true);
    setFormError("");
    setMessage("");
    try {
      await onSave(updated);
      setDraft(updated);
      setMessage(successMessage);
      return true;
    } catch (saveError) {
      setFormError(getErrorMessage(saveError));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{4}\/\d{2}$/.test(draft.academicYear)) {
      setFormError("Academic year must use YYYY/YY format, for example 2026/27.");
      return;
    }
    if (!draft.startDate || !draft.endDate) {
      setFormError("Enter both the semester start and end dates.");
      return;
    }
    if (draft.endDate < draft.startDate) {
      setFormError("The semester end date must be on or after the start date.");
      return;
    }
    await saveCalendar(
      {
        ...draft,
        key: `${draft.academicYear.trim()}::${draft.semester}`,
        academicYear: draft.academicYear.trim(),
      },
      "Semester dates saved to the local calendar database.",
    );
  };

  const handleAddEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!eventTitle.trim() || !eventStartDate) {
      setFormError("Enter an event title and start date.");
      return;
    }
    const endDate = eventEndDate || eventStartDate;
    if (endDate < eventStartDate) {
      setFormError("The event end date must be on or after its start date.");
      return;
    }
    if ((eventStartTime && !eventEndTime) || (!eventStartTime && eventEndTime)) {
      setFormError("Enter both event times, or leave both blank for an all-day event.");
      return;
    }
    if (eventStartTime && (eventEndDate || eventStartDate) !== eventStartDate) {
      setFormError("Timed events must start and end on the same date.");
      return;
    }
    if (eventStartTime && eventEndTime <= eventStartTime) {
      setFormError("The event end time must be later than its start time.");
      return;
    }

    const entry = createCalendarEntry({
      title: eventTitle.trim(),
      type: eventType,
      startDate: eventStartDate,
      endDate,
      startTime: eventStartTime,
      endTime: eventEndTime,
      audience: eventAudience,
      description: eventDescription.trim(),
    });
    const updated = { ...draft, entries: [...draft.entries, entry] };
    if (!(await saveCalendar(updated, "Event added to the local semester calendar."))) return;
    setEventTitle("");
    setEventStartDate("");
    setEventEndDate("");
    setEventStartTime("");
    setEventEndTime("");
    setEventDescription("");
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFormError("");
    setMessage("");
    try {
      const imported = await parseCalendarSpreadsheet(file);
      const entriesByKey = new Map(
        draft.entries.map((entry) => [getCalendarEntryKey(entry), entry]),
      );
      imported.entries.forEach((entry) => entriesByKey.set(getCalendarEntryKey(entry), entry));
      const academicYear = imported.academicYear ?? draft.academicYear;
      const semester = imported.semester ?? draft.semester;
      const updated = {
        ...draft,
        academicYear,
        semester,
        key: getSemesterCalendarKey(academicYear, semester),
        startDate: imported.semesterStartDate ?? draft.startDate,
        endDate: imported.semesterEndDate ?? draft.endDate,
        entries: [...entriesByKey.values()],
      };
      await saveCalendar(
        updated,
        `${imported.entries.length} spreadsheet event${imported.entries.length === 1 ? "" : "s"} imported. Matching entries were updated.`,
      );
    } catch (importError) {
      setFormError(getErrorMessage(importError));
    }
  };

  const handleRemove = async (entry: AcademicCalendarEntry) => {
    await saveCalendar(
      { ...draft, entries: draft.entries.filter((item) => item.id !== entry.id) },
      `${entry.title} removed from the local semester calendar.`,
    );
  };

  const downloadTemplate = () => {
    const template =
      "academicYear,semester,semesterStartDate,semesterEndDate,title,type,startDate,endDate,startTime,endTime,audience,description\r\n";
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "academic-calendar-template.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="academic-calendar-manager">
      <section className="academic-calendar-panel">
        <header className="academic-calendar-panel-header">
          <div>
            <span className="academic-calendar-eyebrow">ADMINISTRATION · TERM DATES</span>
            <h2>Semester calendar setup</h2>
          </div>
          <span className="academic-calendar-term">Saved locally in this browser</span>
        </header>
        <p className="academic-calendar-period">
          Set the semester boundary dates first. Timetable exports will repeat only within this
          period.
        </p>
        {error && <p className="academic-calendar-error">{error}</p>}
        <form className="academic-calendar-form academic-calendar-period-form" onSubmit={handleSavePeriod}>
          <label>
            <span>Academic year</span>
            <input
              value={draft.academicYear}
              onChange={(event) => setDraft({ ...draft, academicYear: event.target.value })}
              placeholder="2026/27"
              pattern="\d{4}/\d{2}"
              required
            />
          </label>
          <label>
            <span>Semester</span>
            <select
              value={draft.semester}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  semester: event.target.value as AcademicSemesterName,
                })
              }
            >
              <option>Semester 1</option>
              <option>Semester 2</option>
            </select>
          </label>
          <label>
            <span>Semester starts</span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Semester ends</span>
            <input
              type="date"
              value={draft.endDate}
              onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              required
            />
          </label>
          <button type="submit" className="academic-calendar-primary" disabled={loading || isSaving}>
            {isSaving ? "Saving…" : "Save semester dates"}
          </button>
        </form>
      </section>

      <section className="academic-calendar-panel">
        <header className="academic-calendar-panel-header">
          <div>
            <span className="academic-calendar-eyebrow">SPREADSHEET IMPORT</span>
            <h2>Import holidays, breaks &amp; events</h2>
          </div>
          <button type="button" className="academic-calendar-secondary" onClick={downloadTemplate}>
            Download CSV template
          </button>
        </header>
        <p className="academic-calendar-period">
          Upload an .xlsx or .csv file with title, type, startDate, and endDate columns. Each
          row's dates are applied to that holiday, break, vacate, or event; use the same date for
          a one-day entry. Add startTime, endTime, audience, and description as needed. Optionally
          include academicYear, semester, semesterStartDate, and semesterEndDate to configure the
          semester from the spreadsheet. Type must be Holiday, Mid-semester break, Vacate, or
          University event. Audience is All, Students, or Lecturers. Use YYYY-MM-DD dates and
          24-hour HH:MM times.
        </p>
        <label className="academic-calendar-upload">
          <span>Choose semester spreadsheet</span>
          <input type="file" accept=".xlsx,.csv" onChange={handleImport} disabled={loading || isSaving} />
        </label>
      </section>

      <section className="academic-calendar-panel">
        <header className="academic-calendar-panel-header">
          <div>
            <span className="academic-calendar-eyebrow">MANUAL ENTRY</span>
            <h2>Add a campus event</h2>
          </div>
        </header>
        <form className="academic-calendar-form" onSubmit={handleAddEvent}>
          <label>
            <span>Event name</span>
            <input
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="e.g. Mid-semester break"
              required
            />
          </label>
          <label>
            <span>Type</span>
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value as CalendarEntryType)}
            >
              {entryTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Starts</span>
            <input
              type="date"
              value={eventStartDate}
              onChange={(event) => setEventStartDate(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Ends</span>
            <input
              type="date"
              value={eventEndDate}
              onChange={(event) => setEventEndDate(event.target.value)}
            />
          </label>
          <label>
            <span>Start time (optional)</span>
            <input
              type="time"
              value={eventStartTime}
              onChange={(event) => setEventStartTime(event.target.value)}
            />
          </label>
          <label>
            <span>End time (optional)</span>
            <input
              type="time"
              value={eventEndTime}
              onChange={(event) => setEventEndTime(event.target.value)}
            />
          </label>
          <label>
            <span>Audience</span>
            <select
              value={eventAudience}
              onChange={(event) => setEventAudience(event.target.value as CalendarAudience)}
            >
              {audiences.map((audienceOption) => (
                <option key={audienceOption}>{audienceOption}</option>
              ))}
            </select>
          </label>
          <label className="academic-calendar-form-wide">
            <span>Description (optional)</span>
            <textarea
              value={eventDescription}
              onChange={(event) => setEventDescription(event.target.value)}
              rows={3}
            />
          </label>
          <button type="submit" className="academic-calendar-primary" disabled={loading || isSaving}>
            Add event
          </button>
        </form>
        {formError && <p className="academic-calendar-error">{formError}</p>}
        {message && <p className="academic-calendar-success">{message}</p>}
      </section>

      <section className="academic-calendar-panel">
        <header className="academic-calendar-panel-header">
          <div>
            <span className="academic-calendar-eyebrow">SEMESTER SCHEDULE</span>
            <h2>Holidays, breaks &amp; events</h2>
          </div>
          <span className="academic-calendar-count">{entries.length} items</span>
        </header>
        <CalendarEntries entries={entries} audience="Admin" onRemove={handleRemove} />
      </section>
    </div>
  );
}
