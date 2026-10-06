import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db/supabase.server", () => ({ createClient: () => { throw new Error("db must not be reached"); } }));

import { LearningAdminService } from "@/backend/service/learning-admin.service";
import { LearningRepository, type CourseRow } from "@/backend/repo/learning.repo";
import { Moodle } from "@/backend/integration/moodle/moodle.service";
import { MoodleError } from "@/backend/integration/moodle/moodle.client";
import type { AuthUser } from "@/shared/auth/auth.types";

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "a@meyveda.in", role: "admin", permissions: [] };
const ID = "22222222-2222-4222-8222-222222222222";
const row = (over: Partial<CourseRow> = {}): CourseRow => ({
  id: ID, moodle_course_id: 42, title: "Ayurveda", short_description: "", description: "", category_name: null, level: null, instructor_id: null,
  duration_minutes: null, learning_objectives: [], thumbnail_path: null, status: "draft", published_at: null, created_by: admin.id,
  created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z", ...over,
});

describe("course deletion keeps YurCore and Moodle in sync", () => {
  let order: string[];
  beforeEach(() => {
    vi.restoreAllMocks();
    order = [];
    vi.spyOn(LearningRepository, "getCourse").mockResolvedValue(row());
    vi.spyOn(LearningRepository, "listFolder").mockResolvedValue(["courses/x/videos/a.mp4"]);
    vi.spyOn(LearningRepository, "deleteCourse").mockImplementation(async () => { order.push("supabase"); });
    vi.spyOn(LearningRepository, "removeFiles").mockImplementation(async () => { order.push("storage"); });
  });

  it("deletes from Moodle first, then YurCore data, then files", async () => {
    vi.spyOn(Moodle, "deleteCourse").mockImplementation(async (id) => { order.push(`moodle:${id}`); });
    await LearningAdminService.deleteCourse(admin, ID);
    expect(order).toEqual(["moodle:42", "supabase", "storage"]);
  });

  it("leaves YurCore untouched and reports failure when Moodle refuses or is unreachable", async () => {
    for (const kind of ["rejected", "unavailable", "timeout", "missing_function"] as const) {
      order = [];
      vi.spyOn(Moodle, "deleteCourse").mockRejectedValue(new MoodleError(kind, "core_course_delete_courses"));
      await expect(LearningAdminService.deleteCourse(admin, ID)).rejects.toMatchObject({ statusCode: 502, message: expect.stringContaining("could not be completely deleted from Moodle") });
      expect(order).toEqual([]);
    }
  });

  it("treats a course already missing in Moodle as deleted there", async () => {
    vi.spyOn(Moodle, "deleteCourse").mockRejectedValue(new MoodleError("not_found", "core_course_delete_courses"));
    await LearningAdminService.deleteCourse(admin, ID);
    expect(order).toEqual(["supabase", "storage"]);
  });
});

describe("course creation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("creates the Moodle course first (hidden) and stores its id", async () => {
    vi.spyOn(Moodle, "createCourse").mockResolvedValue(77);
    vi.spyOn(Moodle, "getCoursesByIds").mockResolvedValue(new Map());
    const insert = vi.spyOn(LearningRepository, "insertCourse").mockResolvedValue(row({ moodle_course_id: 77 }));
    vi.spyOn(LearningRepository, "insertSection").mockResolvedValue({ id: "s", course_id: ID, title: "Introduction", description: "", position: 0 });
    vi.spyOn(LearningRepository, "listSections").mockResolvedValue([]);
    vi.spyOn(LearningRepository, "listContent").mockResolvedValue([]);
    vi.spyOn(LearningRepository, "getPractitioners").mockResolvedValue(new Map());
    vi.spyOn(LearningRepository, "signedUrls").mockResolvedValue(new Map());
    vi.spyOn(LearningRepository, "getUserEmails").mockResolvedValue(new Map());
    vi.spyOn(LearningRepository, "listEnrollments").mockResolvedValue([]);

    const course = await LearningAdminService.createCourse(admin, { title: "Ayurveda basics" });
    expect(Moodle.createCourse).toHaveBeenCalledWith(expect.objectContaining({ fullname: "Ayurveda basics", visible: false }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ moodle_course_id: 77, status: "draft" }));
    expect(course.moodleCourseId).toBe(77);
  });

  it("saves nothing when Moodle creation fails, and removes the Moodle course if saving fails", async () => {
    vi.spyOn(Moodle, "createCourse").mockRejectedValue(new MoodleError("unavailable", "core_course_create_courses"));
    const insert = vi.spyOn(LearningRepository, "insertCourse");
    await expect(LearningAdminService.createCourse(admin, { title: "Ayurveda basics" })).rejects.toMatchObject({ statusCode: 502 });
    expect(insert).not.toHaveBeenCalled();

    vi.spyOn(Moodle, "createCourse").mockResolvedValue(78);
    insert.mockRejectedValue(new Error("course insert failed"));
    const del = vi.spyOn(Moodle, "deleteCourse").mockResolvedValue();
    await expect(LearningAdminService.createCourse(admin, { title: "Ayurveda basics" })).rejects.toThrow("course insert failed");
    expect(del).toHaveBeenCalledWith(78);
  });
});
