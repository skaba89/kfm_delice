"use client";

import { Phone, Mail, MapPin, Clock, MessageCircle, Smartphone } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RESTO } from "@/lib/constants";

export function PublicFooter() {
  return (
    <footer id="contact" className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/images/icon-192.png" alt="KFM Delice" loading="lazy" className="w-10 h-10 rounded-xl shadow-lg object-cover" />
              <div><p className="font-extrabold text-lg">KFM Delice</p><p className="text-[10px] text-gray-400 uppercase tracking-widest">Restaurant & Bar</p></div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{RESTO.description}</p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Navigation</h4>
            <div className="space-y-2">{["Menu", "Réserver", "Avis", "À Propos"].map(l => <a key={l} href={`#${l.toLowerCase().replace("à propos", "apropos")}`} className="block text-sm text-gray-400 hover:text-orange-400 transition-colors">{l}</a>)}</div>
          </div>
          <div>
            <h4 className="font-bold mb-4">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400"><Phone className="w-4 h-4 text-orange-400" /> {RESTO.phone}</div>
              <div className="flex items-center gap-2 text-sm text-gray-400"><Mail className="w-4 h-4 text-orange-400" /> {RESTO.email}</div>
              <div className="flex items-center gap-2 text-sm text-gray-400"><MapPin className="w-4 h-4 text-orange-400" /> {RESTO.address}</div>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-4">Horaires</h4>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2"><Clock className="w-4 h-4 text-orange-400" /> {RESTO.hours}</div>
            <p className="text-xs text-gray-500 mt-4">Livraison disponible sur Conakry</p>
          </div>
        </div>
        <Separator className="bg-gray-800 mb-8" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} KFM Delice. Tous droits réservés.</p>
          <div className="flex items-center gap-3">
            <a href="https://wa.me/224622345678" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"><MessageCircle className="w-4 h-4" /></a>
            <a href="tel:+224622345678" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"><Smartphone className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
