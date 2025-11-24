export enum DifficultyLevel {
  Basic = 'Basic',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export interface SyllabusTopic {
  id: string;
  title: string;
  description: string;
  level: DifficultyLevel;
  status: 'pending' | 'generating' | 'completed' | 'error';
  content?: string; // Markdown content
  lastUpdated?: number;
}

export interface Course {
  id: string;
  subject: string;
  createdAt: number;
  topics: SyllabusTopic[];
}

export interface AppState {
  courses: Course[];
  currentCourseId: string | null;
  selectedTopicId: string | null;
}

export type StorageType = 'local' | 'cloud';