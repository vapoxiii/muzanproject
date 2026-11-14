// Réglages lus au moment de la construction (fichier .env, voir .env.example).
// Sans adresse Supabase, l'app fonctionne entièrement en local, comme avant.

const env = import.meta.env || {};

export const SUPABASE_URL = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
export const CLOUD_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Version du texte de consentement affiché à la connexion (à changer si le texte change).
export const CONSENT_VERSION = '2026-10-26';

// Nom de la session dans localStorage (supabase-js).
export const AUTH_STORAGE_KEY = 'ms-auth';

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
