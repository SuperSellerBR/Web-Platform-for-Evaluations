import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onAddQuestion: () => void;
  onDeleteQuestion: () => void;
  onDuplicateQuestion: () => void;
  selectedQuestionId: string | null;
}

export function KeyboardShortcuts({
  onAddQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  selectedQuestionId,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + N: Add new question
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        onAddQuestion();
      }

      // Delete/Backspace: Delete selected question
      if (selectedQuestionId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onDeleteQuestion();
      }

      // Ctrl/Cmd + D: Duplicate selected question
      if (selectedQuestionId && (e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onDuplicateQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAddQuestion, onDeleteQuestion, onDuplicateQuestion, selectedQuestionId]);

  return null;
}
