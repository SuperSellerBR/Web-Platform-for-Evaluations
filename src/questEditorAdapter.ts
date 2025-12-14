import { Survey, Section, Question, Theme } from "./questEditor/src/types";

export const defaultTheme: Theme = {
  primaryColor: "#2C5F66",
  backgroundColor: "#F3F3F5",
  textColor: "#111827",
  fontFamily: "Inter, sans-serif",
  borderRadius: "0.5rem",
};

const typeToBackend: Record<Question["type"], string> = {
  "multiple-choice": "multiple_choice",
  checkbox: "checkbox",
  dropdown: "dropdown",
  rating: "star_rating",
  "rating-multi": "rating_multi",
  slider: "slider",
  likert: "likert",
  matrix: "matrix",
  text: "text",
  nps: "nps",
  "intro-page": "text",
  "thank-you-page": "text",
};

const typeToEditor: Record<string, Question["type"]> = {
  multiple_choice: "multiple-choice",
  checkbox: "checkbox",
  dropdown: "dropdown",
  star_rating: "rating",
  rating_multi: "rating-multi",
  slider: "slider",
  likert: "likert",
  nps: "nps",
  text: "text",
  matrix: "matrix",
  ranking: "dropdown",
};

export function toEditor(
  survey: any,
  sections: any[] = [],
  questions: any[] = []
): Survey {
  const normalizedSections: Section[] = (sections || []).map((s: any) => {
    const qIds = (questions || [])
      .filter((q) => q.section_id === s.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((q) => q.id);
    return {
      id: s.id,
      name: s.title || "Seção",
      questionIds: qIds,
    };
  });

  const normalizedQuestions: Question[] = (questions || []).map((q: any) => {
    const cfg = q.config || {};
    const mappedType =
      typeToEditor[q.type] ||
      (q.type as Question["type"]) ||
      ("multiple-choice" as Question["type"]);
    const type = mappedType;
    let scale;
    if (type === "rating") {
      scale = {
        min: cfg.min ?? 1,
        max: cfg.max ?? 5,
        minLabel: cfg.minLabel || "Ruim",
        maxLabel: cfg.maxLabel || "Excelente",
        step: cfg.step,
      };
    } else if (type === "likert" || type === "slider") {
      scale = {
        min: cfg.min ?? 1,
        max: cfg.max ?? 5,
        minLabel: cfg.minLabel || "Discordo",
        maxLabel: cfg.maxLabel || "Concordo",
        step: cfg.step,
      };
    }

    return {
      id: q.id,
      type,
      title: q.title || "Pergunta",
      description: q.description || "",
      required: !!q.required,
      options: cfg.options,
      items: cfg.items,
      maxRating: cfg.maxRating,
      matrixRows: cfg.matrixRows,
      matrixCols: cfg.matrixCols,
      randomize: cfg.randomize,
      charLimit: cfg.charLimit,
      scale,
      logic: (q.logic || []).map((l: any) => ({
        triggerOption: l.triggerOption,
        destinationSectionId: l.destinationSectionId,
      })),
      sectionId: q.section_id,
      validation: cfg.validation,
    };
  });

  const defaultSection =
    normalizedSections[0] || { id: "section-1", name: "Seção 1", questionIds: [] };

  return {
    id: survey.id,
    title: survey.title || "Questionário",
    status: survey.status || "draft",
    createdAt: survey.created_at || new Date().toISOString(),
    updatedAt: survey.updated_at || new Date().toISOString(),
    responseCount: survey.response_count || 0,
    sections: normalizedSections.length ? normalizedSections : [defaultSection],
    questions: normalizedQuestions,
    theme: defaultTheme,
  };
}

export function toBackendPayload(editor: Survey) {
  const sectionOrder = editor.sections.map((s, idx) => ({
    ...s,
    order: idx,
  }));

  const questionsBySection = (sectionId: string) =>
    editor.questions
      .filter((q) => q.sectionId === sectionId)
      .map((q, idx) => {
        const backendType = typeToBackend[q.type] || "text";
        const config: any = {};
        if (q.options) config.options = q.options;
        if (q.randomize) config.randomize = true;
        if (q.charLimit) config.charLimit = q.charLimit;
        if ((q.type === "rating" || q.type === "slider" || q.type === "likert") && q.scale) {
          config.min = q.scale.min;
          config.max = q.scale.max;
          if (q.scale.minLabel) config.minLabel = q.scale.minLabel;
          if (q.scale.maxLabel) config.maxLabel = q.scale.maxLabel;
          if (q.scale.step) config.step = q.scale.step;
        }
        if (q.type === "rating-multi") {
          if (q.items) config.items = q.items;
          if (q.maxRating) config.maxRating = q.maxRating;
        }
        if (q.type === "matrix") {
          if (q.matrixRows) config.matrixRows = q.matrixRows;
          if (q.matrixCols) config.matrixCols = q.matrixCols;
        }
        if (q.validation) config.validation = q.validation;

        return {
          type: backendType,
          title: q.title,
          description: q.description || "",
          required: !!q.required,
          order: idx,
          config,
          scoring: { weight: 1 },
          logic: q.logic || [],
        };
      });

  return {
    title: editor.title,
    description: "",
    status: editor.status || "draft",
    sections: sectionOrder.map((s) => ({
      title: s.name,
      order: s.order,
      weight: 1,
      scoring_mode: "soma",
      meta: {},
      questions: questionsBySection(s.id),
    })),
  };
}
