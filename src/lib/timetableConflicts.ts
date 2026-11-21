export interface ClassroomScheduleEvent {
  id: string;
  code: string;
  room: string;
  day: number;
  semester: number;
  start: number;
  span?: number;
  onlineMeeting?: boolean;
}

export interface ClassroomTimeConflict<T extends ClassroomScheduleEvent> {
  room: string;
  day: number;
  semester: number;
  first: T;
  second: T;
}

export function getClassroomTimeConflicts<T extends ClassroomScheduleEvent>(
  events: readonly T[],
  onlineMeetingRoom = "Online Meeting",
): ClassroomTimeConflict<T>[] {
  const eventsByRoomAndTime = new Map<string, T[]>();

  for (const event of events) {
    if (event.onlineMeeting || event.room === onlineMeetingRoom || !event.room.trim()) continue;

    const key = JSON.stringify([event.semester, event.day, event.room]);
    const roomEvents = eventsByRoomAndTime.get(key) ?? [];
    roomEvents.push(event);
    eventsByRoomAndTime.set(key, roomEvents);
  }

  const conflicts: ClassroomTimeConflict<T>[] = [];
  for (const roomEvents of eventsByRoomAndTime.values()) {
    const orderedEvents = [...roomEvents].sort((a, b) => a.start - b.start);

    for (let firstIndex = 0; firstIndex < orderedEvents.length; firstIndex += 1) {
      const first = orderedEvents[firstIndex];
      const firstEnd = first.start + Math.max(1, first.span || 1);

      for (let secondIndex = firstIndex + 1; secondIndex < orderedEvents.length; secondIndex += 1) {
        const second = orderedEvents[secondIndex];
        if (second.start >= firstEnd) break;

        const secondEnd = second.start + Math.max(1, second.span || 1);
        if (Math.max(first.start, second.start) >= Math.min(firstEnd, secondEnd)) continue;

        conflicts.push({
          room: first.room,
          day: first.day,
          semester: first.semester,
          first,
          second,
        });
      }
    }
  }

  return conflicts;
}

export function findClassroomTimeConflict<T extends ClassroomScheduleEvent>(
  events: readonly T[],
  onlineMeetingRoom = "Online Meeting",
): ClassroomTimeConflict<T> | null {
  return getClassroomTimeConflicts(events, onlineMeetingRoom)[0] ?? null;
}
