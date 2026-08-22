/* =============================================================================
   ELEV — service worker
   Audit ELEV 2.0, P2-10 / PWA-01. Décision utilisateur (2026-08-22) : tenir la
   promesse plutôt que la retirer.

   Constat de départ : un manifeste existait, l'application était donc
   installable et apparaissait comme une app sur l'écran d'accueil — mais aucun
   service worker n'existait. Hors réseau, l'icône ouvrait une page d'erreur.

   CE QUI FONCTIONNE HORS LIGNE
     - toutes les pages, le CSS, le JavaScript, les icônes et les images ;
     - toutes tes données : elles sont déjà dans le navigateur (localStorage),
       le réseau n'a jamais été nécessaire pour les lire.

   CE QUI NE FONCTIONNE PAS HORS LIGNE, ET POURQUOI
     - la carte GPS d'une séance : les tuiles OpenStreetMap sont chargées à la
       demande depuis leurs serveurs, et les mettre en cache reviendrait à
       stocker des fonds de carte que l'utilisateur n'a pas demandés ;
     - les fonctions IA : elles passent par une fonction serveur authentifiée ;
     - la synchronisation Supabase.
   Ces trois cas échouent PROPREMENT : la page s'affiche, seule la zone
   concernée dit qu'elle a besoin du réseau. Rien n'est jamais servi depuis un
   cache en le faisant passer pour frais.

   STRATÉGIE DE CACHE — délibérément simple, un défaut de cache étant plus
   coûteux qu'un défaut d'optimisation :
     - navigations (documents HTML) : RÉSEAU D'ABORD, cache en secours.
     - CODE APPLICATIF (.js, .css) : RÉSEAU D'ABORD également, cache en secours.
       C'était initialement du cache-d'abord, et c'était une erreur : le cache
       n'étant rafraîchi qu'APRÈS avoir servi, toute modification d'app.js ou de
       style.css laissait le premier chargement exécuter l'ANCIENNE version. Il
       fallait recharger deux fois pour voir un correctif — et dans un projet sans
       build, où CACHE_NAME se met à jour à la main, cette version finit par être
       oubliée et l'utilisateur reste sur du code périmé sans comprendre pourquoi.
       Le coût est nul hors ligne (le cache prend le relais) et se limite en ligne
       à une requête conditionnelle par fichier.
     - médias et manifeste (images, icônes, .webp) : CACHE D'ABORD. Ceux-là ne
       changent pas silencieusement et pèsent lourd.
     - tout le reste (tuiles OSM, Supabase, CDN, polices Google) : RÉSEAU SEUL,
       jamais mis en cache.

   MISE À JOUR : changer CACHE_NAME suffit. L'ancien cache est supprimé à
   l'activation, et `clients.claim()` fait prendre la main immédiatement.
   ============================================================================= */

const CACHE_NAME = 'elev-v2';

/* Coquille applicative. Volontairement explicite plutôt que découverte
   dynamiquement : on sait exactement ce qui est stocké. */
const APP_SHELL = [
  './',
  'index.html',
  'historique.html',
  'activite.html',
  'analyse.html',
  'objectifs.html',
  'plan.html',
  'profil.html',
  'equipements.html',
  'parametres.html',
  'connexion.html',
  'onboarding.html',
  'composants.html',
  'assets/style.css',
  'assets/app.js',
  'assets/elev-data-quality.js',
  'assets/elev-terrain.js',
  'assets/elev-insight.js',
  'assets/authgate.js',
  'assets/icon.svg',
  'assets/logo-full.png',
  'manifest.json',
  'assets/images/elev-hero-mountain.webp',
  'assets/images/elev-secondary-dark.webp',
  'assets/images/elev-target-summit.webp',
  'assets/images/elev-profile-terrain-a.webp',
  'assets/images/elev-profile-terrain-b.webp',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    /* `addAll` échoue en bloc si UNE seule ressource manque, ce qui laisserait
       l'application sans aucun cache. On ajoute donc une par une et on tolère
       les absences : un asset renommé ne doit pas priver l'utilisateur du mode
       hors ligne pour tout le reste. */
    await Promise.all(APP_SHELL.map(async url => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { /* ressource absente ou injoignable : on continue */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Une ressource est-elle à nous ? Tout ce qui est hors origine (tuiles OSM,
   Supabase, jsDelivr, Google Fonts, unpkg) passe directement au réseau. */
function estInterne(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!estInterne(url)) return; // réseau seul, jamais de cache tiers

  // --- Navigations : réseau d'abord, pour ne jamais figer l'application.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const frais = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, frais.clone());
        return frais;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        const enCache = await cache.match(req) || await cache.match('index.html');
        if (enCache) return enCache;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Hors ligne — ELEV</title>' +
          '<body style="font-family:system-ui;background:#0C0F0E;color:#F0F3F0;padding:32px">' +
          '<h1>Hors ligne</h1><p>Cette page n\'a pas encore été consultée sur cet appareil, ' +
          'ELEV ne peut donc pas l\'afficher sans réseau. Tes données locales, elles, sont intactes.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        );
      }
    })());
    return;
  }

  /* --- Code applicatif : réseau d'abord, cache en secours.
     Un fichier .js ou .css périmé ne dégrade pas l'application, il la CASSE — et de façon
     invisible, puisque la page s'affiche normalement en exécutant l'ancienne logique. */
  const estCodeApplicatif = /\.(?:js|css)$/i.test(url.pathname);
  if (estCodeApplicatif) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const frais = await fetch(req);
        if (frais && frais.status === 200) cache.put(req, frais.clone());
        return frais;
      } catch (e) {
        const enCache = await cache.match(req);
        return enCache || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // --- Médias et manifeste : cache d'abord, rafraîchi en arrière-plan.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const enCache = await cache.match(req);
    const reseau = fetch(req).then(rep => {
      if (rep && rep.status === 200 && rep.type === 'basic') cache.put(req, rep.clone());
      return rep;
    }).catch(() => null);
    return enCache || (await reseau) || new Response('', { status: 504 });
  })());
});
