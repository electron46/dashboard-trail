/* =========================================================================
   Garde d'accès — réservé aux pages migrées vers le nouveau modèle
   "Supabase = source principale + cache local" (Accueil, Activités pour
   l'instant). Les autres pages (Plan, Objectifs, Profil, Équipements,
   Paramètres) restent accessibles sans connexion tant qu'elles n'ont pas
   été refaites.

   Nécessite que assets/app.js soit chargé avant ce script.
   La page doit démarrer avec <html class="auth-pending"> et charger
   assets/style.css (règle .auth-pending qui masque le contenu) pour éviter
   un flash de données avant la redirection éventuelle vers connexion.html.
   Une fois la session confirmée, si la page définit une fonction globale
   onAuthReady(), elle est appelée (typique : relancer un rendu après la
   synchro Supabase des séances). ========================================================================= */
(async function requireAuth() {
  const redirectToLogin = () => {
    location.replace('connexion.html?next=' + encodeURIComponent(location.pathname + location.search));
  };
  const client = getSupabaseClient();
  if (!client) { redirectToLogin(); return; }
  let session = null;
  try {
    const { data } = await client.auth.getSession();
    session = data ? data.session : null;
  } catch (e) { redirectToLogin(); return; }
  if (!session) { redirectToLogin(); return; }
  document.documentElement.classList.remove('auth-pending');
  if (typeof onAuthReady === 'function') {
    try { await onAuthReady(); } catch (e) { console.error('onAuthReady a échoué :', e); }
  }
})();
