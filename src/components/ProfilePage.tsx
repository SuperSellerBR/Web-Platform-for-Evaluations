import { useEffect, useState } from "react";
import { Layout } from "./Layout";
import { projectId } from "../utils/supabase/info";

interface ProfilePageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function ProfilePage({ user, accessToken, onNavigate, onLogout }: ProfilePageProps) {
  const [form, setForm] = useState({ name: user.name || "", phone: user.phone || "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (user.role === "evaluator") {
      loadEvaluatorStats();
    }
  }, [user.evaluatorId]);

  const loadEvaluatorStats = async () => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations?evaluatorId=${user.evaluatorId}`,
        { headers }
      );
      const data = await res.json();
      const completed = (data.evaluations || []).filter((e: any) => e.status === "completed" && e.managerRating);
      if (completed.length) {
        const avg = completed.reduce((sum: number, e: any) => sum + (e.managerRating || 0), 0) / completed.length;
        setAvgRating(parseFloat(avg.toFixed(2)));
      } else {
        setAvgRating(null);
      }
    } catch (err) {
      console.error("Error loading stats", err);
    }
  };

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/auth/me`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: form.name, phone: form.phone }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Erro ao salvar");
      } else {
        setMessage("Dados atualizados com sucesso.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout user={user} currentPage="profile" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-gray-900 mb-2">Perfil</h2>
          <p className="text-gray-600">Atualize seus dados e veja informações da sua conta.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Nome</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input className="w-full border rounded-md px-3 py-2 bg-gray-100 text-gray-500" value={user.email} disabled />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Telefone</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={form.phone || ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-3 sm:py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-60 w-full sm:w-auto"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
          {message && <p className="text-sm text-gray-700">{message}</p>}
        </div>

        {user.role === "evaluator" && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-2">
            <h3 className="text-gray-900">Desempenho</h3>
            <p className="text-gray-600 text-sm">
              Média das notas dadas pelos gerentes:{" "}
              {avgRating !== null ? <span className="font-semibold">{avgRating} / 5</span> : "Sem avaliações ainda"}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
