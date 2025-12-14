import { useEffect, useState } from "react";
import { Layout } from "./Layout";
import { Dashboard } from "../questEditor/src/components/Dashboard";
import { SurveyEditor } from "../questEditor/src/components/SurveyEditor";
import { Survey } from "../questEditor/src/types";
import { toEditor, toBackendPayload, defaultTheme } from "../questEditorAdapter";
import { projectId } from "../utils/supabase/info";
import "../questEditor/src/index.css";

interface Props {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function QuestEditorPage({ user, accessToken, onNavigate, onLogout }: Props) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys`,
        { headers }
      );
      const data = await res.json();
      if (res.ok) {
        const list = (data.surveys || []).map((s: any) =>
          toEditor(s, [], [])
        );
        setSurveys(list);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSurvey = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys/${id}`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok) return;
      const survey = toEditor(data.survey, data.sections || [], (data.sections || []).flatMap((s: any) => s.questions || []));
      setEditing(survey);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    const now = new Date().toISOString();
    const newSurvey: Survey = {
      id: `local-${Date.now()}`,
      title: "Novo questionário",
      status: "draft",
      createdAt: now,
      updatedAt: now,
      responseCount: 0,
      questions: [],
      sections: [
        { id: `section-${Date.now()}`, name: "Seção 1", questionIds: [] },
      ],
      theme: defaultTheme,
    };
    setEditing(newSurvey);
  };

  const handleDuplicate = (survey: Survey) => {
    const copy = {
      ...survey,
      id: `local-${Date.now()}`,
      title: `${survey.title} (cópia)`,
      status: "draft",
      updatedAt: new Date().toISOString(),
    };
    setEditing(copy);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys/${id}`,
        { method: "DELETE", headers }
      );
      if (res.ok) {
        await loadList();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (survey: Survey | null) => {
    if (!survey) return;
    setSaving(true);
    try {
      const payload = toBackendPayload(survey);
      const isLocal = survey.id.startsWith("local-");
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys${isLocal ? "" : `/${survey.id}`}`;
      const method = isLocal ? "POST" : "PUT";
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        setEditing(null);
        await loadList();
        // Se criou, opcionalmente recarregar o recém criado
        if (isLocal && data.surveyId) {
          await loadSurvey(data.surveyId);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  return (
    <Layout user={user} currentPage="quest-editor" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2">
        {editing ? (
          <>
            <div className="flex justify-end gap-2 mb-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                onClick={() => handleSave(editing)}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
            <SurveyEditor
              survey={editing}
              onBack={() => setEditing(null)}
              onUpdate={setEditing}
            />
          </>
        ) : (
          <Dashboard
            surveys={surveys}
            onCreateSurvey={handleCreate}
            onEditSurvey={(s) => loadSurvey(s.id)}
            onDeleteSurvey={handleDelete}
            onDuplicateSurvey={handleDuplicate}
          />
        )}
        {loading && <div className="mt-4 text-sm text-gray-500">Carregando...</div>}
      </div>
    </Layout>
  );
}
