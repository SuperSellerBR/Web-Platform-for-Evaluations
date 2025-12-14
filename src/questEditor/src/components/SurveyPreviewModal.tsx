import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Question, Section, Theme } from "../types";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Star,
} from "lucide-react";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

interface SurveyPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: Question[];
  sections: Section[];
  theme: Theme;
}

export function SurveyPreviewModal({
  open,
  onOpenChange,
  questions,
  sections,
  theme,
}: SurveyPreviewModalProps) {
  const [currentSectionIndex, setCurrentSectionIndex] =
    useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>(
    {},
  );

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentSectionIndex(0);
      setAnswers({});
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const currentSection = sections[currentSectionIndex];
  const currentQuestions = currentSection
    ? questions.filter((q) =>
        currentSection.questionIds.includes(q.id),
      )
    : [];

  const isFirstSection = currentSectionIndex === 0;
  const isLastSection =
    currentSectionIndex === sections.length - 1;

  const validateSection = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    currentQuestions.forEach((question) => {
      // Skip validation for intro/thank-you pages mostly, unless specific requirement
      if (
        question.type === "intro-page" ||
        question.type === "thank-you-page"
      )
        return;

      if (question.required) {
        const val = answers[question.id];
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0)
        ) {
          newErrors[question.id] =
            "Esta pergunta é obrigatória.";
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (!validateSection()) {
      // Scroll to top to see errors
      const scrollContainer = document.querySelector(
        ".overflow-y-auto",
      );
      if (scrollContainer)
        scrollContainer.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      return;
    }

    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      window.scrollTo(0, 0);
    } else {
      // Submit logic (mock)
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleAnswerChange = (
    questionId: string,
    value: any,
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    // Clear error if exists
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  // Helper to determine contrast color (simple version)
  const buttonTextColor = "#FFFFFF";

  const renderQuestion = (question: Question) => {
    const hasError = !!errors[question.id];
    const errorStyle = hasError
      ? { borderColor: "#EF4444" }
      : {};

    switch (question.type) {
      case "multiple-choice":
        return (
          <RadioGroup
            value={answers[question.id]}
            onValueChange={(val) =>
              handleAnswerChange(question.id, val)
            }
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
                    color: hasError
                      ? "#EF4444"
                      : theme.primaryColor,
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

      case "checkbox":
        const currentValues =
          (answers[question.id] as string[]) || [];
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
                      handleAnswerChange(question.id, [
                        ...currentValues,
                        option,
                      ]);
                    } else {
                      handleAnswerChange(
                        question.id,
                        currentValues.filter(
                          (v) => v !== option,
                        ),
                      );
                    }
                  }}
                  style={{
                    borderColor: currentValues.includes(option)
                      ? theme.primaryColor
                      : hasError
                        ? "#EF4444"
                        : undefined,
                    backgroundColor: currentValues.includes(
                      option,
                    )
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

      case "dropdown":
        return (
          <Select
            value={answers[question.id]}
            onValueChange={(val) =>
              handleAnswerChange(question.id, val)
            }
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
            <SelectContent
              style={{ borderRadius: theme.borderRadius }}
            >
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
            onChange={(e) =>
              handleAnswerChange(question.id, e.target.value)
            }
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
                    onClick={() => handleAnswerChange(question.id, val)}
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

      case "slider": {
        const min = question.scale?.min ?? 0;
        const max = question.scale?.max ?? 10;
        const step = question.scale?.step ?? 1;
        const val = answers[question.id] ?? Math.round((min + max) / 2);
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={val}
              onChange={(e) => handleAnswerChange(question.id, Number(e.target.value))}
              className="w-full accent-[#2C5F66]"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{question.scale?.minLabel || min}</span>
              <span>{val}</span>
              <span>{question.scale?.maxLabel || max}</span>
            </div>
          </div>
        );
      }

      case "likert":
        return (
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center px-2 relative">
              {/* Line behind */}
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
                  const isSelected =
                    answers[question.id] === val;
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        handleAnswerChange(question.id, val)
                      }
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-all z-0 hover:border-gray-400"
                      style={{
                        borderColor: isSelected
                          ? theme.primaryColor
                          : hasError
                            ? "#EF4444"
                            : "#D1D5DB",
                        transform: isSelected
                          ? "scale(1.1)"
                          : "none",
                        boxShadow: isSelected
                          ? `0 0 0 4px ${theme.primaryColor}33`
                          : "none", // 33 = 20% opacity hex
                      }}
                    >
                      {isSelected && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: theme.primaryColor,
                          }}
                        />
                      )}
                    </button>
                  );
                },
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
            <div className="flex gap-1 overflow-x-auto pb-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                const isSelected = answers[question.id] === n;
                let bgColor = "bg-gray-50";
                let textColor = theme.textColor;
                let borderColor = "border-gray-200";

                if (isSelected) {
                  textColor = "white";
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
                    onClick={() =>
                      handleAnswerChange(question.id, n)
                    }
                    className={`flex-1 min-w-[36px] h-10 border flex items-center justify-center text-sm font-medium transition-all ${!isSelected ? "hover:bg-gray-100" : ""} ${isSelected ? bgColor + " " + borderColor + " " + textColor : borderColor}`}
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
            <div
              className="flex justify-between text-xs"
              style={{ color: theme.textColor, opacity: 0.6 }}
            >
              <span>Nem um pouco provável</span>
              <span>Extremamente provável</span>
            </div>
          </div>
        );

      case "rating-multi": {
        const items = question.items || question.options || ["Item 1", "Item 2"];
        const max = question.maxRating || 5;
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
                        onClick={() =>
                          handleAnswerChange(question.id, { ...current, [item]: val })
                        }
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
        const rows = question.matrixRows || ["Item 1", "Item 2"];
        const cols = question.matrixCols || ["Ruim", "Regular", "Bom", "Ótimo"];
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
                            onClick={() =>
                              handleAnswerChange(question.id, { ...current, [row]: col })
                            }
                            className="w-5 h-5 rounded-full border"
                            style={{
                              borderColor: selected
                                ? theme.primaryColor
                                : hasError
                                  ? "#EF4444"
                                  : "#D1D5DB",
                              backgroundColor: selected ? theme.primaryColor : "white",
                            }}
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
                color: buttonTextColor,
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
              <Check className="w-10 h-10" />
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-screen h-screen max-w-none p-0 gap-0 overflow-hidden flex flex-col"
        style={{
          backgroundColor: theme.backgroundColor,
          fontFamily: theme.fontFamily,
        }}
      >
        {/* Top Bar */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="font-semibold text-gray-900 text-base">
              Pré-visualização
            </DialogTitle>
            <DialogDescription className="sr-only">
              Visualize e teste seu questionário.
            </DialogDescription>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
              Modo Teste
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-4">
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Progresso
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: theme.primaryColor }}
              >
                {Math.round(
                  (currentSectionIndex / sections.length) * 100,
                )}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-200 shrink-0">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${(currentSectionIndex / sections.length) * 100}%`,
              backgroundColor: theme.primaryColor,
            }}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-12 pb-32">
            {currentQuestions.length > 0 ? (
              <div className="space-y-8">
                {currentQuestions.map((question) => {
                  const hasError = !!errors[question.id];
                  return (
                    <div
                      key={question.id}
                      className={`rounded-xl overflow-hidden transition-all duration-300 ${
                        question.type === "intro-page" ||
                        question.type === "thank-you-page"
                          ? "p-12 text-center bg-transparent"
                          : "bg-white p-8 shadow-sm border"
                      }`}
                      style={
                        question.type !== "intro-page" &&
                        question.type !== "thank-you-page"
                          ? {
                              borderRadius: theme.borderRadius,
                              borderColor: hasError
                                ? "#EF4444"
                                : "#E5E7EB",
                              boxShadow: hasError
                                ? "0 0 0 1px #EF4444"
                                : undefined,
                            }
                          : {}
                      }
                    >
                      <h3
                        className={`font-semibold mb-2 ${
                          question.type === "intro-page" ||
                          question.type === "thank-you-page"
                            ? "text-3xl"
                            : "text-lg"
                        }`}
                        style={{
                          color: hasError
                            ? "#EF4444"
                            : theme.textColor,
                        }}
                      >
                        {question.title}
                        {question.required && (
                          <span className="text-red-500 ml-1">
                            *
                          </span>
                        )}
                      </h3>

                      {question.description && (
                        <p
                          className="mb-6 text-base leading-relaxed"
                          style={{
                            color: theme.textColor,
                            opacity: 0.8,
                          }}
                        >
                          {question.description}
                        </p>
                      )}

                      {renderQuestion(question)}

                      {hasError && (
                        <div className="mt-3 flex items-center gap-2 text-red-500 text-sm font-medium animate-in slide-in-from-top-1 fade-in-0">
                          <AlertCircle className="w-4 h-4" />
                          {errors[question.id]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="text-center py-20"
                style={{ color: theme.textColor, opacity: 0.5 }}
              >
                <p>Esta página não contém perguntas.</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="bg-white border-t p-6 shrink-0">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isFirstSection}
              className={`gap-2 ${isFirstSection ? "invisible" : ""}`}
              style={{ color: theme.textColor }}
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>

            {!isLastSection
              ? !currentQuestions.some(
                  (q) => q.type === "intro-page",
                ) && (
                  <Button
                    onClick={handleNext}
                    className="px-8 hover:opacity-90"
                    style={{
                      backgroundColor: theme.primaryColor,
                      borderRadius: theme.borderRadius,
                      color: buttonTextColor,
                    }}
                  >
                    Próximo
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )
              : !currentQuestions.some(
                  (q) => q.type === "thank-you-page",
                ) && (
                  <Button
                    onClick={handleNext}
                    className="bg-green-600 hover:bg-green-700 text-white px-8"
                    style={{ borderRadius: theme.borderRadius }}
                  >
                    Concluir
                    <Check className="w-4 h-4 ml-2" />
                  </Button>
                )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
