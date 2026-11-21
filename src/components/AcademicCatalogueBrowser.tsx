import { useMemo, useState } from "react";
import academicCatalogue from "../data/academic-catalogue.json";

const sectionLabels: Record<string, string> = {
  "course-diet": "Programme course",
  "elective-options": "Elective option",
  "specialisation-options": "Specialisation option",
};

function formatValue(value: number | null) {
  return value === null ? "—" : value;
}

export function AcademicCatalogueBrowser() {
  const [selectedProgrammeId, setSelectedProgrammeId] = useState(
    academicCatalogue.programmes[0]?.id ?? "",
  );
  const selectedProgramme =
    academicCatalogue.programmes.find((programme) => programme.id === selectedProgrammeId) ??
    academicCatalogue.programmes[0];
  const [selectedLevel, setSelectedLevel] = useState(
    academicCatalogue.programmes[0]?.levels[0] ?? "",
  );
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [search, setSearch] = useState("");

  const activeLevel = selectedProgramme?.levels.includes(selectedLevel)
    ? selectedLevel
    : (selectedProgramme?.levels[0] ?? "");
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return academicCatalogue.courses
      .filter((course) => {
        if (
          course.programmeId !== selectedProgramme?.id ||
          course.level !== activeLevel ||
          (semesterFilter !== "all" && course.semester !== Number(semesterFilter))
        ) {
          return false;
        }

        return (
          !query ||
          course.code.toLowerCase().includes(query) ||
          course.title.toLowerCase().includes(query) ||
          course.category.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const semesterOrder = (a.semester ?? 0) - (b.semester ?? 0);
        return semesterOrder || a.code.localeCompare(b.code) || a.title.localeCompare(b.title);
      });
  }, [activeLevel, search, selectedProgramme?.id, semesterFilter]);

  return (
    <section className="academic-catalogue" aria-labelledby="academic-catalogue-title">
      <div className="academic-catalogue__header">
        <div>
          <span className="academic-catalogue__eyebrow">ACADEMIC CATALOGUE · 2024/25</span>
          <h2 id="academic-catalogue-title">Programmes and course diets</h2>
          <p>
            Browse the course listings by programme and level. Elective and specialisation options
            are shown separately from the programme course diet. This published reference does not
            change the live timetable records below.
          </p>
        </div>
        <span className="academic-catalogue__count" aria-live="polite">
          {filteredCourses.length} {filteredCourses.length === 1 ? "course" : "courses"}
        </span>
      </div>

      <div className="academic-catalogue__programme">
        <strong>{selectedProgramme?.name}</strong>
        <span>
          {selectedProgramme?.degree} · {selectedProgramme?.faculty}
        </span>
      </div>

      <div className="academic-catalogue__filters">
        <label>
          <span>Programme</span>
          <select
            value={selectedProgramme?.id ?? ""}
            onChange={(event) => {
              const nextProgramme = academicCatalogue.programmes.find(
                (programme) => programme.id === event.target.value,
              );
              setSelectedProgrammeId(event.target.value);
              setSelectedLevel(nextProgramme?.levels[0] ?? "");
              setSemesterFilter("all");
            }}
          >
            {academicCatalogue.programmes.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programme.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Level</span>
          <select value={activeLevel} onChange={(event) => setSelectedLevel(event.target.value)}>
            {selectedProgramme?.levels.map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Semester</span>
          <select
            value={semesterFilter}
            onChange={(event) => setSemesterFilter(event.target.value)}
          >
            <option value="all">All semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
        </label>

        <label>
          <span>Search courses</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Course name or code"
          />
        </label>
      </div>

      <div className="academic-catalogue__table-wrap">
        <table className="academic-catalogue__table">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Course name</th>
              <th scope="col">Category</th>
              <th scope="col">Listing</th>
              <th scope="col">Semester</th>
              <th scope="col">L / T / P</th>
              <th scope="col">Credits</th>
              <th scope="col">Page</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map((course, index) => (
              <tr
                key={`${course.programmeId}-${course.level}-${course.code}-${course.title}-${course.section}-${index}`}
              >
                <td className="academic-catalogue__code" data-label="Code">
                  {course.code}
                </td>
                <td data-label="Course name">{course.title}</td>
                <td data-label="Category">{course.category || "—"}</td>
                <td data-label="Listing">
                  <span className="academic-catalogue__badge">
                    {sectionLabels[course.section] ?? course.section}
                  </span>
                </td>
                <td data-label="Semester">
                  {course.semester ? `Semester ${course.semester}` : "Not specified"}
                </td>
                <td data-label="L / T / P">
                  {formatValue(course.lectureHours)} / {formatValue(course.tutorialHours)} /{" "}
                  {formatValue(course.practicalHours)}
                </td>
                <td data-label="Credits">{formatValue(course.credits)}</td>
                <td data-label="Page">{course.sourcePage}</td>
              </tr>
            ))}
            {filteredCourses.length === 0 && (
              <tr>
                <td className="academic-catalogue__empty" colSpan={8}>
                  No courses match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="academic-catalogue__source">
        Source: {academicCatalogue.source}. Page numbers refer to the catalogue&apos;s printed page
        numbers.
      </p>
    </section>
  );
}
