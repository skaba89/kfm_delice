"use client";

import { User, Save, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CustomerProfileProps {
  profileForm: { name: string; email: string; phone: string; address: string };
  setProfileForm: (form: { name: string; email: string; phone: string; address: string }) => void;
  passwordForm: { current: string; new: string };
  setPasswordForm: (form: { current: string; new: string }) => void;
  profileSaving: boolean;
  profileMsg: string;
  saveProfile: () => void;
  savePassword: () => void;
}

export function CustomerProfile({
  profileForm,
  setProfileForm,
  passwordForm,
  setPasswordForm,
  profileSaving,
  profileMsg,
  saveProfile,
  savePassword,
}: CustomerProfileProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-emerald-500" /> Informations personnelles</h3>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nom</label><Input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
              <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Email</label><Input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
              <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Téléphone</label><Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
              <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Adresse</label><Input value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
            </div>
            <Button onClick={saveProfile} disabled={profileSaving} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
              {profileSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Enregistrer
            </Button>
          </div>
          {profileMsg && <p className={`mt-3 text-sm ${profileMsg.includes("succès") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{profileMsg}</p>}
        </CardContent>
      </Card>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Changer le mot de passe</h3>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Mot de passe actuel</label><Input type="password" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} placeholder="Votre mot de passe actuel" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
            <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nouveau mot de passe</label><Input type="password" value={passwordForm.new} onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })} placeholder="Nouveau mot de passe (min 6 caractères)" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></div>
            <Button onClick={savePassword} disabled={profileSaving || !passwordForm.current || !passwordForm.new} variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
              {profileSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Changer le mot de passe
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
