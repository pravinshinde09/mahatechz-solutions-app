import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { CourseCard, CourseDetail } from "@/contracts/catalog";
import type { NotificationView } from "@/contracts/communication";
import type { AnnouncementView, courseProgressSchema, Dashboard, LearnCourse, learnResourceSchema, LessonContent } from "@/contracts/learning";
import type { LiveSessionView } from "@/contracts/live";
import { api, apiEnvelope, publicApi } from "./client";

export type LearnResource = z.infer<typeof learnResourceSchema>;
export type CourseProgress = z.infer<typeof courseProgressSchema>;

export const keys = {
  dashboard: ["dashboard"] as const,
  catalog: (q: string) => ["catalog", q] as const,
  course: (slug: string) => ["course", slug] as const,
  learn: (courseId: string) => ["learn", courseId] as const,
  lesson: (id: string) => ["lesson", id] as const,
  resources: (courseId: string) => ["resources", courseId] as const,
  announcements: (courseId: string) => ["announcements", courseId] as const,
  live: (when: string) => ["live", when] as const,
  liveSession: (id: string) => ["live-session", id] as const,
  notifications: ["notifications"] as const,
};

/** One round trip for the "My learning" tab (spec §14.1). */
export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>("/me/dashboard") });

/** The public catalogue (FR-CAT-01); signed-in users get their enrolment state on details. */
export const useCatalog = (q: string) =>
  useQuery({
    queryKey: keys.catalog(q),
    queryFn: async () => (await publicApi<{ data: CourseCard[] } | CourseCard[]>(`/courses?limit=30${q ? `&q=${encodeURIComponent(q)}` : ""}`)) as CourseCard[],
  });

export const useCourse = (slug: string) => useQuery({ queryKey: keys.course(slug), queryFn: () => api<CourseDetail>(`/courses/${encodeURIComponent(slug)}`) });

export const useLearnCourse = (courseId: string) => useQuery({ queryKey: keys.learn(courseId), queryFn: () => api<LearnCourse>(`/learn/courses/${courseId}`) });

export const useLesson = (id: string) => useQuery({ queryKey: keys.lesson(id), queryFn: () => api<LessonContent>(`/lessons/${id}`) });

export const useResources = (courseId: string) => useQuery({ queryKey: keys.resources(courseId), queryFn: () => api<LearnResource[]>(`/learn/courses/${courseId}/resources`) });

export const useAnnouncements = (courseId: string) => useQuery({ queryKey: keys.announcements(courseId), queryFn: () => api<AnnouncementView[]>(`/learn/courses/${courseId}/announcements`) });

export const useLive = (when: "upcoming" | "past") => useQuery({ queryKey: keys.live(when), queryFn: () => api<LiveSessionView[]>(`/me/live-sessions?when=${when}`) });

export const useLiveSession = (id: string) => useQuery({ queryKey: keys.liveSession(id), queryFn: () => api<LiveSessionView>(`/live-sessions/${id}`) });

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => apiEnvelope<{ data: NotificationView[]; unreadCount: number; page: { nextCursor: string | null } }>("/me/notifications?limit=30"),
  });

export const useProgress = (courseId: string) => useQuery({ queryKey: ["progress", courseId], queryFn: () => api<CourseProgress>(`/me/progress/courses/${courseId}`) });
