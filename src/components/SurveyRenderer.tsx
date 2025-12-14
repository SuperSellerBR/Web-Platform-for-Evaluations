import { useEffect, useState } from "react";
import { projectId } from "../utils/supabase/info";
import { toEditor, defaultTheme } from "../questEditorAdapter";
import { Question, Section, Theme } from "../questEditor/src/types";
import { Star } from "lucide-react";
import { Button } from "../questEditor/src/components/ui/button";
import { Label } from "../questEditor/src/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "../questEditor/src/components/ui/radio-group";
import { Checkbox } from "../questEditor/src/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../questEditor/src/components/ui/select";
import { Textarea } from "../questEditor/src/components/ui/textarea";

interface SurveyRendererProps {
  surveyId: string;
  accessToken: string;
  evaluationId: string;
  onSubmitted?: () => void;
}

export function SurveyRenderer({
  surveyId,
  accessToken,
  evaluationId,
  onSubmitted,
}: SurveyRendererProps) {
  const [surveyTitle, setSurveyTitle] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const draftKey = `surveyDraft:${evaluationId || surveyId}`;
  const [stage, setStage] = useState<"visit" | "questions" | "attachments" | "review">("visit");

  useEffect(() => {
    loadSurvey();
  }, [surveyId]);

  // Persistir rascunho local (permite retomar de onde parou)
  const [visitData, setVisitData] = useState({
    startTime: "",
    endTime: "",
    vendors: "",
  });
  const [receipt, setReceipt] = useState<{ name: string; url: string; path: string } | null>(null);
  const [photos, setPhotos] = useState<{ name: string; url: string; path: string }[]>([]);

  useEffect(() => {
    // Apenas salva se houver respostas ou seções carregadas
    if (sections.length === 0) return;
    const payload = {
      surveyId,
      currentSectionIndex,
      answers,
      visitData,
      receipt,
      photos,
      stage,
      ts: Date.now(),
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (_) {
      // Ignora quota/storage errors
    }
  }, [answers, currentSectionIndex, sections.length, visitData, receipt, photos, stage]);

  const loadSurvey = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys/${surveyId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar questionário");
        return;
      }

      const converted = toEditor(
        data.survey,
        data.sections || [],
        (data.sections || []).flatMap((s: any) => s.questions || [])
      );
      setSurveyTitle(converted.title);
      setSections(converted.sections);
      setQuestions(converted.questions);
      setTheme(converted.theme || defaultTheme);
      // Restaurar rascunho, se existir
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.surveyId === surveyId) {
            setCurrentSectionIndex(
              Math.min(draft.currentSectionIndex ?? 0, converted.sections.length - 1)
            );
            setAnswers(draft.answers || {});
            setVisitData({
              startTime: draft.visitData?.startTime || "",
              endTime: draft.visitData?.endTime || "",
              vendors: draft.visitData?.vendors || "",
            });
            setReceipt(draft.receipt || null);
            setPhotos(draft.photos || []);
            setStage(draft.stage || "visit");
          } else {
            setCurrentSectionIndex(0);
            setAnswers({});
            setVisitData({
              startTime: new Date().toISOString().slice(11, 16),
              endTime: "",
              vendors: "",
            });
            setReceipt(null);
            setPhotos([]);
            setStage("visit");
          }
        } else {
          setCurrentSectionIndex(0);
          setAnswers({});
          setVisitData({
            startTime: new Date().toISOString().slice(11, 16),
            endTime: "",
            vendors: "",
          });
          setReceipt(null);
          setPhotos([]);
          setStage("visit");
        }
      } catch {
        setCurrentSectionIndex(0);
        setAnswers({});
        setVisitData({
          startTime: new Date().toISOString().slice(11, 16),
          endTime: "",
          vendors: "",
        });
        setReceipt(null);
        setPhotos([]);
        setStage("visit");
      }
      setErrors({});
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar questionário");
    } finally {
      setLoading(false);
    }
  };

  const currentSection = sections[currentSectionIndex];
  const currentQuestions = currentSection
    ? questions.filter((q) => currentSection.questionIds.includes(q.id))
    : [];

  const uploadFile = async (file: File, folder: string) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/upload`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      throw new Error(data.error || "Erro ao enviar arquivo");
    }
    return { name: file.name, url: data.url, path: data.path };
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[questionId];
        return n;
      });
    }
  };

  const validateRequired = () => {
    const newErrors: Record<string, string> = {};
    let ok = true;
    // visita
    if (!visitData.startTime) {
      newErrors["_startTime"] = "Informe o horário de início";
      ok = false;
    }
    if (!visitData.endTime) {
      newErrors["_endTime"] = "Informe o horário de término";
      ok = false;
    }
    if (!visitData.vendors.trim()) {
      newErrors["_vendors"] = "Informe o(s) vendedor(es)";
      ok = false;
    }
    // anexos obrigatórios
    if (stage === "attachments" || stage === "review") {
      if (!receipt) {
        newErrors["_receipt"] = "Anexe o comprovante de consumo";
        ok = false;
      }
    }
    currentQuestions.forEach((q) => {
      if (q.type === "intro-page" || q.type === "thank-you-page") return;
      if (q.required) {
        const v = answers[q.id];
        if (
          v === undefined ||
          v === null ||
          v === "" ||
          (Array.isArray(v) && v.length === 0)
        ) {
          newErrors[q.id] = "Esta pergunta é obrigatória.";
          ok = false;
        }
      }
    });
    setErrors(newErrors);
    return ok;
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!validateRequired()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        evaluationId,
        visitData,
        receipt,
        photos,
        answers: Object.keys(answers).map((questionId) => ({
          questionId,
          value: answers[questionId],
        })),
      };
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys/${surveyId}/responses`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao enviar respostas");
        return;
      }
      // Limpa rascunho local ao concluir o envio
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      setSuccess("Respostas enviadas com sucesso!");
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      setError("Erro ao enviar respostas");
    } finally {
      setSaving(false);
    }
  };

  const handleNextStage = () => {
    if (!validateRequired()) return;
    if (stage === "visit") {
      setStage("questions");
      window.scrollTo({ top: 0 });
      return;
    }
    if (stage === "questions") {
      // Se ainda tiver seções a avançar, avança dentro das seções
      if (currentSectionIndex < sections.length - 1) {
        setCurrentSectionIndex((i) => i + 1);
        window.scrollTo({ top: 0 });
      } else {
        setStage("attachments");
      }
      return;
    }
    if (stage === "attachments") {
      setStage("review");
      return;
    }
    if (stage === "review") {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (stage === "attachments") {
      setStage("questions");
      return;
    }
    if (stage === "questions") {
      if (currentSectionIndex > 0) {
        setCurrentSectionIndex((i) => i - 1);
        window.scrollTo({ top: 0 });
      } else {
        setStage("visit");
      }
    }
  };

  const renderQuestion = (question: Question) => {
    const hasError = !!errors[question.id];
    const buttonTextColor = "#FFFFFF";

    switch (question.type) {
      case "multiple-choice":
        return (
          <RadioGroup
            value={answers[question.id]}
            onValueChange={(val) => updateAnswer(question.id, val)}
            className="space-y-2"
          >
            {question.options?.map((option, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                style={{
                  borderRadius: theme.borderRadius,
                  borderColor: hasError ? "#EF4444" : "#E5E7EB",
                }}
              >
                <RadioGroupItem
                  value={option}
                  id={`${question.id}-${idx}`}
                  className="text-current"
                  style={{
                    color: hasError ? "#EF4444" : theme.primaryColor,
                  }}
                />
                <Label
                  htmlFor={`${question.id}-${idx}`}
                  className="flex-1 cursor-pointer"
                  style={{
                    fontFamily: theme.fontFamily,
                    color: theme.textColor,
                  }}
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "checkbox": {
        const currentValues = (answers[question.id] as string[]) || [];
        return (
          <div className="space-y-2">
            {question.options?.map((option, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                style={{
                  borderRadius: theme.borderRadius,
                  borderColor: hasError ? "#EF4444" : "#E5E7EB",
                }}
              >
                <Checkbox
                  id={`${question.id}-${idx}`}
                  checked={currentValues.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateAnswer(question.id, [...currentValues, option]);
                    } else {
                      updateAnswer(
                        question.id,
                        currentValues.filter((v) => v !== option)
                      );
                    }
                  }}
                  style={{
                    borderColor: currentValues.includes(option)
                      ? theme.primaryColor
                      : hasError
                        ? "#EF4444"
                        : undefined,
                    backgroundColor: currentValues.includes(option)
                      ? theme.primaryColor
                      : undefined,
                  }}
                />
                <Label
                  htmlFor={`${question.id}-${idx}`}
                  className="flex-1 cursor-pointer"
                  style={{
                    fontFamily: theme.fontFamily,
                    color: theme.textColor,
                  }}
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );
      }

      case "dropdown":
        return (
          <Select
            value={answers[question.id]}
            onValueChange={(val) => updateAnswer(question.id, val)}
          >
            <SelectTrigger
              className="w-full"
              style={{
                borderRadius: theme.borderRadius,
                borderColor: hasError ? "#EF4444" : undefined,
              }}
            >
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent style={{ borderRadius: theme.borderRadius }}>
              {question.options?.map((option, idx) => (
                <SelectItem
                  key={idx}
                  value={option}
                  style={{ fontFamily: theme.fontFamily }}
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "text":
        return (
          <Textarea
            value={answers[question.id] || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Digite sua resposta..."
            className="min-h-[100px]"
            maxLength={question.charLimit}
            style={{
              borderRadius: theme.borderRadius,
              fontFamily: theme.fontFamily,
              borderColor: hasError ? "#EF4444" : undefined,
            }}
          />
        );

      case "rating":
        return (
          <div className="space-y-3">
            <div className="flex justify-between text-sm px-1" style={{ color: theme.textColor, opacity: 0.6 }}>
              <span>{question.scale?.minLabel || question.scale?.min}</span>
              <span>{question.scale?.maxLabel || question.scale?.max}</span>
            </div>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: (question.scale?.max || 5) - (question.scale?.min || 1) + 1 }, (_, i) => {
                const val = (question.scale?.min || 1) + i;
                const isSelected = answers[question.id] === val;
                return (
                  <button
                    key={i}
                    onClick={() => updateAnswer(question.id, val)}
                    className="p-1"
                    aria-label={`Avaliar ${val} estrelas`}
                  >
                    <Star
                      className="w-8 h-8"
                      fill={isSelected ? theme.primaryColor : "#E5E7EB"}
                      stroke={isSelected ? theme.primaryColor : "#9CA3AF"}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "rating-multi": {
        const items = (question as any).items || question.options || ["Item 1", "Item 2"];
        const max = (question as any).maxRating || 5;
        const current = (answers[question.id] as Record<string, number>) || {};
        return (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-lg p-3">
                <span className="text-sm text-gray-800">{item}</span>
                <div className="flex gap-1">
                  {Array.from({ length: max }, (_, i) => {
                    const val = i + 1;
                    const selected = current[item] === val;
                    return (
                      <button
                        key={val}
                        onClick={() => updateAnswer(question.id, { ...current, [item]: val })}
                        className="p-0.5"
                        aria-label={`Avaliar ${item} com ${val} estrelas`}
                      >
                        <Star
                          className="w-6 h-6"
                          fill={selected ? theme.primaryColor : "#E5E7EB"}
                          stroke={selected ? theme.primaryColor : "#9CA3AF"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      }

      case "matrix": {
        const rows = (question as any).matrixRows || ["Item 1", "Item 2"];
        const cols = (question as any).matrixCols || ["Ruim", "Regular", "Bom", "Ótimo"];
        const current = (answers[question.id] as Record<string, string>) || {};
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left text-gray-600">Itens</th>
                  {cols.map((col, idx) => (
                    <th key={idx} className="p-2 text-center text-gray-600">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-t">
                    <td className="p-2 font-medium text-gray-800">{row}</td>
                    {cols.map((col, cIdx) => {
                      const selected = current[row] === col;
                      return (
                        <td key={cIdx} className="p-2 text-center">
                          <button
                            onClick={() => updateAnswer(question.id, { ...current, [row]: col })}
                            className="w-5 h-5 rounded-full border"
                            style={{
                              borderColor: selected
                                ? theme.primaryColor
                                : hasError
                                  ? "#EF4444"
                                  : "#D1D5DB",
                              backgroundColor: selected ? theme.primaryColor : "white",
                            }}
                            aria-label={`Selecionar ${col} para ${row}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "likert":
        return (
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center px-2 relative">
              <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-gray-200 -z-10" />
              {Array.from(
                {
                  length:
                    (question.scale?.max || 5) -
                    (question.scale?.min || 1) +
                    1,
                },
                (_, i) => {
                  const val = (question.scale?.min || 1) + i;
                  const isSelected = answers[question.id] === val;
                  return (
                    <button
                      key={i}
                      onClick={() => updateAnswer(question.id, val)}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-all z-0 hover:border-gray-400"
                      style={{
                        borderColor: isSelected
                          ? theme.primaryColor
                          : hasError
                            ? "#EF4444"
                            : "#D1D5DB",
                        transform: isSelected ? "scale(1.1)" : "none",
                        boxShadow: isSelected
                          ? `0 0 0 4px ${theme.primaryColor}33`
                          : "none",
                      }}
                    >
                      {isSelected && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: theme.primaryColor }}
                        />
                      )}
                    </button>
                  );
                }
              )}
            </div>
            <div
              className="flex justify-between text-sm font-medium"
              style={{ color: theme.textColor, opacity: 0.6 }}
            >
              <span>{question.scale?.minLabel}</span>
              <span>{question.scale?.maxLabel}</span>
            </div>
          </div>
        );

      case "nps":
        return (
          <div className="space-y-3">
            <div className="flex gap-1 w-full overflow-x-auto pb-2 whitespace-nowrap px-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                const isSelected = answers[question.id] === n;
                let bgColor = "bg-gray-50";
                let borderColor = "border-gray-200";

                if (isSelected) {
                  if (n <= 6) {
                    bgColor = "bg-red-600";
                    borderColor = "border-red-600";
                  } else if (n <= 8) {
                    bgColor = "bg-yellow-500";
                    borderColor = "border-yellow-500";
                  } else {
                    bgColor = "bg-green-600";
                    borderColor = "border-green-600";
                  }
                }

                if (hasError && !isSelected) {
                  borderColor = "border-red-500";
                }

                return (
                  <button
                    key={n}
                    onClick={() => updateAnswer(question.id, n)}
                    className={`h-9 border flex items-center justify-center text-xs font-medium transition-all flex-none min-w-[32px] px-2 ${!isSelected ? "hover:bg-gray-100" : ""} ${isSelected ? bgColor + " " + borderColor + " text-white" : borderColor}`}
                    style={{
                      borderRadius: theme.borderRadius,
                      fontFamily: theme.fontFamily,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs mt-1 text-gray-600">
              <span>Nem um pouco provável</span>
              <span>Extremamente provável</span>
            </div>
          </div>
        );

      case "intro-page":
        return (
          <div className="text-center py-12">
            <Button
              onClick={handleNext}
              size="lg"
              className="mt-8 w-full sm:w-auto hover:opacity-90"
              style={{
                backgroundColor: theme.primaryColor,
                borderRadius: theme.borderRadius,
                color: "#FFFFFF",
              }}
            >
              Começar
            </Button>
          </div>
        );

      case "thank-you-page":
        return (
          <div className="text-center py-12">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{
                backgroundColor: `${theme.primaryColor}20`,
                color: theme.primaryColor,
              }}
            >
              ✓
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-gray-100 rounded text-sm text-gray-500">
            Tipo de pergunta não suportado.
          </div>
        );
    }
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="mb-4 sm:mb-6">
          <h3 className="text-lg font-bold text-gray-900">
            {surveyTitle || "Questionário"}
          </h3>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
        </div>

        {loading ? (
          <div className="text-center rounded-lg shadow p-4 sm:p-6 border">
            Carregando questionário...
          </div>
        ) : (
          <>
            {/* Etapas simples */}
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
              <span className={`px-2 py-1 rounded ${stage === "visit" ? "bg-blue-100 text-blue-800" : ""}`}>1. Dados da visita</span>
              <span className={`px-2 py-1 rounded ${stage === "questions" ? "bg-blue-100 text-blue-800" : ""}`}>2. Questionário</span>
              <span className={`px-2 py-1 rounded ${stage === "attachments" ? "bg-blue-100 text-blue-800" : ""}`}>3. Anexos</span>
              <span className={`px-2 py-1 rounded ${stage === "review" ? "bg-blue-100 text-blue-800" : ""}`}>4. Revisão</span>
            </div>

            {/* Bloco de dados da visita apenas na primeira etapa */}
            {stage === "visit" && (
              <div className="space-y-3 mb-4 w-full max-w-full">
                <div className="text-sm font-semibold text-gray-800">Dados da visita</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="w-full">
                    <label className="text-sm text-gray-700">Início</label>
                    <input
                      type="time"
                      className="w-full border rounded-md px-3 py-2 mt-1"
                      value={visitData.startTime}
                      onChange={(e) => setVisitData((v) => ({ ...v, startTime: e.target.value }))}
                    />
                    {errors["_startTime"] && (
                      <div className="text-xs text-red-600 mt-1">{errors["_startTime"]}</div>
                    )}
                  </div>
                  <div className="w-full">
                    <label className="text-sm text-gray-700">Término</label>
                    <input
                      type="time"
                      className="w-full border rounded-md px-3 py-2 mt-1"
                      value={visitData.endTime}
                      onChange={(e) => setVisitData((v) => ({ ...v, endTime: e.target.value }))}
                    />
                    {errors["_endTime"] && (
                      <div className="text-xs text-red-600 mt-1">{errors["_endTime"]}</div>
                    )}
                  </div>
                </div>
                <div className="w-full">
                  <label className="text-sm text-gray-700">Vendedor(es) atendentes</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 mt-1"
                    placeholder="Selecione ou digite (separe por vírgula para múltiplos)"
                    value={visitData.vendors}
                    onChange={(e) => setVisitData((v) => ({ ...v, vendors: e.target.value }))}
                  />
                  {errors["_vendors"] && (
                    <div className="text-xs text-red-600 mt-1">{errors["_vendors"]}</div>
                  )}
                </div>
                <div className="h-px bg-gray-200 mt-2" />
              </div>
            )}

            {stage === "questions" && (
              <div className="mb-4 space-y-2 w-full max-w-full">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden w-full">
                  <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{
                      width: `${(currentSectionIndex / sections.length) * 100}%`,
                      backgroundColor: theme.primaryColor,
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600 px-1 w-full">
                  <span>Página {currentSectionIndex + 1} de {sections.length}</span>
                  <span className="ml-auto">{Math.round((currentSectionIndex / sections.length) * 100)}%</span>
                </div>
              </div>
            )}

            {stage === "questions" && (
              <div className="space-y-4 w-full max-w-full">
                {currentQuestions.length > 0 ? (
                  currentQuestions.map((question) => {
                    const hasError = !!errors[question.id];
                    const isPageBlock = question.type === "intro-page" || question.type === "thank-you-page";
                    return (
                      <div
                        key={question.id}
                        className={`rounded-lg transition-all duration-300 w-full max-w-full overflow-hidden ${
                          isPageBlock
                            ? "p-6 sm:p-8 text-center bg-transparent"
                            : "p-4 sm:p-5 bg-white border shadow-sm"
                        }`}
                        style={
                          !isPageBlock
                            ? {
                                borderRadius: theme.borderRadius,
                                borderColor: hasError ? "#EF4444" : "#E5E7EB",
                                boxShadow: hasError ? "0 0 0 1px #EF4444" : undefined,
                              }
                            : {}
                        }
                      >
                        <h3
                          className={`font-semibold mb-2 ${
                            isPageBlock ? "text-2xl sm:text-3xl" : "text-lg"
                          }`}
                          style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
                        >
                          {question.title}
                        </h3>
                        {question.description && (
                          <p className="text-sm text-gray-600 mb-4">{question.description}</p>
                        )}

                        {renderQuestion(question)}

                        {hasError && (
                          <div className="mt-2 text-sm text-red-600 flex items-center gap-2">
                            <span>Esta pergunta é obrigatória.</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500">
                    Nenhuma pergunta nesta página.
                  </div>
                )}
              </div>
            )}

            {stage === "attachments" && (
              <div className="space-y-4 w-full max-w-full">
                <div className="rounded-lg border p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Comprovante de consumo (obrigatório)</h4>
                  {!receipt && (
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const uploaded = await uploadFile(file, "receipt");
                          setReceipt(uploaded);
                        } catch (err: any) {
                          setError(err.message || "Erro ao enviar comprovante");
                        }
                      }}
                    />
                  )}
                  {receipt && (
                    <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 mt-2">
                      <span className="text-sm text-gray-700 truncate">{receipt.name}</span>
                      <button
                        className="text-xs text-red-600"
                        onClick={() => setReceipt(null)}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                  {errors["_receipt"] && (
                    <div className="text-xs text-red-600 mt-1">{errors["_receipt"]}</div>
                  )}
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Fotos do local (opcional)</h4>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      try {
                        const uploadedAll = [];
                        for (const f of files) {
                          const up = await uploadFile(f, "photo");
                          uploadedAll.push(up);
                        }
                        setPhotos((prev) => [...prev, ...uploadedAll]);
                      } catch (err: any) {
                        setError(err.message || "Erro ao enviar fotos");
                      }
                    }}
                  />
                  {photos.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {photos.map((p, idx) => (
                        <div
                          key={p.path + idx}
                          className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                        >
                          <span className="text-sm text-gray-700 truncate">{p.name}</span>
                          <button
                            className="text-xs text-red-600"
                            onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {stage === "review" && (
              <div className="space-y-4 w-full max-w-full">
                <div className="rounded-lg border p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-900 mb-3">Revisão</h4>
                  <div className="space-y-2 text-sm text-gray-800">
                    <div><strong>Início:</strong> {visitData.startTime || "-"}</div>
                    <div><strong>Término:</strong> {visitData.endTime || "-"}</div>
                    <div><strong>Vendedores:</strong> {visitData.vendors || "-"}</div>
                    <div><strong>Comprovante:</strong> {receipt ? receipt.name : "Pendente"}</div>
                    <div><strong>Fotos:</strong> {photos.length} anexos</div>
                  </div>
                </div>
              </div>
            )}

            {/* Navegação */}
            <div className="flex flex-col sm:flex-row items-center justify-end mt-6 gap-3">
              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={handleBack}
                  disabled={saving || (stage === "visit" && true)}
                  style={{ borderRadius: theme.borderRadius }}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1 sm:flex-none"
                  onClick={handleNextStage}
                  disabled={saving}
                  style={{
                    backgroundColor: theme.primaryColor,
                    borderRadius: theme.borderRadius,
                  }}
                >
                  {stage === "review"
                    ? saving
                      ? "Enviando..."
                      : "Enviar respostas"
                    : "Próxima"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      {(uploading || saving) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <div className="text-sm text-gray-800">
              {uploading ? "Enviando arquivo..." : "Enviando sua avaliação..."}
            </div>
          </div>
        </div>
      )}
    </div>
);
}
