export interface Theme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
}

export interface Question {
  id: string;
  type:
    | 'multiple-choice'
    | 'text'
    | 'rating'
    | 'rating-multi'
    | 'slider'
    | 'likert'
    | 'matrix'
    | 'dropdown'
    | 'checkbox'
    | 'nps'
    | 'intro-page'
    | 'thank-you-page';
  title: string;
  description: string;
  required: boolean;
  options?: string[];
  matrixRows?: string[];
  matrixCols?: string[];
  items?: string[]; // para rating-multi
  maxRating?: number; // para rating-multi (estrelas)
  randomize?: boolean;
  charLimit?: number;
  scale?: { min: number; max: number; minLabel: string; maxLabel: string; step?: number };
  logic?: { triggerOption: string; destinationSectionId: string }[];
  sectionId: string;
  validation?: {
    type?: 'text' | 'email' | 'number' | 'date' | 'tel' | 'url';
    minSelect?: number;
    maxSelect?: number;
  };
}

export interface Section {
  id: string;
  name: string;
  questionIds: string[];
}

export interface Survey {
  id: string;
  title: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  questions: Question[];
  sections: Section[];
  theme: Theme;
}

export type ActivePage = 'questions' | 'logic' | 'appearance' | 'collect' | 'settings';
