"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Ouvre WhatsApp avec le message pré-rempli
      const waMessage = `Nom: ${form.name}\nEmail: ${form.email}\nSujet: ${form.subject}\n\n${form.message}`;
      const waUrl = `https://wa.me/224622345678?text=${encodeURIComponent(waMessage)}`;
      window.open(waUrl, "_blank");
      toast.success("WhatsApp ouvert — envoyez votre message");
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Contactez-nous</h1>
          <p className="text-gray-600 dark:text-gray-400">Une question ? Une suggestion ? Nous sommes à votre écoute.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Infos contact */}
          <div className="space-y-4">
            <Card className="bg-white dark:bg-gray-900 border-orange-200 dark:border-white/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Téléphone</p>
                  <a href="tel:+224622345678" className="text-lg font-semibold text-gray-900 dark:text-white hover:text-orange-600">
                    +224 622 34 56 78
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-orange-200 dark:border-white/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">WhatsApp</p>
                  <a href="https://wa.me/224622345678" target="_blank" className="text-lg font-semibold text-gray-900 dark:text-white hover:text-green-600">
                    Discuter sur WhatsApp
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-orange-200 dark:border-white/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  <a href="mailto:contact@kfm-delice.com" className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600">
                    contact@kfm-delice.com
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-orange-200 dark:border-white/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Adresse</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    Almamya, Corniche Nord<br />Conakry, Guinée
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Formulaire */}
          <Card className="bg-white dark:bg-gray-900 border-orange-200 dark:border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Envoyer un message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nom *</label>
                  <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Votre nom" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Email *</label>
                  <Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="votre@email.com" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Sujet *</label>
                  <Input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Objet de votre message" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Message *</label>
                  <Textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Votre message..." rows={5} className="rounded-xl" />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl py-6">
                  <Send className="w-4 h-4 mr-2" /> Envoyer via WhatsApp
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
