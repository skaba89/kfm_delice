"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Full-screen modal that forces the user to change their password
 * if mustChangePassword is true. Shown on top of any protected page.
 */
export function MustChangePasswordDialog() {
  const { admin, customer, driver, apiFetch, logout } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mustChange = admin?.mustChangePassword || customer?.mustChangePassword || driver?.mustChangePassword;

  if (!mustChange) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      notify.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error("Les mots de passe ne correspondent pas");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "", // Not required when mustChangePassword is true
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        notify.success("Mot de passe modifié avec succès !");
        // Reload to refresh the user data (mustChangePassword will be false now)
        window.location.reload();
      } else {
        notify.error(data.error || "Erreur lors du changement de mot de passe");
      }
    } catch {
      notify.error("Erreur réseau. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => { /* Cannot be closed */ }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <ShieldAlert className="h-7 w-7 text-orange-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Changement de mot de passe requis
          </DialogTitle>
          <DialogDescription className="text-center">
            Pour votre sécurité, vous devez changer votre mot de passe avant de continuer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 caractères"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Retapez le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700"
            disabled={submitting || newPassword.length < 6 || newPassword !== confirmPassword}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Changement en cours...
              </span>
            ) : (
              "Changer mon mot de passe"
            )}
          </Button>

          <button
            type="button"
            onClick={logout}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-2"
          >
            Se déconnecter
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
