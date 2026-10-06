# YurCore Learning – course builder

Course content is built and stored in YurCore: course data in Supabase, files in Supabase Storage.
Every course is also a Moodle course, and the course lifecycle is kept in sync (see "Moodle course sync" below).
Only admins (`admin`, `super_admin`) build courses. Practitioners (`doctor` role with a practitioner profile) are the learners.

## Flow

Admin: **Create course** (details: title, short and full description, thumbnail, category, level, instructor, duration, learning objectives) → **Build content** (sections; add Video / Image / PDF-Document / File / Text lesson, Quiz / Question / Assignment / Feedback; drag or arrow-reorder items and sections) → **Preview** (the real learner player with local, unsaved progress) → **Publish** (checklist; blocked while a file item has no file or a quiz has no questions). Changes save as you go; "Save draft" leaves the course as a draft.

Practitioner: `/pro/learning` lists published courses (All / My Learning / Completed) → course page: overview, outline, and each item in admin order. Media and lessons are marked complete (videos automatically when they end); quizzes complete when passed, a single question once answered, assignments and feedback once submitted. The course completes when every item is complete.

## Data (migration `supabase/migrations/20260926000000_learning_native_content.sql`)

| Table | Holds |
|---|---|
| `meyveda_learning_courses` (existing, extended) | title, short_description, description, category_name, level, instructor_id, duration_minutes, learning_objectives, thumbnail_path, status, published_at |
| `meyveda_learning_sections` | course_id, title, description, position |
| `meyveda_learning_content` | course_id, section_id, content_type, title, description, body (lesson), settings (due date / rating), storage_path, file_name, mime_type, size_bytes, position |
| `meyveda_learning_quizzes` | content_id, passing_score, time_limit_minutes, attempts_allowed |
| `meyveda_learning_quiz_questions` / `_quiz_options` | question, explanation, position / option_text, is_correct (at most one per question, enforced by a unique index), position |
| `meyveda_learning_enrollments`, `_progress`, `_quiz_attempts`, `_responses` | learner start/completion, completed items, graded attempts, assignment/feedback answers |

All tables have RLS on and are used only by the server (service role).

## Moodle course sync

`meyveda_learning_courses.id` (uuid) is the YurCore course; `moodle_course_id` is the id Moodle returned when the course was created (never assumed equal). Every step changes Moodle first and YurCore only after Moodle succeeded:

| Action | Moodle | YurCore |
|---|---|---|
| Create | `core_course_create_courses` (hidden, default category) | row inserted with `moodle_course_id`; if the insert fails the Moodle course is deleted again |
| Edit title / description | `core_course_update_courses` (fullname / summary) | row updated |
| Publish / unpublish | course made visible / hidden | status changed |
| Delete | `core_course_delete_courses`, then re-read to confirm it is gone. Moodle reports refusals as *warnings* in a successful response; these are checked | only then: course row (sections, content, quizzes, learner records cascade) and its Storage folder |

If a Moodle step fails, the operation stops and nothing in YurCore changes, so retrying is safe. A Moodle course that no longer exists (deleted in Moodle directly) counts as already deleted, and the admin list flags such courses. Sections, files and quizzes are stored in YurCore only; they are not copied into the Moodle course.

## Files

Private bucket `learning`, paths `courses/<course-id>/{thumbnail,videos,images,documents,files}/<uuid>-<name>`. Rows store the path and metadata, never file data.
Uploads go from the browser straight to Storage with a server-issued signed upload URL (after the admin check and a file-type check), with progress; the server then verifies the object exists, sits in that course's folder and has an allowed type before a row may reference it. Learners and the admin UI get 3-hour signed URLs. Replaced or deleted files are removed from Storage; deleting a course removes its folder.

There is no application limit on the number or size of videos, images or documents. The only ceiling is the Supabase project's upload limit (Dashboard → Storage → Settings: 50 MB on the Free plan; configurable on paid plans). For very large videos, raise that limit.

## Setup

1. Run the migration in the Supabase SQL editor (creates tables and the `learning` bucket).
2. No new environment variables. The Moodle variables are no longer needed by Learning.
