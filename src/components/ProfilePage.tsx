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
  const [form, setForm] = useState({ name: user.name || "", lastName: user.lastName || "", phone: user.phone || "" });
  const [avatar, setAvatar] = useState<{ url?: string; path?: string }>({
    url: user.avatarUrl,
    path: user.avatarPath,
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

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
          body: JSON.stringify({
            name: form.name,
            lastName: form.lastName,
            phone: form.phone,
            avatarUrl: avatar.url,
            avatarPath: avatar.path,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Erro ao salvar");
      } else {
        setMessage("Dados atualizados com sucesso.");
        try {
          const key =
            (user?.id && `app:avatar:${user.id}`) ||
            (user?.email && `app:avatar:${user.email}`) ||
            "app:avatar";
          if (avatar.url) {
            localStorage.setItem(key, avatar.url);
          } else {
            localStorage.removeItem(key);
          }
          window.dispatchEvent(new CustomEvent("avatarchange", { detail: { url: avatar.url || "" } }));
        } catch {}
      }
    } catch (err) {
      console.error(err);
      setMessage("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const loadEvaluatorAvatar = async () => {
      if (user.role !== "evaluator" || !user.evaluatorId) return;
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators/${user.evaluatorId}`,
          { headers }
        );
        const data = await res.json();
        if (!res.ok) return;
        if (data?.avatarUrl || data?.avatarPath) {
          setAvatar({ url: data.avatarUrl, path: data.avatarPath });
          try {
            const key =
              (user?.id && `app:avatar:${user.id}`) ||
              (user?.email && `app:avatar:${user.email}`) ||
              "app:avatar";
            if (data.avatarUrl) {
              localStorage.setItem(key, data.avatarUrl);
              window.dispatchEvent(new CustomEvent("avatarchange", { detail: { url: data.avatarUrl } }));
            }
          } catch {}
        }
      } catch (err) {
        console.error("load evaluator avatar", err);
      }
    };
    loadEvaluatorAvatar();
  }, [accessToken, user.evaluatorId, user.id, user.email, user.role]);

  const createCircularAvatarFile = async (file: File) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const maxBytes = 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) throw new Error("Formato inválido. Envie PNG, JPG ou WEBP.");
    if (file.size > maxBytes) throw new Error("Imagem muito grande. Envie até 5MB.");

    const target = 512;
    const src = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = src;
      if ("decode" in img) {
        // @ts-expect-error decode existe em navegadores modernos
        await img.decode();
      } else {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Falha ao carregar imagem"));
        });
      }

      const w = (img as any).naturalWidth || img.width;
      const h = (img as any).naturalHeight || img.height;
      const side = Math.min(w, h);
      const sx = (w - side) / 2;
      const sy = (h - side) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = target;
      canvas.height = target;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível processar a imagem neste navegador.");

      ctx.clearRect(0, 0, target, target);
      ctx.save();
      ctx.beginPath();
      ctx.arc(target / 2, target / 2, target / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);
      ctx.restore();

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem processada"))),
          "image/png"
        );
      });

      return new File([blob], `avatar-${Date.now()}.png`, { type: "image/png" });
    } finally {
      URL.revokeObjectURL(src);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarUploading(true);
    try {
      const processed = await createCircularAvatarFile(file);
      const formDataUpload = new FormData();
      formDataUpload.append("file", processed);
      formDataUpload.append("folder", "profile-photos");

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formDataUpload,
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Erro ao enviar foto");
      setAvatar({ url: data.url, path: data.path });
      setMessage("Foto atualizada. Salve para aplicar.");
    } catch (err: any) {
      console.error("avatar upload", err);
      setMessage(err?.message || "Erro ao enviar foto");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordMessage(null);

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessage("Preencha todos os campos.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage("As senhas não conferem.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/auth/change-password`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newPassword: passwordForm.newPassword,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage(data.error || "Erro ao atualizar senha.");
      } else {
        setPasswordMessage("Senha atualizada com sucesso.");
        setPasswordForm({ newPassword: "", confirmPassword: "" });
      }
    } catch (err) {
      console.error(err);
      setPasswordMessage("Erro ao atualizar senha.");
    } finally {
      setPasswordSaving(false);
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
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
              {avatar.url ? (
                <img
                  src={avatar.url}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-lg font-semibold text-gray-700">{form.name?.charAt(0) || "?"}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarUpload}
                  className="flex-1"
                />
                {avatarUploading && (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                )}
                {avatar.path && !avatarUploading && (
                  <span className="text-green-600 text-sm">✓ Enviada</span>
                )}
              </div>
              {avatar.path && (
                <button
                  type="button"
                  onClick={() => setAvatar({ url: '', path: '' })}
                  className="mt-2 text-sm text-red-600 hover:underline"
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Nome</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Sobrenome</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Opcional"
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

        <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-gray-900">Senha</h3>
            <p className="text-gray-600 text-sm">Atualize sua senha de acesso.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Nova senha</label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Confirmar nova senha</label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handlePasswordSave}
              disabled={passwordSaving}
              className="bg-blue-600 text-white px-4 py-3 sm:py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-60 w-full sm:w-auto"
            >
              {passwordSaving ? "Salvando..." : "Atualizar senha"}
            </button>
          </div>
          {passwordMessage && <p className="text-sm text-gray-700">{passwordMessage}</p>}
        </div>
      </div>
    </Layout>
  );
}
