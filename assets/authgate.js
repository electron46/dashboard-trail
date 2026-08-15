/* =========================================================================
   Garde de démarrage — anciennement un blocage strict (redirection forcée
   vers connexion.html si pas de session Supabase), désormais une bascule
   silencieuse : ces pages (Accueil, Activités, Détail, Analyse) fonctionnent
   toujours en local d'abord, et se resynchronisent avec Supabase en tâche de
   fond si un compte est configuré et connecté sur cet appareil (voir
   syncActivitiesWithSupabase() dans app.js, qui ne fait rien silencieusement
   si ce n'est pas le cas). Le mode "Sur cet appareil" ne doit jamais bloquer
   l'accès au produit — cohérent avec le choix déjà fait pour Plan/Objectifs/
   Profil/Équipements/Paramètres.

   Nécessite que assets/app.js soit chargé avant ce script.
   La page doit démarrer avec <html class="auth-pending"> et charger
   assets/style.css (règle .auth-pending qui masque le contenu) pour éviter
   un flash de contenu non stylé avant que ce script tourne.
   Une fois exécuté, si la page définit une fonction globale onAuthReady(),
   elle est appelée (typique : relancer un rendu après une éventuelle
   synchro Supabase des séances). ========================================================================= */
(async function bootPage() {
  document.documentElement.classList.remove('auth-pending');
  if (typeof onAuthReady === 'function') {
    try { await onAuthReady(); } catch (e) { console.error('onAuthReady a échoué :', e); }
  }
})();
