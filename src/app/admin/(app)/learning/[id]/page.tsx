"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, Eye, Pencil, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@/hooks/useQuery";
import { LEVEL_LABEL, formatDuration } from "@/shared/learning/content";
import { adminLearningApi } from "../_lib/api";
import { CourseBuilder } from "../_components/CourseBuilder";
import { CoursePreview } from "../_components/CoursePreview";
import { LearnersPanel } from "../_components/LearnersPanel";
import { PublishDialog, publishProblems } from "../_components/PublishDialog";
import { Spinner, StatusBadge, Stepper, ghostBtn, primaryBtn } from "../_components/ui";

const TABS = [["content", "Build content"], ["preview", "Preview"], ["learners", "Learners"]] as const;
type Tab = (typeof TABS)[number][0];

export default function CourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const tabParam = useSearchParams().get("tab");
  const tab: Tab = tabParam === "preview" || tabParam === "learners" ? tabParam : "content";
  const { data, loading, error, refetch } = useQuery(() => adminLearningApi.details(id), [id]);
  const [publishing, setPublishing] = useState(false);

  const go = (t: Tab) => router.replace(t === "content" ? `/admin/learning/${id}` : `/admin/learning/${id}?tab=${t}`, { scroll: false });

  if (loading && !data) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>;
  if (error || !data) return <div className="p-10 text-center text-sm text-muted-foreground">{error ?? "Course not found"} <Link href="/admin/learning" className="font-semibold text-herb-green">Back</Link></div>;

  const { course, sections } = data;
  const published = course.status === "published";
  const ready = publishProblems(sections).length === 0;
  const meta = [course.category, course.level && LEVEL_LABEL[course.level], course.instructor && `By ${course.instructor.name}`].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/admin/learning" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> MeyVeda Learning</Link>

      {/* Course information */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt="" className="aspect-video w-full rounded-xl object-cover md:w-48" />
          ) : (
            <Link href={`/admin/learning/${id}/settings`} className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-herb-green/50 md:w-48"><BookOpen size={20} className="mb-1 text-herb-green/60" /> Add thumbnail</Link>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold text-foreground">{course.title}</h1>
              <StatusBadge status={course.status} />
            </div>
            {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span>{course.counts.sections} sections · {course.counts.items} items</span>
              {course.durationMinutes ? <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(course.durationMinutes)}</span> : null}
              <span>{course.learners} learners</span>
            </p>
            {course.moodleStatus === "missing" && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">The linked Moodle course (id {course.moodleCourseId}) no longer exists in Moodle. It was deleted there directly.</p>}
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch lg:flex-row lg:items-center">
            <Link href={`/admin/learning/${id}/settings`} className={ghostBtn}><Pencil size={14} /> Edit details</Link>
            {!published && (
              <button onClick={() => { toast.success("Draft saved. Changes are saved as you work"); router.push("/admin/learning"); }} className={ghostBtn}><Save size={14} /> Save draft</button>
            )}
            <button onClick={() => go("preview")} className={ghostBtn}><Eye size={14} /> Preview</button>
            <button onClick={() => setPublishing(true)} className={published ? ghostBtn : primaryBtn}>{published ? "Unpublish" : "Publish course"}</button>
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <Stepper step={published ? 4 : tab === "preview" ? 3 : 2} done={[1, ...(ready ? [2] : []), ...(published ? [3, 4] : [])]} />
        </div>
      </div>

      <nav className="flex gap-1 border-b border-border" aria-label="Course builder">
        {TABS.map(([t, label]) => (
          <button key={t} onClick={() => go(t)} className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors", tab === t ? "border-herb-green text-herb-green" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
            {t === "learners" && course.learners > 0 && <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{course.learners}</span>}
          </button>
        ))}
      </nav>

      {tab === "learners" ? <LearnersPanel courseId={id} /> : tab === "preview" ? <CoursePreview course={course} sections={sections} /> : <CourseBuilder courseId={id} sections={sections} onChanged={refetch} />}

      {/* Step navigation: Build content → Preview → Publish */}
      {tab !== "learners" && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {tab === "content" ? (
              <>
                <p className="text-xs text-muted-foreground">{course.counts.items} {course.counts.items === 1 ? "item" : "items"} · Changes are saved automatically</p>
                <button onClick={() => { go("preview"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={primaryBtn}>Next: Preview <ArrowRight size={16} /></button>
              </>
            ) : (
              <>
                <button onClick={() => { go("content"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={ghostBtn}><ArrowLeft size={15} /> Back to Build content</button>
                {published ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-herb-green"><CheckCircle2 size={16} /> Published: visible to all practitioners</span>
                    <Link href="/admin/learning" className={ghostBtn}>Done</Link>
                  </div>
                ) : (
                  <button onClick={() => setPublishing(true)} className={primaryBtn}>Publish course</button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {publishing && <PublishDialog course={course} sections={sections} onClose={() => setPublishing(false)} onDone={() => { setPublishing(false); refetch(); }} />}
    </div>
  );
}
