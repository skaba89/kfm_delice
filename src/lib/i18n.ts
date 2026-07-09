/**
 * Simple i18n system for KFM Delice.
 * Supports French (default) and English.
 * Translations are stored as flat key-value pairs.
 */

export type Locale = 'fr' | 'en';

const DEFAULT_LOCALE: Locale = 'fr';

// ── Translations ───────────────────────────────────────────────

const translations: Record<Locale, Record<string, string>> = {
  fr: {
    // Common
    'common.loading': 'Chargement...',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.add': 'Ajouter',
    'common.search': 'Rechercher',
    'common.confirm': 'Confirmer',
    'common.close': 'Fermer',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.previous': 'Précédent',
    'common.yes': 'Oui',
    'common.no': 'Non',

    // Auth
    'auth.login': 'Se connecter',
    'auth.logout': 'Déconnexion',
    'auth.register': "S'inscrire",
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'auth.name': 'Nom',
    'auth.welcome': 'Bienvenue',
    'auth.loginSuccess': 'Connexion réussie',
    'auth.loginFailed': 'Identifiants incorrects',
    'auth.registerSuccess': 'Inscription réussie',

    // Menu
    'menu.title': 'Menu',
    'menu.categories.entrees': 'Entrées',
    'menu.categories.plats': 'Plats Principaux',
    'menu.categories.mer': 'Fruits de Mer',
    'menu.categories.desserts': 'Desserts',
    'menu.categories.boissons': 'Boissons',
    'menu.addToCart': 'Ajouter',
    'menu.popular': 'Populaire',

    // Cart
    'cart.title': 'Votre commande',
    'cart.empty': 'Votre panier est vide',
    'cart.total': 'Total',
    'cart.checkout': 'Commander',
    'cart.table': 'Table',

    // Orders
    'order.status.pending': 'En attente',
    'order.status.preparing': 'En préparation',
    'order.status.ready': 'Prêt',
    'order.status.delivering': 'En livraison',
    'order.status.delivered': 'Livré',
    'order.status.cancelled': 'Annulé',
    'order.payment.cash': 'Espèces',
    'order.payment.orange_money': 'Orange Money',
    'order.payment.mtn_money': 'MTN MoMo',
    'order.payment.wave': 'Wave',
    'order.payment.card': 'Carte bancaire',

    // Reservations
    'reservation.title': 'Réservation',
    'reservation.date': 'Date',
    'reservation.time': 'Heure',
    'reservation.guests': 'Personnes',
    'reservation.zone': 'Zone',
    'reservation.zone.interieur': 'Intérieur',
    'reservation.zone.terrasse': 'Terrasse',
    'reservation.zone.vip': 'VIP',
    'reservation.confirm': 'Réserver',
    'reservation.confirmed': 'Réservation confirmée !',

    // Platform
    'platform.title': 'KFM Delice Platform',
    'platform.overview': 'Vue d\'ensemble',
    'platform.accounts': 'Comptes',
    'platform.restaurants': 'Restaurants',
    'platform.audit': 'Audit',
    'platform.security': 'Sécurité',
  },

  en: {
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.yes': 'Yes',
    'common.no': 'No',

    // Auth
    'auth.login': 'Sign in',
    'auth.logout': 'Sign out',
    'auth.register': 'Sign up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Name',
    'auth.welcome': 'Welcome',
    'auth.loginSuccess': 'Login successful',
    'auth.loginFailed': 'Invalid credentials',
    'auth.registerSuccess': 'Registration successful',

    // Menu
    'menu.title': 'Menu',
    'menu.categories.entrees': 'Starters',
    'menu.categories.plats': 'Main Courses',
    'menu.categories.mer': 'Seafood',
    'menu.categories.desserts': 'Desserts',
    'menu.categories.boissons': 'Drinks',
    'menu.addToCart': 'Add',
    'menu.popular': 'Popular',

    // Cart
    'cart.title': 'Your order',
    'cart.empty': 'Your cart is empty',
    'cart.total': 'Total',
    'cart.checkout': 'Order',
    'cart.table': 'Table',

    // Orders
    'order.status.pending': 'Pending',
    'order.status.preparing': 'Preparing',
    'order.status.ready': 'Ready',
    'order.status.delivering': 'Delivering',
    'order.status.delivered': 'Delivered',
    'order.status.cancelled': 'Cancelled',
    'order.payment.cash': 'Cash',
    'order.payment.orange_money': 'Orange Money',
    'order.payment.mtn_money': 'MTN MoMo',
    'order.payment.wave': 'Wave',
    'order.payment.card': 'Credit card',

    // Reservations
    'reservation.title': 'Reservation',
    'reservation.date': 'Date',
    'reservation.time': 'Time',
    'reservation.guests': 'Guests',
    'reservation.zone': 'Zone',
    'reservation.zone.interieur': 'Indoor',
    'reservation.zone.terrasse': 'Terrace',
    'reservation.zone.vip': 'VIP',
    'reservation.confirm': 'Book',
    'reservation.confirmed': 'Reservation confirmed!',

    // Platform
    'platform.title': 'KFM Delice Platform',
    'platform.overview': 'Overview',
    'platform.accounts': 'Accounts',
    'platform.restaurants': 'Restaurants',
    'platform.audit': 'Audit',
    'platform.security': 'Security',
  },
};

// ── Locale detection ───────────────────────────────────────────

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem('kfm-locale');
    if (stored === 'fr' || stored === 'en') return stored;
  } catch { /* localStorage not available */ }

  // Detect from browser
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('kfm-locale', locale);
  } catch { /* localStorage not available */ }
}

// ── Translation function ───────────────────────────────────────

export function translate(key: string, locale: Locale = DEFAULT_LOCALE, params?: Record<string, string | number>): string {
  const dict = translations[locale] || translations[DEFAULT_LOCALE];
  let text = dict[key] || translations[DEFAULT_LOCALE][key] || key;

  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
    }
  }

  return text;
}

// ── React hook (client-side) ───────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, locale, params),
    [locale]
  );

  return { locale, changeLocale, t };
}
