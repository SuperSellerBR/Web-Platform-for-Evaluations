import { useEffect, useRef, useState } from "react";
import { Layout } from "./Layout";
import { projectId } from "../utils/supabase/info";
import { useTheme } from "../utils/theme";
import { ImageCropperModal } from "./ImageCropperModal";

interface ProfilePageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function ProfilePage({ user, accessToken, onNavigate, onLogout }: ProfilePageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [form, setForm] = useState({ name: user.name || "", lastName: user.lastName || "", phone: user.phone || "" });
  const [avatar, setAvatar] = useState<{ url?: string; path?: string }>({
    url: user.avatarUrl,
    path: user.avatarPath,
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarCropperFile, setAvatarCropperFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
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

  const uploadProfileAvatarFile = async (file: File) => {
    setAvatarUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
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
      setFormData((prev) => ({
        ...prev,
        avatarUrl: data.url,
        avatarPath: data.path,
      }));
      setMessage("Foto atualizada. Salve para aplicar.");
    } catch (err: any) {
      console.error("avatar upload", err);
      setMessage(err?.message || "Erro ao enviar foto");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileAvatarFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarCropperFile(file);
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
      <div className={`max-w-3xl mx-auto space-y-4 sm:space-y-6 ${isDark ? "evaluation-dark" : ""}`}>
        <div>
          <h2 className="text-foreground mb-2">Perfil</h2>
          <p className="text-muted-foreground">Atualize seus dados e veja informações da sua conta.</p>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
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
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors w-full text-left"
                  >
                    Escolher arquivo
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleProfileAvatarFileSelection}
                    className="sr-only"
                  />
                  {avatarUploading && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  )}
                  {avatar.path && !avatarUploading && (
                    <span className="text-green-500 text-sm">✓ Enviada</span>
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
            <label className="block text-sm text-muted-foreground mb-1">Nome</label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Sobrenome</label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Email</label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 bg-muted text-muted-foreground"
              value={user.email}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Telefone</label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
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
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>

        {user.role === "evaluator" && (
          <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 space-y-2">
            <h3 className="text-foreground">Desempenho</h3>
            <p className="text-muted-foreground text-sm">
              Média das notas dadas pelos gerentes:{" "}
              {avgRating !== null ? <span className="font-semibold text-foreground">{avgRating} / 5</span> : "Sem avaliações ainda"}
            </p>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-foreground">Senha</h3>
            <p className="text-muted-foreground text-sm">Atualize sua senha de acesso.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Nova senha</label>
              <input
                type="password"
                className="w-full border border-border rounded-md px-3 py-2 bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Confirmar nova senha</label>
              <input
                type="password"
                className="w-full border border-border rounded-md px-3 py-2 bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handlePasswordSave}
              disabled={passwordSaving}
              className="bg-primary text-primary-foreground px-4 py-3 sm:py-2 rounded hover:bg-primary/90 transition-colors disabled:opacity-60 w-full sm:w-auto"
            >
              {passwordSaving ? "Salvando..." : "Atualizar senha"}
            </button>
          </div>
          {passwordMessage && <p className="text-sm text-muted-foreground">{passwordMessage}</p>}
        </div>
      </div>
      {avatarCropperFile && (
        <ImageCropperModal
          file={avatarCropperFile}
          aspectRatio={1}
          targetWidth={512}
          targetHeight={512}
          circle
          onCancel={() => setAvatarCropperFile(null)}
          onCrop={(cropped) => {
            setAvatarCropperFile(null);
            uploadProfileAvatarFile(cropped);
          }}
        />
      )}
    </Layout>
  );
}
