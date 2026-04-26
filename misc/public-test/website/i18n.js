(function () {
  const STORAGE_KEY = "skyrim_unbound_language";
  const LANGUAGE_OPTIONS = [
    { value: "en", code: "EN", label: "English", langTag: "en" },
    { value: "fr", code: "FR", label: "Français", langTag: "fr" },
    { value: "de", code: "DE", label: "Deutsch", langTag: "de" },
    { value: "tr", code: "TR", label: "Türkçe", langTag: "tr" },
    { value: "es", code: "ES", label: "Español", langTag: "es" },
    { value: "ru", code: "RU", label: "Русский", langTag: "ru" },
  ];

  const EN = {
    meta: {
      title: "Skyrim Unbound",
      description:
        "Skyrim Unbound is a one-shard Skyrim roleplay server focused on persistent characters, staff-reviewed entry, and long-form text storytelling.",
    },
    language: {
      select: "Select language",
      selector: "Language selector",
    },
    nav: {
      primary: "Primary",
      home: "Home",
      join: "How to Join",
      world: "Why Us",
      community: "Community",
      media: "Media",
      events: "Events",
      contact: "Contact",
    },
    account: {
      defaultName: "Account",
      logOut: "Log Out",
      openUcp: "Open UCP",
      signIn: "Sign In",
      install: "Download and install",
    },
    hero: {
      title: "Skyrim Unbound",
      createAccount: "Create Account",
      joinDiscord: "Join Discord",
      calendarEyebrow: "Community Events",
      calendarIntro:
        "A quieter ledger for faction meetings, conflict nights, court sessions, and server events whenever you want to check what is coming.",
      openCalendar: "Open Event Calendar",
      trailerTitle: "Skyrim Unbound Coming Soon",
      trailerSubtitle: "Current preview selection",
      worldTitle: "Experience the Ultimate Strict Roleplay Experience",
      features: [
        {
          title: "Focused lore development",
          body: "Storylines, events, and regional tension stay rooted in the setting so the world grows with intention instead of noise.",
        },
        {
          title: "Player-run world",
          body: "Economy, player housing, and businesses are meant to be owned, defended, and shaped by the people living in the shard.",
        },
        {
          title: "Official and unofficial factions",
          body: "Recognized powers and rising groups can build perks, identity, and influence through the way they organize and act.",
        },
        {
          title: "Territories and politics",
          body: "Faction territory and politically driven conflict matter on both the smaller and larger scale, so local choices can echo outward.",
        },
        {
          title: "Real consequences",
          body: "Your character's actions can shape reputation, access, trust, and the way later scenes answer back to what you have done.",
        },
        {
          title: "Room for every playstyle",
          body: "Even if the world feels colder and harsher, there is still room for quieter, lawful, social, and slower-burn characters to matter.",
        },
        {
          title: "Regular Updates",
          body: "Constant improvements and new features to enhance your experience.",
        },
        {
          title: "Strict Roleplay",
          body: "Heavy emphasis on realistic character development and immersive storytelling.",
        },
        {
          title: "Professional Staff",
          body: "Experienced team dedicated to maintaining quality roleplay standards.",
        },
      ],
    },
    join: {
      title: "How to Join",
      intro: "Everything happens in one clean flow: create your account, pass whitelist, install, and enter the world.",
      steps: [
        {
          title: "Create Your UCP",
          body: "Make your account, secure it, and set up the identity you will use across your characters and support history.",
          cta: "Create Account",
        },
        {
          title: "Submit Whitelist",
          body: "Answer the roleplay application, complete your character background, and get reviewed by Supporters and Admins.",
          cta: "Start Application",
        },
        {
          title: "Install The Client",
          body: "Get the local launcher package and connect through the supported client setup for this shard.",
          cta: "Open Launcher",
        },
        {
          title: "Enter The World",
          body: "Choose your character slot, step into the world, and build a story that stays persistent over time.",
          cta: "Manage Characters",
        },
      ],
    },
    community: {
      titleHtml: "Join Our <span>Community</span>",
      intro: "Connect with roleplayers worldwide. Share stories, get help, and stay updated.",
      cards: [
        {
          titleHtml: "Discord Community <span aria-hidden=\"true\">&#8599;</span>",
          bodyHtml: "<strong data-discord-member-copy>Live</strong> members on our Discord server. Real-time support, events, announcements, and more.",
          cta: "Join Discord Server",
          stats: [
            { value: "Live", label: "Members" },
            { value: "Checking", label: "Online" },
          ],
        },
        {
          titleHtml: "Official Forum <span aria-hidden=\"true\">&#10022;</span>",
          bodyHtml: "The official forum is being prepared. Discord is the live community hub for now.",
          cta: "Coming Soon",
          stats: [
            { value: "Soon", label: "Forum" },
            { value: "Discord", label: "Live Now" },
          ],
        },
      ],
    },
    media: {
      title: "Community Showcase",
      intro: "Moments captured from inside the shard, rotated into view as the world keeps moving.",
      labels: [
        "Show first showcase image",
        "Show second showcase image",
        "Show third showcase image",
      ],
    },
    contact: {
      eyebrow: "Creator Program",
      title: "Become an official server content creator",
      body:
        "We are looking for creators who want to spotlight events, characters, faction stories, and the slower-burn moments that make Skyrim Unbound feel alive. If you want to create videos, screenshots, shorts, or streams with official server backing, reach out and show us what you do.",
      cta: "Contact Us",
    },
    youtube: {
      text: "Subscribe to our YouTube channel for weekly content, server footage, and community updates.",
      cta: "Subscribe on YouTube",
    },
    footer: {
      legalTitle: "Rights & Disclaimer",
      legalBody:
        "Skyrim Unbound is an independent roleplay project for The Elder Scrolls V: Skyrim and is not affiliated with or endorsed by Bethesda Softworks, Bethesda Game Studios, ZeniMax Media, Microsoft, or other rights holders. All game names, marks, and related assets belong to their respective owners.",
      quickLinksTitle: "Quick Links",
      quickLinks: ["Home", "How to Join", "Why Us", "Community", "Events", "UCP", "Launcher"],
      poweredTitle: "Powered by SkyMP",
      poweredHtml:
        "Built on <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> to support persistent multiplayer Skyrim roleplay.",
      meta: "Skyrim Unbound. All rights reserved to their respective owners.",
      legalLinks: ["Terms of Use", "Privacy", "Payments"],
    },
    cookie: {
      notice:
        "This site can remember your consent and visual preferences between visits. If browser storage is blocked, it will fall back gracefully.",
      close: "Close",
      allow: "Allow",
    },
    calendar: {
      closeLabel: "Close event details",
      timeDisplayLabel: "Calendar time display",
      gridLabel: "Community event calendar",
      openLedger: "Open the road ledger",
      previous: "Previous",
      next: "Next",
      loading: "Loading events...",
      serverTime: "Server Time",
      localTime: "Local Time",
      playerRequests: "Player Requests",
      requestEvent: "Request Event",
      signInRequestEvent: "Sign In To Request Event",
      openEventRequest: "Open event request",
      ticketType: "Ticket Type",
      eventRequest: "Event Request",
      supportQuestion: "Do you need direct admin / organiser support with this request?",
      supportQuestionAria: "Do you need direct admin or organiser support with this request?",
      no: "No",
      yes: "Yes",
      subject: "Subject",
      details: "Details",
      openTicket: "Open Ticket",
      cancel: "Cancel",
      markInterested: "Mark Interested",
      removeInterest: "Remove Interest",
      signInInterest: "Sign In To Mark Interest",
      eventStarted: "Event Started",
      cancelled: "Cancelled",
      noDescription: "No description yet.",
      interestCount: "Interested: {count}",
      listedCount: "{count} listed",
      noEvents: "No events",
      noEventsForMonth: "No community events are scheduled for {month} yet.",
      noEventsForDate: "No community events are listed for this date yet.",
      quietMonth:
        "The calendar stays ready here until the next market, war council, raid, court session, or community night is scheduled.",
      quietDate:
        "If you want something scheduled here or need direct help, open a ticket below and staff can coordinate with you from the UCP.",
      ledgerIntro:
        "The calendar sits off to the side until you decide to step into it. When a market, war council, raid, or community night matters to you, open the entry and follow the details from there.",
      monthMetaLede: "{count} listed",
      dateSelectUpcoming: "Upcoming on {date}: {count}. Select one below to read the full description.",
      dateSelectListed: "Listed on {date}: {count}. Select one below to read the full description.",
      createdBy: "Created by {name}",
      dateSelected: "Selected date",
      weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      monthLabels: [
        "Morning Star",
        "Sun's Dawn",
        "First Seed",
        "Rain's Hand",
        "Second Seed",
        "Mid Year",
        "Sun's Height",
        "Last Seed",
        "Hearthfire",
        "Frostfall",
        "Sun's Dusk",
        "Evening Star",
      ],
      eventStatus: {
        SCHEDULED: "SCHEDULED",
        CANCELLED: "CANCELLED",
        COMPLETED: "COMPLETED",
      },
      timeMeta: {
        showingHost: "Showing host time.",
        showingLocal: "Showing your local browser time.",
        hostMatches: "Host {offset}. Your browser matches the host this month.",
        hostBehind: "Host {offset}. You are {difference} behind the host this month.",
        hostAhead: "Host {offset}. You are {difference} ahead of the host this month.",
      },
      heroAlert: {
        openNow: "Open Now",
        liveAria: "Live now: {title}",
        upcomingAria: "Upcoming within the next twenty-four hours: {title}",
        liveKicker: "Live right now",
        upcomingKicker: "Within the next 24 hours",
        startedAt: "Started {time}",
        plusMore: "+{count} more",
        liveCopy: "This event started less than an hour ago. Open the calendar to jump into the details and mark interest.",
        liveCopyMore: "This event started less than an hour ago. More events are scheduled soon in the same window.",
        upcomingCopy: "This event is coming up soon. Open the calendar to read the full details and mark interest.",
        upcomingCopyMore: "This event is coming up soon. More events also land inside the same twenty-four-hour window.",
      },
      ticket: {
        introTitle: "Request an event",
        introCopy:
          "Open a ticket here to request a community event. If you also need direct admin or organiser help, mark that in the form below.",
        introCopySignedOut:
          "Sign in to open a direct ticket for admins and event organisers from this calendar window.",
        formTitle: "Open event request",
        formNote: "This opens a real ticket in the UCP so admins and event organisers can review your request directly.",
        placeholder:
          "Tell staff what kind of event you want, which date you are aiming for, and any faction or character context that matters.",
        signInMessage: "Sign in to open an event request from the calendar.",
        defaultSubject: "Event request for {date}",
        directSupport: "Direct admin / organiser support requested: {value}\n\n{message}",
      },
      messages: {
        loadError: "Could not load events right now.",
        interestAdded: "You marked yourself interested.",
        interestRemoved: "Interest removed.",
        interestError: "Could not update event interest.",
        signInCarry: "Sign in here first and the event interest mark will carry through to your account.",
        sessionExpiredInterest: "Your web session expired. Sign in again and the event interest mark will resume.",
        pickDate: "Pick a date first, then open a request from that day.",
        addDetails: "Add a few details so staff know what help you need.",
        ticketOpened: "Your ticket is open. Admins and event organisers can now follow up in the UCP.",
        ticketOpenedWithId: "Ticket #{id} is open. Admins and event organisers can now reply in your UCP tickets.",
        sessionExpiredTicket: "Your web session expired. Sign in again and the ticket request form will reopen.",
        ticketError: "Could not open a ticket right now.",
      },
    },
    contactModal: {
      closeLabel: "Close contact form",
      title: "Contact Us",
      intro: "Send us a message and we'll get back to you as soon as possible.",
      name: "Name",
      email: "Email",
      subject: "Subject",
      message: "Message",
      yourName: "Your name",
      yourEmail: "your.email@example.com",
      about: "What is this about?",
      messagePlaceholder: "Your message...",
      loadingVerification: "Loading verification...",
      sendMessage: "Send Message",
      verificationUnavailable:
        "Verification is unavailable right now. Add Turnstile keys in server settings to protect this contact flow.",
      verificationTest:
        "Local preview is using Cloudflare Turnstile test keys. Replace them with real keys before public launch.",
      verificationPrompt: "Complete the verification challenge before sending.",
      verificationLoadFailed: "Verification could not be loaded right now. Refresh the page and try again.",
      verificationScriptFailed: "Verification script could not be loaded. Check your connection and try again.",
      verificationComplete: "Verification complete. You can send your message now.",
      verificationCompleteTest: "Verification complete with Cloudflare's Turnstile test keys.",
      verificationExpired: "Verification expired. Complete the captcha again.",
      verificationChallengeFailed: "Verification failed to load. Try refreshing the challenge.",
      verificationPassed: "Verification passed. Review your email draft in your mail app before sending.",
      verificationFailed: "Verification failed. Complete the captcha and try again.",
      mailto: {
        subjectPrefix: "[Creator Program]",
        greeting: "Hello Skyrim Unbound team,",
        interest: "I would like to apply for the official content creator program.",
        labelName: "Name",
        labelEmail: "Email",
        labelSubject: "Subject",
        labelMessage: "Message",
      },
    },
    auth: {
      closeLabel: "Close sign in",
      eyebrow: "Account Access",
      title: "Sign in without leaving the page",
      intro: "Use your UCP account here so event interest and account access stay connected to the same profile.",
      login: "Username or email",
      password: "Password",
      signIn: "Sign In",
      createAccount: "Create Account",
      challengeDefault: "Finish the remaining verification steps for this login.",
      challengeEmail: "Enter the 6-digit code sent to {email}.",
      challengeTotp: "Enter the current 6-digit code from your authenticator app.",
      emailOtp: "Email OTP",
      emailOtpPlaceholder: "6-digit email code",
      totpCode: "Authenticator Code",
      totpPlaceholder: "6-digit authenticator code",
      verifyContinue: "Verify And Continue",
      cancel: "Cancel",
      footerHtml:
        "Need password recovery or full account setup? Continue in the <a data-ucp-link=\"login\" href=\"/ucp/?auth=login\">UCP account center</a>.",
      sessionExpired: "Session expired. Sign in again to continue.",
      welcomeBack: "Welcome back, {username}.",
      primaryAccepted: "Primary password accepted. Finish the remaining verification steps.",
      signInError: "Could not sign in right now.",
      verificationFailed: "Verification failed.",
    },
  };

  const OVERRIDES = {
    fr: {
      meta: {
        description:
          "Skyrim Unbound est un serveur de jeu de role Skyrim à shard unique, centré sur des personnages persistants, un accès examiné par le staff et une narration textuelle longue.",
      },
      language: { select: "Choisir la langue", selector: "Sélecteur de langue" },
      nav: { primary: "Navigation principale", home: "Accueil", join: "Comment rejoindre", world: "Pourquoi nous", community: "Communauté", media: "Médias", events: "Événements", contact: "Contact" },
      account: { defaultName: "Compte", logOut: "Déconnexion", openUcp: "Ouvrir l'UCP", signIn: "Connexion", install: "Télécharger et installer" },
      hero: {
        createAccount: "Créer un compte",
        joinDiscord: "Rejoindre Discord",
        calendarEyebrow: "Événements communautaires",
        calendarIntro: "Un registre plus discret pour les réunions de faction, les nuits de conflit, les audiences et les événements du serveur.",
        openCalendar: "Ouvrir le calendrier",
        trailerSubtitle: "Aperçu actuellement sélectionné",
        worldTitle: "Découvrez une expérience roleplay stricte",
        features: [
          { title: "Développement du lore ciblé", body: "Les intrigues, événements et tensions régionales restent ancrés dans l'univers pour faire grandir le monde avec intention." },
          { title: "Monde dirigé par les joueurs", body: "L'économie, les logements et les commerces doivent être possédés, défendus et façonnés par les habitants du shard." },
          { title: "Factions officielles et non officielles", body: "Les puissances reconnues et les groupes émergents peuvent bâtir leur identité, leurs avantages et leur influence." },
          { title: "Territoires et politique", body: "Les territoires de faction et les conflits politiques comptent à petite et grande échelle." },
          { title: "De vraies conséquences", body: "Les actions de votre personnage façonnent réputation, accès, confiance et réponses futures." },
          { title: "De la place pour chaque style de jeu", body: "Même dans un monde plus rude, les personnages calmes, légaux, sociaux et progressifs ont leur place." },
          { title: "Mises à jour régulières", body: "Des améliorations constantes et de nouvelles fonctionnalités pour enrichir votre expérience." },
          { title: "Roleplay strict", body: "Un accent fort sur l'évolution réaliste des personnages et l'immersion narrative." },
          { title: "Staff professionnel", body: "Une équipe expérimentée dédiée au maintien d'un roleplay de qualité." },
        ],
      },
      join: {
        title: "Comment rejoindre",
        intro: "Tout se fait en une seule suite propre : créez votre compte, passez la whitelist, installez et entrez en jeu.",
        steps: [
          { title: "Créez votre UCP", body: "Créez votre compte, sécurisez-le et préparez l'identité utilisée pour vos personnages et votre support.", cta: "Créer un compte" },
          { title: "Soumettre la whitelist", body: "Répondez à la candidature roleplay, complétez votre background et faites-vous examiner par le staff.", cta: "Commencer la candidature" },
          { title: "Installer le client", body: "Récupérez le lanceur local et connectez-vous via la configuration client prise en charge.", cta: "Ouvrir le lanceur" },
          { title: "Entrer dans le monde", body: "Choisissez votre emplacement de personnage et construisez une histoire persistante.", cta: "Gérer les personnages" },
        ],
      },
      community: {
        titleHtml: "Rejoignez notre <span>communauté</span>",
        intro: "Échangez avec des rôlistes du monde entier, partagez des histoires et restez informé.",
        cards: [
          {
            titleHtml: "Communauté Discord <span aria-hidden=\"true\">&#8599;</span>",
            bodyHtml: "<strong data-discord-member-copy>Live</strong> membres sur notre serveur Discord. Support en temps réel, événements, annonces et bien plus.",
            cta: "Rejoindre le serveur Discord",
            stats: [{ value: "Live", label: "Membres" }, { value: "Checking", label: "En ligne" }],
          },
          {
            titleHtml: "Forum officiel <span aria-hidden=\"true\">&#10022;</span>",
            bodyHtml: "Le forum officiel est en préparation. Discord reste le hub communautaire en direct pour le moment.",
            cta: "Bientôt",
            stats: [{ value: "Soon", label: "Forum" }, { value: "Discord", label: "Live Now" }],
          },
        ],
      },
      media: { title: "Vitrine communautaire", intro: "Des moments capturés dans le shard, affichés au fil de la vie du monde.", labels: ["Afficher la première image", "Afficher la deuxième image", "Afficher la troisième image"] },
      contact: {
        eyebrow: "Programme créateur",
        title: "Devenez créateur de contenu officiel du serveur",
        body: "Nous recherchons des créateurs prêts à mettre en valeur les événements, personnages et histoires de faction qui rendent Skyrim Unbound vivant.",
        cta: "Nous contacter",
      },
      youtube: { text: "Abonnez-vous à notre chaîne YouTube pour du contenu hebdomadaire, des séquences serveur et des nouvelles de la communauté.", cta: "S'abonner sur YouTube" },
      footer: {
        legalTitle: "Droits et avertissement",
        legalBody:
          "Skyrim Unbound est un projet roleplay indépendant pour The Elder Scrolls V: Skyrim et n'est ni affilié, ni approuvé par Bethesda Softworks, Bethesda Game Studios, ZeniMax Media, Microsoft ou d'autres ayants droit.",
        quickLinksTitle: "Liens rapides",
        quickLinks: ["Accueil", "Comment rejoindre", "Pourquoi nous", "Communauté", "Événements", "UCP", "Lanceur"],
        poweredTitle: "Propulsé par SkyMP",
        poweredHtml:
          "Construit sur <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> pour soutenir un roleplay Skyrim multijoueur persistant.",
        meta: "Skyrim Unbound. Tous droits réservés à leurs propriétaires respectifs.",
        legalLinks: ["Conditions d'utilisation", "Confidentialité", "Paiements"],
      },
      cookie: { notice: "Ce site peut mémoriser votre consentement et vos préférences visuelles entre les visites.", close: "Fermer", allow: "Autoriser" },
      calendar: {
        closeLabel: "Fermer les détails de l'événement",
        timeDisplayLabel: "Affichage horaire du calendrier",
        gridLabel: "Calendrier des événements communautaires",
        openLedger: "Ouvrir le registre",
        previous: "Précédent",
        next: "Suivant",
        loading: "Chargement des événements...",
        serverTime: "Heure serveur",
        localTime: "Heure locale",
        playerRequests: "Demandes des joueurs",
        requestEvent: "Demander un événement",
        signInRequestEvent: "Connectez-vous pour demander",
        openEventRequest: "Ouvrir la demande d'événement",
        ticketType: "Type de ticket",
        eventRequest: "Demande d'événement",
        supportQuestion: "Avez-vous besoin d'une aide directe d'un admin / organisateur pour cette demande ?",
        supportQuestionAria: "Avez-vous besoin d'une aide directe d'un admin ou organisateur ?",
        subject: "Sujet",
        details: "Détails",
        openTicket: "Ouvrir le ticket",
        cancel: "Annuler",
        markInterested: "Je suis intéressé",
        removeInterest: "Retirer l'intérêt",
        signInInterest: "Connectez-vous pour marquer votre intérêt",
        eventStarted: "Événement commencé",
        cancelled: "Annulé",
        noDescription: "Aucune description pour l'instant.",
        interestCount: "Intéressés : {count}",
        listedCount: "{count} listés",
        noEvents: "Aucun événement",
        noEventsForMonth: "Aucun événement communautaire prévu pour {month} pour l'instant.",
        noEventsForDate: "Aucun événement communautaire n'est listé pour cette date.",
        quietMonth: "Le calendrier reste prêt ici jusqu'au prochain marché, conseil de guerre, raid, audience ou nuit communautaire.",
        quietDate: "Si vous voulez quelque chose ici ou si vous avez besoin d'aide directe, ouvrez un ticket ci-dessous.",
        ledgerIntro: "Le calendrier reste sur le côté jusqu'à ce que vous décidiez d'y entrer. Ouvrez l'entrée qui vous intéresse et suivez les détails.",
        monthMetaLede: "{count} listés",
        dateSelectUpcoming: "À venir le {date} : {count}. Sélectionnez-en un ci-dessous pour lire la description complète.",
        dateSelectListed: "Listés le {date} : {count}. Sélectionnez-en un ci-dessous pour lire la description complète.",
        createdBy: "Créé par {name}",
        dateSelected: "Date sélectionnée",
        weekdayLabels: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
        timeMeta: {
          showingHost: "Affichage de l'heure de l'hôte.",
          showingLocal: "Affichage de votre heure locale.",
          hostMatches: "Hôte {offset}. Votre navigateur correspond à l'hôte ce mois-ci.",
          hostBehind: "Hôte {offset}. Vous avez {difference} de retard sur l'hôte ce mois-ci.",
          hostAhead: "Hôte {offset}. Vous avez {difference} d'avance sur l'hôte ce mois-ci.",
        },
        heroAlert: {
          openNow: "Ouvrir",
          liveAria: "En direct : {title}",
          upcomingAria: "À venir dans les vingt-quatre prochaines heures : {title}",
          liveKicker: "En direct maintenant",
          upcomingKicker: "Dans les prochaines 24 heures",
          startedAt: "Commencé {time}",
          plusMore: "+{count} de plus",
          liveCopy: "Cet événement a commencé il y a moins d'une heure. Ouvrez le calendrier pour voir les détails.",
          liveCopyMore: "Cet événement a commencé il y a moins d'une heure. D'autres événements suivent bientôt dans la même fenêtre.",
          upcomingCopy: "Cet événement arrive bientôt. Ouvrez le calendrier pour lire les détails complets.",
          upcomingCopyMore: "Cet événement arrive bientôt. D'autres événements tombent aussi dans la même fenêtre de vingt-quatre heures.",
        },
      },
      contactModal: {
        closeLabel: "Fermer le formulaire de contact",
        title: "Nous contacter",
        intro: "Envoyez-nous un message et nous reviendrons vers vous dès que possible.",
        name: "Nom",
        email: "E-mail",
        subject: "Sujet",
        message: "Message",
        yourName: "Votre nom",
        yourEmail: "votre.email@exemple.com",
        about: "De quoi s'agit-il ?",
        messagePlaceholder: "Votre message...",
        loadingVerification: "Chargement de la vérification...",
        sendMessage: "Envoyer le message",
      },
      auth: {
        closeLabel: "Fermer la connexion",
        eyebrow: "Accès au compte",
        title: "Connectez-vous sans quitter la page",
        intro: "Utilisez votre compte UCP ici pour garder l'accès et l'intérêt pour les événements liés au même profil.",
        login: "Nom d'utilisateur ou e-mail",
        password: "Mot de passe",
        signIn: "Connexion",
        createAccount: "Créer un compte",
        challengeDefault: "Terminez les étapes de vérification restantes pour cette connexion.",
        challengeEmail: "Entrez le code à 6 chiffres envoyé à {email}.",
        challengeTotp: "Entrez le code actuel à 6 chiffres de votre application d'authentification.",
        emailOtp: "OTP e-mail",
        emailOtpPlaceholder: "Code e-mail à 6 chiffres",
        totpCode: "Code d'authentification",
        totpPlaceholder: "Code d'authentification à 6 chiffres",
        verifyContinue: "Vérifier et continuer",
        cancel: "Annuler",
        footerHtml:
          "Besoin de récupération de mot de passe ou d'une configuration complète ? Continuez dans le <a data-ucp-link=\"login\" href=\"/ucp/?auth=login\">centre de compte UCP</a>.",
        sessionExpired: "Session expirée. Reconnectez-vous pour continuer.",
        primaryAccepted: "Mot de passe principal accepté. Terminez maintenant les étapes de vérification restantes.",
        signInError: "Impossible de vous connecter pour le moment.",
        verificationFailed: "La vérification a échoué.",
      },
    },
    ge: {
      language: { select: "ენის არჩევა", selector: "ენის ამომრჩევი" },
      nav: { primary: "მთავარი ნავიგაცია", home: "მთავარი", join: "როგორ შევუერთდე", world: "რატომ ჩვენ", community: "კომუნითი", media: "მედია", events: "ივენთები", contact: "კონტაქტი" },
      account: { defaultName: "ანგარიში", logOut: "გასვლა", openUcp: "UCP-ის გახსნა", signIn: "შესვლა", install: "ჩამოტვირთვა და დაყენება" },
      hero: {
        createAccount: "ანგარიშის შექმნა",
        joinDiscord: "Discord-ში გაწევრიანება",
        calendarEyebrow: "საზოგადოებრივი ივენთები",
        calendarIntro: "უფრო მშვიდი ჩანაწერი ფრაქციის შეხვედრებისთვის, კონფლიქტის ღამეებისთვის, სხდომებისთვის და სერვერის ივენთებისთვის.",
        openCalendar: "ივენთების კალენდრის გახსნა",
        trailerSubtitle: "ამჟამინდელი პრევიუ",
        worldTitle: "განიცადე მკაცრი roleplay-ის უმაღლესი ფორმა",
      },
      join: { title: "როგორ შევუერთდე", intro: "ყველაფერი ერთ სუფთა ნაკადში ხდება: შექმენი ანგარიში, გაიარე whitelist, დააყენე კლიენტი და შედი სამყაროში." },
      community: {
        titleHtml: "შემოუერთდი ჩვენს <span>კომუნითის</span>",
        intro: "დაუკავშირდი roleplayer-ებს მთელი მსოფლიოდან, გააზიარე ისტორიები და დარჩი კავშირზე.",
        cards: [
          { titleHtml: "Discord კომუნითი <span aria-hidden=\"true\">&#8599;</span>", bodyHtml: "<strong data-discord-member-copy>Live</strong> წევრი ჩვენს Discord სერვერზე. რეალურ დროში მხარდაჭერა, ივენთები და განცხადებები.", cta: "Discord სერვერში შესვლა", stats: [{ value: "Live", label: "წევრი" }, { value: "Checking", label: "ონლაინ" }] },
          { titleHtml: "ოფიციალური ფორუმი <span aria-hidden=\"true\">&#10022;</span>", bodyHtml: "ოფიციალური ფორუმი მზადდება. ამჟამად Discord არის ცოცხალი კომუნითი ჰაბი.", cta: "მალე", stats: [{ value: "Soon", label: "Forum" }, { value: "Discord", label: "Live Now" }] },
        ],
      },
      media: { title: "კომუნითის ვიტრინა", intro: "შარდის შიგნიდან გადაღებული მომენტები, რომლებიც სამყაროს მოძრაობასთან ერთად იცვლება." },
      contact: { eyebrow: "შემოქმედთა პროგრამა", title: "გახდი სერვერის ოფიციალური კონტენტის შემქმნელი", body: "ვეძებთ შემქმნელებს, რომლებიც გააშუქებენ ივენთებს, პერსონაჟებს და ფრაქციების ისტორიებს, რაც Skyrim Unbound-ს აცოცხლებს.", cta: "დაგვიკავშირდი" },
      youtube: { text: "გამოიწერე ჩვენი YouTube არხი ყოველკვირეული კონტენტისთვის, სერვერის კადრებისთვის და კომუნითის განახლებებისთვის.", cta: "YouTube-ზე გამოწერა" },
      footer: {
        legalTitle: "უფლებები და გაფრთხილება",
        legalBody:
          "Skyrim Unbound არის დამოუკიდებელი roleplay პროექტი The Elder Scrolls V: Skyrim-ისთვის და არ არის დაკავშირებული ან მოწონებული Bethesda-ს, ZeniMax-ის, Microsoft-ის ან სხვა უფლებათამფლობელების მიერ.",
        quickLinksTitle: "სწრაფი ბმულები",
        quickLinks: ["მთავარი", "როგორ შევუერთდე", "რატომ ჩვენ", "კომუნითი", "ივენთები", "UCP", "ლანჩერი"],
        poweredTitle: "მუშაობს SkyMP-ზე",
        meta: "Skyrim Unbound. ყველა უფლება ეკუთვნის მათ შესაბამის მფლობელებს.",
        legalLinks: ["გამოყენების წესები", "კონფიდენციალურობა", "გადახდები"],
      },
      cookie: { notice: "საიტს შეუძლია დაიმახსოვროს შენი თანხმობა და ვიზუალური პარამეტრები შემდეგი ვიზიტებისთვის.", close: "დახურვა", allow: "დაშვება" },
      calendar: {
        closeLabel: "ივენთის დეტალების დახურვა",
        previous: "წინა",
        next: "შემდეგი",
        loading: "ივენთები იტვირთება...",
        serverTime: "სერვერის დრო",
        localTime: "ლოკალური დრო",
        requestEvent: "ივენთის მოთხოვნა",
        signInRequestEvent: "შედით მოთხოვნის გასახსნელად",
        openTicket: "ტიკეტის გახსნა",
        cancel: "გაუქმება",
        markInterested: "ინტერესის მონიშვნა",
        removeInterest: "ინტერესის მოხსნა",
        signInInterest: "შედით ინტერესის მოსანიშნად",
        eventStarted: "ივენთი დაწყებულია",
        cancelled: "გაუქმებულია",
        noEventsForMonth: "{month}-ისთვის ჯერ არცერთი ივენთი არ არის დაგეგმილი.",
        noEventsForDate: "ამ თარიღისთვის არცერთი ივენთი არ არის მითითებული.",
        weekdayLabels: ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
      },
      contactModal: { closeLabel: "კონტაქტის ფორმის დახურვა", title: "დაგვიკავშირდი", intro: "გამოგვიგზავნე შეტყობინება და მალე დაგიბრუნდებით.", name: "სახელი", email: "ელფოსტა", subject: "თემა", message: "შეტყობინება", yourName: "შენი სახელი", yourEmail: "your.email@example.com", about: "რას ეხება?", messagePlaceholder: "შენი შეტყობინება...", loadingVerification: "ვერიფიკაცია იტვირთება...", sendMessage: "შეტყობინების გაგზავნა" },
      auth: {
        closeLabel: "შესვლის დახურვა",
        eyebrow: "ანგარიშის წვდომა",
        title: "შედი გვერდიდან გაუსვლელად",
        intro: "გამოიყენე შენი UCP ანგარიში აქ, რომ ივენთებზე ინტერესი და ანგარიშის წვდომა ერთ პროფილზე დარჩეს მიბმული.",
        login: "მომხმარებლის სახელი ან ელფოსტა",
        password: "პაროლი",
        signIn: "შესვლა",
        createAccount: "ანგარიშის შექმნა",
        challengeDefault: "დაასრულე ამ შესვლისთვის დარჩენილი ვერიფიკაციის ნაბიჯები.",
        emailOtp: "ელფოსტის OTP",
        totpCode: "ავტორიზატორის კოდი",
        verifyContinue: "ვერიფიკაცია და გაგრძელება",
        cancel: "გაუქმება",
      },
    },
    tr: {
      language: { select: "Dil seç", selector: "Dil seçici" },
      nav: { primary: "Birincil gezinme", home: "Ana Sayfa", join: "Nasıl Katılınır", world: "Neden Biz", community: "Topluluk", media: "Medya", events: "Etkinlikler", contact: "İletişim" },
      account: { defaultName: "Hesap", logOut: "Çıkış Yap", openUcp: "UCP'yi Aç", signIn: "Giriş Yap", install: "İndir ve kur" },
      hero: { createAccount: "Hesap Oluştur", joinDiscord: "Discord'a Katıl", calendarEyebrow: "Topluluk Etkinlikleri", calendarIntro: "Fraksiyon toplantıları, çatışma geceleri, mahkeme oturumları ve sunucu etkinlikleri için daha sakin bir kayıt.", openCalendar: "Etkinlik Takvimini Aç", trailerSubtitle: "Mevcut önizleme seçimi", worldTitle: "En üst düzey katı roleplay deneyimi" },
      join: { title: "Nasıl Katılınır", intro: "Her şey tek bir temiz akışta olur: hesabını oluştur, whitelist'i geç, istemciyi kur ve dünyaya gir." },
      community: {
        titleHtml: "<span>Topluluğumuza</span> Katıl",
        intro: "Dünyanın dört yanındaki roleplayer'larla bağlantı kur, hikâyeler paylaş ve haberdar kal.",
        cards: [
          { titleHtml: "Discord Topluluğu <span aria-hidden=\"true\">&#8599;</span>", bodyHtml: "Discord sunucumuzda <strong data-discord-member-copy>Live</strong> üye. Gerçek zamanlı destek, etkinlikler ve duyurular.", cta: "Discord Sunucusuna Katıl", stats: [{ value: "Live", label: "Üye" }, { value: "Checking", label: "Çevrimiçi" }] },
          { titleHtml: "Resmî Forum <span aria-hidden=\"true\">&#10022;</span>", bodyHtml: "Resmî forum hazırlanıyor. Şimdilik canlı topluluk merkezi Discord.", cta: "Yakında", stats: [{ value: "Soon", label: "Forum" }, { value: "Discord", label: "Live Now" }] },
        ],
      },
      media: { title: "Topluluk Vitrini", intro: "Shard içinden yakalanan anlar, dünya akmaya devam ederken döndürülerek gösterilir." },
      contact: { eyebrow: "İçerik Üretici Programı", title: "Sunucun resmi içerik üreticisi ol", body: "Etkinlikleri, karakterleri ve Skyrim Unbound'u canlı tutan hikâyeleri öne çıkaracak üreticiler arıyoruz.", cta: "Bize Ulaşın" },
      youtube: { text: "Haftalık içerik, sunucu görüntüleri ve topluluk güncellemeleri için YouTube kanalımıza abone olun.", cta: "YouTube'da Abone Ol" },
      footer: { legalTitle: "Haklar ve Feragat", legalBody: "Skyrim Unbound, The Elder Scrolls V: Skyrim için bağımsız bir roleplay projesidir ve Bethesda, ZeniMax, Microsoft veya diğer hak sahipleriyle bağlantılı değildir.", quickLinksTitle: "Hızlı Bağlantılar", quickLinks: ["Ana Sayfa", "Nasıl Katılınır", "Neden Biz", "Topluluk", "Etkinlikler", "UCP", "Launcher"], poweredTitle: "SkyMP ile çalışır", meta: "Skyrim Unbound. Tüm haklar ilgili sahiplerine aittir.", legalLinks: ["Kullanım Şartları", "Gizlilik", "Ödemeler"] },
      cookie: { notice: "Bu site ziyaretler arasında onayınızı ve görsel tercihlerinizi hatırlayabilir.", close: "Kapat", allow: "İzin Ver" },
      calendar: { closeLabel: "Etkinlik ayrıntılarını kapat", previous: "Önceki", next: "Sonraki", loading: "Etkinlikler yükleniyor...", serverTime: "Sunucu Saati", localTime: "Yerel Saat", requestEvent: "Etkinlik Talep Et", signInRequestEvent: "Talep için giriş yap", openTicket: "Bilet Aç", cancel: "İptal", markInterested: "İlgileniyorum", removeInterest: "İlgiyi Kaldır", signInInterest: "İlgi işaretlemek için giriş yap", eventStarted: "Etkinlik Başladı", cancelled: "İptal Edildi", noEventsForMonth: "{month} için henüz topluluk etkinliği planlanmadı.", noEventsForDate: "Bu tarih için listelenmiş etkinlik yok.", weekdayLabels: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"] },
      contactModal: { closeLabel: "İletişim formunu kapat", title: "Bize Ulaşın", intro: "Bize mesaj gönderin, size en kısa sürede geri dönelim.", name: "Ad", email: "E-posta", subject: "Konu", message: "Mesaj", yourName: "Adınız", yourEmail: "ornek@eposta.com", about: "Konu nedir?", messagePlaceholder: "Mesajınız...", loadingVerification: "Doğrulama yükleniyor...", sendMessage: "Mesaj Gönder" },
      auth: { closeLabel: "Girişi kapat", eyebrow: "Hesap Erişimi", title: "Sayfadan ayrılmadan giriş yap", intro: "Etkinlik ilgisi ve hesap erişimi aynı profile bağlı kalsın diye UCP hesabını burada kullan.", login: "Kullanıcı adı veya e-posta", password: "Şifre", signIn: "Giriş Yap", createAccount: "Hesap Oluştur", challengeDefault: "Bu giriş için kalan doğrulama adımlarını tamamla.", emailOtp: "E-posta OTP", totpCode: "Doğrulayıcı Kodu", verifyContinue: "Doğrula ve Devam Et", cancel: "İptal" },
    },
    es: {
      language: { select: "Seleccionar idioma", selector: "Selector de idioma" },
      nav: { primary: "Navegación principal", home: "Inicio", join: "Cómo unirse", world: "Por qué nosotros", community: "Comunidad", media: "Medios", events: "Eventos", contact: "Contacto" },
      account: { defaultName: "Cuenta", logOut: "Cerrar sesión", openUcp: "Abrir UCP", signIn: "Iniciar sesión", install: "Descargar e instalar" },
      hero: { createAccount: "Crear cuenta", joinDiscord: "Unirse a Discord", calendarEyebrow: "Eventos de la comunidad", calendarIntro: "Un registro más tranquilo para reuniones de facción, noches de conflicto, audiencias y eventos del servidor.", openCalendar: "Abrir calendario de eventos", trailerSubtitle: "Vista previa actual", worldTitle: "Vive la experiencia de roleplay estricto definitiva" },
      join: { title: "Cómo unirse", intro: "Todo sucede en un solo flujo limpio: crea tu cuenta, pasa la whitelist, instala y entra al mundo." },
      community: {
        titleHtml: "Únete a nuestra <span>comunidad</span>",
        intro: "Conecta con roleplayers de todo el mundo, comparte historias y mantente al día.",
        cards: [
          { titleHtml: "Comunidad de Discord <span aria-hidden=\"true\">&#8599;</span>", bodyHtml: "<strong data-discord-member-copy>Live</strong> miembros en nuestro servidor de Discord. Soporte en tiempo real, eventos y anuncios.", cta: "Unirse al servidor de Discord", stats: [{ value: "Live", label: "Miembros" }, { value: "Checking", label: "En línea" }] },
          { titleHtml: "Foro oficial <span aria-hidden=\"true\">&#10022;</span>", bodyHtml: "El foro oficial está en preparación. Discord es el centro comunitario activo por ahora.", cta: "Próximamente", stats: [{ value: "Soon", label: "Forum" }, { value: "Discord", label: "Live Now" }] },
        ],
      },
      media: { title: "Vitrina de la comunidad", intro: "Momentos capturados dentro del shard, girando mientras el mundo sigue avanzando." },
      contact: { eyebrow: "Programa de creadores", title: "Conviértete en creador de contenido oficial del servidor", body: "Buscamos creadores que quieran mostrar eventos, personajes e historias de facción que hacen que Skyrim Unbound se sienta vivo.", cta: "Contáctanos" },
      youtube: { text: "Suscríbete a nuestro canal de YouTube para contenido semanal, metraje del servidor y actualizaciones de la comunidad.", cta: "Suscribirse en YouTube" },
      footer: { legalTitle: "Derechos y aviso", legalBody: "Skyrim Unbound es un proyecto de roleplay independiente para The Elder Scrolls V: Skyrim y no está afiliado ni respaldado por Bethesda, ZeniMax, Microsoft u otros titulares de derechos.", quickLinksTitle: "Enlaces rápidos", quickLinks: ["Inicio", "Cómo unirse", "Por qué nosotros", "Comunidad", "Eventos", "UCP", "Launcher"], poweredTitle: "Impulsado por SkyMP", meta: "Skyrim Unbound. Todos los derechos reservados a sus respectivos propietarios.", legalLinks: ["Términos de uso", "Privacidad", "Pagos"] },
      cookie: { notice: "Este sitio puede recordar tu consentimiento y tus preferencias visuales entre visitas.", close: "Cerrar", allow: "Permitir" },
      calendar: { closeLabel: "Cerrar detalles del evento", previous: "Anterior", next: "Siguiente", loading: "Cargando eventos...", serverTime: "Hora del servidor", localTime: "Hora local", requestEvent: "Solicitar evento", signInRequestEvent: "Inicia sesión para solicitar", openTicket: "Abrir ticket", cancel: "Cancelar", markInterested: "Marcar interés", removeInterest: "Quitar interés", signInInterest: "Inicia sesión para marcar interés", eventStarted: "Evento iniciado", cancelled: "Cancelado", noEventsForMonth: "Aún no hay eventos comunitarios programados para {month}.", noEventsForDate: "No hay eventos listados para esta fecha.", weekdayLabels: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] },
      contactModal: { closeLabel: "Cerrar formulario de contacto", title: "Contáctanos", intro: "Envíanos un mensaje y te responderemos lo antes posible.", name: "Nombre", email: "Correo", subject: "Asunto", message: "Mensaje", yourName: "Tu nombre", yourEmail: "tu.correo@ejemplo.com", about: "¿De qué se trata?", messagePlaceholder: "Tu mensaje...", loadingVerification: "Cargando verificación...", sendMessage: "Enviar mensaje" },
      auth: { closeLabel: "Cerrar inicio de sesión", eyebrow: "Acceso a la cuenta", title: "Inicia sesión sin salir de la página", intro: "Usa tu cuenta de UCP aquí para que el acceso y el interés por eventos sigan ligados al mismo perfil.", login: "Usuario o correo", password: "Contraseña", signIn: "Iniciar sesión", createAccount: "Crear cuenta", challengeDefault: "Completa los pasos de verificación restantes para este inicio de sesión.", emailOtp: "OTP por correo", totpCode: "Código del autenticador", verifyContinue: "Verificar y continuar", cancel: "Cancelar" },
    },
    ru: {
      language: { select: "Выбрать язык", selector: "Выбор языка" },
      nav: { primary: "Основная навигация", home: "Главная", join: "Как вступить", world: "Почему мы", community: "Сообщество", media: "Медиа", events: "События", contact: "Контакты" },
      account: { defaultName: "Аккаунт", logOut: "Выйти", openUcp: "Открыть UCP", signIn: "Войти", install: "Скачать и установить" },
      hero: { createAccount: "Создать аккаунт", joinDiscord: "Вступить в Discord", calendarEyebrow: "События сообщества", calendarIntro: "Более тихий реестр для собраний фракций, ночей конфликта, судебных сессий и серверных событий.", openCalendar: "Открыть календарь событий", trailerSubtitle: "Текущий превью-выбор", worldTitle: "Почувствуйте по-настоящему строгий roleplay" },
      join: { title: "Как вступить", intro: "Всё происходит в одном понятном потоке: создайте аккаунт, пройдите whitelist, установите клиент и войдите в мир." },
      community: {
        titleHtml: "Присоединяйтесь к нашему <span>сообществу</span>",
        intro: "Общайтесь с roleplay-игроками со всего мира, делитесь историями и оставайтесь в курсе.",
        cards: [
          { titleHtml: "Сообщество Discord <span aria-hidden=\"true\">&#8599;</span>", bodyHtml: "<strong data-discord-member-copy>Live</strong> участников на нашем Discord-сервере. Поддержка в реальном времени, события и объявления.", cta: "Вступить в Discord", stats: [{ value: "Live", label: "Участники" }, { value: "Checking", label: "Онлайн" }] },
          { titleHtml: "Официальный форум <span aria-hidden=\"true\">&#10022;</span>", bodyHtml: "Официальный форум готовится. Пока Discord — живой центр сообщества.", cta: "Скоро", stats: [{ value: "Soon", label: "Forum" }, { value: "Discord", label: "Live Now" }] },
        ],
      },
      media: { title: "Витрина сообщества", intro: "Моменты, снятые внутри шарда, вращаются в показе, пока мир продолжает жить." },
      contact: { eyebrow: "Программа создателей", title: "Станьте официальным контент-мейкером сервера", body: "Мы ищем авторов, которые хотят показывать события, персонажей и истории фракций, делающие Skyrim Unbound живым.", cta: "Связаться с нами" },
      youtube: { text: "Подпишитесь на наш YouTube-канал, чтобы получать еженедельный контент, записи с сервера и новости сообщества.", cta: "Подписаться на YouTube" },
      footer: { legalTitle: "Права и отказ от ответственности", legalBody: "Skyrim Unbound — независимый roleplay-проект для The Elder Scrolls V: Skyrim и не связан с Bethesda, ZeniMax, Microsoft или другими правообладателями.", quickLinksTitle: "Быстрые ссылки", quickLinks: ["Главная", "Как вступить", "Почему мы", "Сообщество", "События", "UCP", "Лаунчер"], poweredTitle: "Работает на SkyMP", meta: "Skyrim Unbound. Все права принадлежат их соответствующим владельцам.", legalLinks: ["Условия использования", "Конфиденциальность", "Платежи"] },
      cookie: { notice: "Сайт может запоминать ваше согласие и визуальные настройки между посещениями.", close: "Закрыть", allow: "Разрешить" },
      calendar: { closeLabel: "Закрыть детали события", previous: "Назад", next: "Далее", loading: "Загрузка событий...", serverTime: "Время сервера", localTime: "Местное время", requestEvent: "Запросить событие", signInRequestEvent: "Войдите, чтобы запросить", openTicket: "Открыть тикет", cancel: "Отмена", markInterested: "Отметить интерес", removeInterest: "Убрать интерес", signInInterest: "Войдите, чтобы отметить интерес", eventStarted: "Событие началось", cancelled: "Отменено", noEventsForMonth: "На {month} пока не запланировано событий сообщества.", noEventsForDate: "На эту дату событий не указано.", weekdayLabels: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] },
      contactModal: { closeLabel: "Закрыть форму связи", title: "Связаться с нами", intro: "Отправьте нам сообщение, и мы ответим как можно скорее.", name: "Имя", email: "Email", subject: "Тема", message: "Сообщение", yourName: "Ваше имя", yourEmail: "your.email@example.com", about: "О чём это?", messagePlaceholder: "Ваше сообщение...", loadingVerification: "Загрузка проверки...", sendMessage: "Отправить сообщение" },
      auth: { closeLabel: "Закрыть вход", eyebrow: "Доступ к аккаунту", title: "Войдите, не покидая страницу", intro: "Используйте здесь свой аккаунт UCP, чтобы интерес к событиям и доступ к аккаунту были привязаны к одному профилю.", login: "Имя пользователя или email", password: "Пароль", signIn: "Войти", createAccount: "Создать аккаунт", challengeDefault: "Завершите оставшиеся шаги проверки для этого входа.", emailOtp: "Код из email", totpCode: "Код приложения-аутентификатора", verifyContinue: "Подтвердить и продолжить", cancel: "Отмена" },
    },
  };

  const COMPLETION_OVERRIDES = {
    fr: {
      meta: { title: "Skyrim Unbound" },
      hero: {
        title: "Skyrim Unbound",
        trailerTitle: "Skyrim Unbound arrive bientôt",
      },
      calendar: {
        no: "Non",
        yes: "Oui",
        monthLabels: [
          "Étoile du matin",
          "Aube du soleil",
          "Premières semailles",
          "Main de pluie",
          "Secondes semailles",
          "Mi-année",
          "Hauteur du soleil",
          "Dernières semailles",
          "Âtrefeu",
          "Tombegivre",
          "Crépuscule du soleil",
          "Étoile du soir",
        ],
        eventStatus: {
          SCHEDULED: "PROGRAMMÉ",
          CANCELLED: "ANNULÉ",
          COMPLETED: "TERMINÉ",
        },
        ticket: {
          introTitle: "Demander un événement",
          introCopy:
            "Ouvrez un ticket ici pour demander un événement communautaire. Si vous avez aussi besoin d'une aide directe d'un admin ou d'un organisateur, indiquez-le dans le formulaire ci-dessous.",
          introCopySignedOut:
            "Connectez-vous pour ouvrir un ticket direct aux admins et organisateurs depuis cette fenêtre de calendrier.",
          formTitle: "Ouvrir une demande d'événement",
          formNote:
            "Cela ouvre un vrai ticket dans l'UCP afin que les admins et organisateurs puissent examiner directement votre demande.",
          placeholder:
            "Dites au staff quel type d'événement vous souhaitez, quelle date vous visez, et tout contexte de faction ou de personnage important.",
          signInMessage: "Connectez-vous pour ouvrir une demande d'événement depuis le calendrier.",
          defaultSubject: "Demande d'événement pour {date}",
          directSupport: "Aide directe admin / organisateur demandée : {value}\n\n{message}",
        },
        messages: {
          loadError: "Impossible de charger les événements pour le moment.",
          interestAdded: "Vous avez indiqué votre intérêt.",
          interestRemoved: "Intérêt retiré.",
          interestError: "Impossible de mettre à jour l'intérêt pour l'événement.",
          signInCarry:
            "Connectez-vous ici d'abord et votre marque d'intérêt sera transmise à votre compte.",
          sessionExpiredInterest:
            "Votre session web a expiré. Connectez-vous à nouveau et la marque d'intérêt reprendra.",
          pickDate: "Choisissez d'abord une date, puis ouvrez une demande depuis ce jour.",
          addDetails: "Ajoutez quelques détails pour que le staff sache de quelle aide vous avez besoin.",
          ticketOpened:
            "Votre ticket est ouvert. Les admins et organisateurs peuvent maintenant faire le suivi dans l'UCP.",
          ticketOpenedWithId:
            "Le ticket #{id} est ouvert. Les admins et organisateurs peuvent maintenant répondre dans vos tickets UCP.",
          sessionExpiredTicket:
            "Votre session web a expiré. Connectez-vous à nouveau et le formulaire de demande de ticket se rouvrira.",
          ticketError: "Impossible d'ouvrir un ticket pour le moment.",
        },
      },
      contactModal: {
        verificationUnavailable:
          "La vérification est indisponible pour le moment. Ajoutez les clés Turnstile dans les paramètres du serveur pour protéger ce flux de contact.",
        verificationTest:
          "L'aperçu local utilise les clés de test Cloudflare Turnstile. Remplacez-les par de vraies clés avant le lancement public.",
        verificationPrompt: "Terminez le défi de vérification avant l'envoi.",
        verificationLoadFailed:
          "La vérification n'a pas pu être chargée pour le moment. Actualisez la page et réessayez.",
        verificationScriptFailed:
          "Le script de vérification n'a pas pu être chargé. Vérifiez votre connexion et réessayez.",
        verificationComplete: "Vérification terminée. Vous pouvez maintenant envoyer votre message.",
        verificationCompleteTest: "Vérification terminée avec les clés de test Cloudflare Turnstile.",
        verificationExpired: "La vérification a expiré. Complétez à nouveau le captcha.",
        verificationChallengeFailed: "La vérification n'a pas pu se charger. Essayez d'actualiser le défi.",
        verificationPassed:
          "Vérification réussie. Relisez votre brouillon d'email dans votre application de messagerie avant l'envoi.",
        verificationFailed: "La vérification a échoué. Complétez le captcha et réessayez.",
        mailto: {
          subjectPrefix: "[Programme créateur]",
          greeting: "Bonjour l'équipe Skyrim Unbound,",
          interest: "Je souhaite postuler au programme officiel de créateurs de contenu.",
          labelName: "Nom",
          labelEmail: "Email",
          labelSubject: "Sujet",
          labelMessage: "Message",
        },
      },
      auth: {
        welcomeBack: "Bon retour, {username}.",
      },
    },
    ge: {
      meta: {
        title: "Skyrim Unbound",
        description:
          "Skyrim Unbound არის ერთ-შარდიანი Skyrim roleplay სერვერი, რომელიც ფოკუსირებულია მუდმივ პერსონაჟებზე, სტაფის მიერ განხილულ შესვლაზე და გრძელ ტექსტურ თხრობაზე.",
      },
      hero: {
        title: "Skyrim Unbound",
        trailerTitle: "Skyrim Unbound მალე გამოვა",
        features: [
          {
            title: "ლორის მიზანმიმართული განვითარება",
            body:
              "სიუჟეტები, ღონისძიებები და რეგიონული დაძაბულობა გარემოში რჩება დაფუძნებული, რათა სამყარო ხმაურის ნაცვლად განზრახვით გაიზარდოს.",
          },
          {
            title: "მოთამაშეების მიერ მართული სამყარო",
            body:
              "ეკონომიკა, მოთამაშეთა სახლები და ბიზნესები shard-ში მცხოვრები ხალხის მიერ უნდა იყოს ფლობილი, დაცული და ჩამოყალიბებული.",
          },
          {
            title: "ოფიციალური და არაოფიციალური ფრაქციები",
            body:
              "აღიარებულ ძალებსა და ახალ ჯგუფებს შეუძლიათ უპირატესობების, იდენტობისა და გავლენის შექმნა მათი ორგანიზებისა და მოქმედების გზით.",
          },
          {
            title: "ტერიტორიები და პოლიტიკა",
            body:
              "ფრაქციის ტერიტორია და პოლიტიკურად მართული კონფლიქტი მნიშვნელოვანია როგორც მცირე, ისე დიდ მასშტაბზე, ამიტომ ადგილობრივი არჩევანი შორსაც ისმის.",
          },
          {
            title: "ნამდვილი შედეგები",
            body:
              "შენი პერსონაჟის მოქმედებებმა შეიძლება შეცვალოს რეპუტაცია, წვდომა, ნდობა და ის, თუ როგორ უპასუხებენ მომავალ სცენებში წარსულ არჩევანს.",
          },
          {
            title: "ადგილი ყველა სათამაშო სტილისთვის",
            body:
              "მაშინაც კი, როცა სამყარო ცივი და მკაცრია, მშვიდ, კანონიერ, სოციალურ და ნელა განვითარებად პერსონაჟებსაც აქვთ მნიშვნელობა.",
          },
          {
            title: "რეგულარული განახლებები",
            body: "მუდმივი გაუმჯობესებები და ახალი ფუნქციები შენი გამოცდილების გასამდიდრებლად.",
          },
          {
            title: "მკაცრი roleplay",
            body: "დიდი აქცენტი რეალისტურ პერსონაჟთა განვითარებასა და ჩაძირულ თხრობაში.",
          },
          {
            title: "პროფესიონალი სტაფი",
            body: "გამოცდილი გუნდი, რომელიც roleplay-ის ხარისხის სტანდარტების შენარჩუნებას ემსახურება.",
          },
        ],
      },
      join: {
        steps: [
          {
            title: "შექმენი შენი UCP",
            body: "შექმენი ანგარიში, დაიცავი იგი და მოამზადე იდენტობა, რომელსაც პერსონაჟებსა და მხარდაჭერის ისტორიაში გამოიყენებ.",
            cta: "ანგარიშის შექმნა",
          },
          {
            title: "გააგზავნე whitelist",
            body: "უპასუხე roleplay განაცხადს, დაასრულე პერსონაჟის ისტორია და დაელოდე Supporter-ებისა და Admin-ების განხილვას.",
            cta: "განაცხადის დაწყება",
          },
          {
            title: "დააყენე კლიენტი",
            body: "მიიღე ადგილობრივი launcher პაკეტი და დაუკავშირდი ამ shard-ის მხარდაჭერილი კლიენტის დაყენებით.",
            cta: "Launcher-ის გახსნა",
          },
          {
            title: "შედი სამყაროში",
            body: "აირჩიე პერსონაჟის სლოტი, შედი სამყაროში და ააგე ამბავი, რომელიც დროთა განმავლობაში მუდმივად დარჩება.",
            cta: "პერსონაჟების მართვა",
          },
        ],
      },
      media: {
        labels: [
          "პირველი გამოფენის სურათის ჩვენება",
          "მეორე გამოფენის სურათის ჩვენება",
          "მესამე გამოფენის სურათის ჩვენება",
        ],
      },
      footer: {
        poweredHtml:
          "აშენებულია <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a>-ზე, მუდმივი მრავალმოთამაშიანი Skyrim roleplay-ის მხარდასაჭერად.",
      },
      calendar: {
        timeDisplayLabel: "კალენდრის დროის ჩვენება",
        gridLabel: "საზოგადოების ღონისძიებების კალენდარი",
        openLedger: "გზის ჩანაწერის გახსნა",
        playerRequests: "მოთამაშეთა მოთხოვნები",
        openEventRequest: "ღონისძიების მოთხოვნის გახსნა",
        ticketType: "ბილეთის ტიპი",
        eventRequest: "ღონისძიების მოთხოვნა",
        supportQuestion: "გჭირდება პირდაპირი ადმინის / ორგანიზატორის დახმარება ამ მოთხოვნაზე?",
        supportQuestionAria: "გჭირდება პირდაპირი ადმინის ან ორგანიზატორის დახმარება ამ მოთხოვნაზე?",
        no: "არა",
        yes: "დიახ",
        subject: "თემა",
        details: "დეტალები",
        noDescription: "აღწერა ჯერ არ არის.",
        interestCount: "დაინტერესებული: {count}",
        listedCount: "{count} ჩამოთვლილია",
        noEvents: "ღონისძიებები არ არის",
        quietMonth:
          "კალენდარი მზად რჩება აქამდე, სანამ შემდეგი ბაზარი, ომის საბჭო, რეიდი, სასამართლო სესია ან საზოგადოებრივი საღამო დაიგეგმება.",
        quietDate:
          "თუ გსურს აქ რამე დაიგეგმოს ან პირდაპირი დახმარება გჭირდება, ქვემოთ გახსენი ბილეთი და სტაფი UCP-დან დაგიკავშირდება.",
        ledgerIntro:
          "კალენდარი გვერდით დგას, სანამ თავად გადაწყვეტ მასში შესვლას. როცა ბაზარი, ომის საბჭო, რეიდი ან საზოგადოებრივი საღამო შენთვის მნიშვნელოვანია, გახსენი ჩანაწერი და მიჰყევი დეტალებს.",
        monthMetaLede: "{count} ჩამოთვლილია",
        dateSelectUpcoming: "{date}-ზე მომავალია: {count}. სრული აღწერის წასაკითხად ქვემოთ აირჩიე ერთი.",
        dateSelectListed: "{date}-ზე ჩამოთვლილია: {count}. სრული აღწერის წასაკითხად ქვემოთ აირჩიე ერთი.",
        createdBy: "შექმნა {name}",
        dateSelected: "არჩეული თარიღი",
        monthLabels: [
          "დილის ვარსკვლავი",
          "მზის განთიადი",
          "პირველი თესვა",
          "წვიმის ხელი",
          "მეორე თესვა",
          "შუა წელი",
          "მზის სიმაღლე",
          "ბოლო თესვა",
          "კერის ცეცხლი",
          "ყინვავარდნა",
          "მზის შებინდება",
          "საღამოს ვარსკვლავი",
        ],
        eventStatus: {
          SCHEDULED: "დაგეგმილი",
          CANCELLED: "გაუქმებული",
          COMPLETED: "დასრულებული",
        },
        timeMeta: {
          showingHost: "ნაჩვენებია ჰოსტის დრო.",
          showingLocal: "ნაჩვენებია შენი ბრაუზერის ადგილობრივი დრო.",
          hostMatches: "ჰოსტი {offset}. ამ თვეში შენი ბრაუზერი ემთხვევა ჰოსტს.",
          hostBehind: "ჰოსტი {offset}. ამ თვეში ჰოსტზე {difference}-ით უკან ხარ.",
          hostAhead: "ჰოსტი {offset}. ამ თვეში ჰოსტზე {difference}-ით წინ ხარ.",
        },
        heroAlert: {
          openNow: "ახლავე გახსნა",
          liveAria: "ახლა მიმდინარეობს: {title}",
          upcomingAria: "შემდეგ 24 საათშია დაგეგმილი: {title}",
          liveKicker: "ახლავე მიმდინარეობს",
          upcomingKicker: "შემდეგ 24 საათში",
          startedAt: "დაიწყო {time}",
          plusMore: "+{count} კიდევ",
          liveCopy:
            "ეს ღონისძიება ერთ საათზე ნაკლები ხნის წინ დაიწყო. გახსენი კალენდარი დეტალებზე გადასასვლელად და ინტერესის აღსანიშნავად.",
          liveCopyMore:
            "ეს ღონისძიება ერთ საათზე ნაკლები ხნის წინ დაიწყო. იმავე ფანჯარაში მალე სხვა ღონისძიებებიც არის დაგეგმილი.",
          upcomingCopy:
            "ეს ღონისძიება მალე იწყება. გახსენი კალენდარი სრული დეტალების წასაკითხად და ინტერესის აღსანიშნავად.",
          upcomingCopyMore:
            "ეს ღონისძიება მალე იწყება. იმავე 24-საათიან ფანჯარაში სხვა ღონისძიებებიც არის.",
        },
        ticket: {
          introTitle: "ღონისძიების მოთხოვნა",
          introCopy:
            "გახსენი ბილეთი აქ, რათა საზოგადოებრივი ღონისძიება მოითხოვო. თუ ასევე გჭირდება პირდაპირი ადმინის ან ორგანიზატორის დახმარება, ეს ქვემოთ ფორმაში მონიშნე.",
          introCopySignedOut:
            "შედი ანგარიშში, რათა ამ კალენდრის ფანჯრიდან პირდაპირი ბილეთი გაუხსნა ადმინებსა და ღონისძიების ორგანიზატორებს.",
          formTitle: "ღონისძიების მოთხოვნის გახსნა",
          formNote:
            "ეს UCP-ში ნამდვილ ბილეთს ხსნის, რათა ადმინებმა და ღონისძიების ორგანიზატორებმა მოთხოვნა პირდაპირ განიხილონ.",
          placeholder:
            "უთხარი სტაფს, რა ტიპის ღონისძიება გინდა, რომელ თარიღს უმიზნებ და რა ფრაქციის ან პერსონაჟის კონტექსტია მნიშვნელოვანი.",
          signInMessage: "შედი ანგარიშში, რათა კალენდრიდან ღონისძიების მოთხოვნა გახსნა.",
          defaultSubject: "ღონისძიების მოთხოვნა {date}-ისთვის",
          directSupport: "მოთხოვნილია პირდაპირი ადმინის / ორგანიზატორის მხარდაჭერა: {value}\n\n{message}",
        },
        messages: {
          loadError: "ღონისძიებების ჩატვირთვა ახლა ვერ მოხერხდა.",
          interestAdded: "შენ თავი დაინტერესებულად მონიშნე.",
          interestRemoved: "ინტერესი მოხსნილია.",
          interestError: "ღონისძიების ინტერესის განახლება ვერ მოხერხდა.",
          signInCarry: "ჯერ აქ შედი ანგარიშში და ინტერესის მონიშვნა შენს ანგარიშზე გადავა.",
          sessionExpiredInterest:
            "შენი ვებ-სესია ამოიწურა. თავიდან შედი ანგარიშში და ინტერესის მონიშვნა გაგრძელდება.",
          pickDate: "ჯერ აირჩიე თარიღი, შემდეგ გახსენი მოთხოვნა იმ დღიდან.",
          addDetails: "დაამატე რამდენიმე დეტალი, რათა სტაფმა იცოდეს, რა დახმარება გჭირდება.",
          ticketOpened: "შენი ბილეთი გახსნილია. ადმინებსა და ორგანიზატორებს ახლა UCP-ში შეუძლიათ გაგრძელება.",
          ticketOpenedWithId:
            "ბილეთი #{id} გახსნილია. ადმინებსა და ორგანიზატორებს ახლა შენს UCP ბილეთებში შეუძლიათ პასუხი.",
          sessionExpiredTicket:
            "შენი ვებ-სესია ამოიწურა. თავიდან შედი ანგარიშში და ბილეთის მოთხოვნის ფორმა კვლავ გაიხსნება.",
          ticketError: "ბილეთის გახსნა ახლა ვერ მოხერხდა.",
        },
      },
      contactModal: {
        verificationUnavailable:
          "ვერიფიკაცია ახლა მიუწვდომელია. დაამატე Turnstile გასაღებები სერვერის პარამეტრებში, რათა ეს საკონტაქტო ნაკადი დაიცვა.",
        verificationTest:
          "ლოკალური გადახედვა Cloudflare Turnstile-ის სატესტო გასაღებებს იყენებს. საჯარო გაშვებამდე შეცვალე ისინი ნამდვილით.",
        verificationPrompt: "გაგზავნამდე დაასრულე ვერიფიკაციის გამოწვევა.",
        verificationLoadFailed: "ვერიფიკაციის ჩატვირთვა ახლა ვერ მოხერხდა. განაახლე გვერდი და სცადე თავიდან.",
        verificationScriptFailed: "ვერიფიკაციის სკრიპტის ჩატვირთვა ვერ მოხერხდა. შეამოწმე კავშირი და სცადე თავიდან.",
        verificationComplete: "ვერიფიკაცია დასრულდა. ახლა შეგიძლია შეტყობინების გაგზავნა.",
        verificationCompleteTest: "ვერიფიკაცია დასრულდა Cloudflare-ის Turnstile სატესტო გასაღებებით.",
        verificationExpired: "ვერიფიკაციას ვადა გაუვიდა. თავიდან შეავსე captcha.",
        verificationChallengeFailed: "ვერიფიკაციის ჩატვირთვა ვერ მოხერხდა. სცადე გამოწვევის განახლება.",
        verificationPassed: "ვერიფიკაცია გავლილია. გაგზავნამდე გადახედე email-ის მონახაზს შენს ფოსტის აპში.",
        verificationFailed: "ვერიფიკაცია ვერ მოხერხდა. შეავსე captcha და სცადე თავიდან.",
        mailto: {
          subjectPrefix: "[შემქმნელთა პროგრამა]",
          greeting: "გამარჯობა Skyrim Unbound-ის გუნდო,",
          interest: "მსურს ოფიციალურ კონტენტის შემქმნელთა პროგრამაში განაცხადის გაკეთება.",
          labelName: "სახელი",
          labelEmail: "ელფოსტა",
          labelSubject: "თემა",
          labelMessage: "შეტყობინება",
        },
      },
      auth: {
        challengeEmail: "{email}-ზე გაგზავნილი 6-ნიშნა კოდი შეიყვანე.",
        challengeTotp: "შეიყვანე მიმდინარე 6-ნიშნა კოდი შენი authenticator აპიდან.",
        emailOtpPlaceholder: "6-ნიშნა email კოდი",
        totpPlaceholder: "6-ნიშნა authenticator კოდი",
        footerHtml:
          "პაროლის აღდგენა ან სრული ანგარიშის დაყენება გჭირდება? გააგრძელე <a data-ucp-link=\"login\" href=\"/ucp/?auth=login\">UCP ანგარიშის ცენტრში</a>.",
        sessionExpired: "სესია ამოიწურა. გასაგრძელებლად თავიდან შედი.",
        welcomeBack: "კეთილი დაბრუნება, {username}.",
        primaryAccepted: "ძირითადი პაროლი მიღებულია. დაასრულე დარჩენილი ვერიფიკაციის ნაბიჯები.",
        signInError: "ახლა შესვლა ვერ მოხერხდა.",
        verificationFailed: "ვერიფიკაცია ვერ მოხერხდა.",
      },
    },
    tr: {
      meta: {
        title: "Skyrim Unbound",
        description:
          "Skyrim Unbound, kalıcı karakterlere, ekip tarafından incelenen girişe ve uzun biçimli yazılı hikâye anlatımına odaklanan tek shard Skyrim roleplay sunucusudur.",
      },
      hero: {
        title: "Skyrim Unbound",
        trailerTitle: "Skyrim Unbound Yakında",
        features: [
          {
            title: "Odaklı lore gelişimi",
            body:
              "Hikâyeler, etkinlikler ve bölgesel gerilimler ortama bağlı kalır; böylece dünya gürültüyle değil, niyetle büyür.",
          },
          {
            title: "Oyuncuların yönettiği dünya",
            body:
              "Ekonomi, oyuncu konutları ve işletmeler shard'da yaşayan kişilerce sahiplenilecek, savunulacak ve şekillendirilecek şekilde tasarlandı.",
          },
          {
            title: "Resmî ve gayriresmî fraksiyonlar",
            body:
              "Tanınan güçler ve yükselen gruplar, örgütlenme ve hareket etme biçimleriyle avantaj, kimlik ve etki inşa edebilir.",
          },
          {
            title: "Bölgeler ve siyaset",
            body:
              "Fraksiyon bölgeleri ve siyasi çatışmalar hem küçük hem büyük ölçekte önemlidir; yerel seçimler daha uzağa yankılanabilir.",
          },
          {
            title: "Gerçek sonuçlar",
            body:
              "Karakterinin eylemleri itibarını, erişimini, güveni ve sonraki sahnelerin geçmiş seçimlere vereceği karşılığı şekillendirebilir.",
          },
          {
            title: "Her oyun tarzına yer",
            body:
              "Dünya daha soğuk ve sert hissettirse de sakin, yasal, sosyal ve ağır tempolu karakterlerin de önem kazanacağı alan vardır.",
          },
          {
            title: "Düzenli güncellemeler",
            body: "Deneyimini geliştirmek için sürekli iyileştirmeler ve yeni özellikler.",
          },
          {
            title: "Katı roleplay",
            body: "Gerçekçi karakter gelişimine ve sürükleyici hikâye anlatımına güçlü vurgu.",
          },
          {
            title: "Profesyonel ekip",
            body: "Roleplay kalite standartlarını korumaya adanmış deneyimli ekip.",
          },
        ],
      },
      join: {
        steps: [
          {
            title: "UCP'ni oluştur",
            body: "Hesabını aç, güvenceye al ve karakterlerinle destek geçmişinde kullanacağın kimliği hazırla.",
            cta: "Hesap oluştur",
          },
          {
            title: "Whitelist gönder",
            body: "Roleplay başvurusunu yanıtla, karakter geçmişini tamamla ve Supporter ile Admin incelemesinden geç.",
            cta: "Başvuruyu başlat",
          },
          {
            title: "İstemciyi kur",
            body: "Yerel launcher paketini al ve bu shard için desteklenen istemci kurulumu üzerinden bağlan.",
            cta: "Launcher'ı aç",
          },
          {
            title: "Dünyaya gir",
            body: "Karakter slotunu seç, dünyaya adım at ve zaman içinde kalıcı kalan bir hikâye kur.",
            cta: "Karakterleri yönet",
          },
        ],
      },
      media: {
        labels: [
          "İlk vitrin görselini göster",
          "İkinci vitrin görselini göster",
          "Üçüncü vitrin görselini göster",
        ],
      },
      footer: {
        poweredHtml:
          "Kalıcı çok oyunculu Skyrim roleplay'i desteklemek için <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> üzerine inşa edildi.",
      },
      calendar: {
        timeDisplayLabel: "Takvim saat gösterimi",
        gridLabel: "Topluluk etkinlik takvimi",
        openLedger: "Yol defterini aç",
        playerRequests: "Oyuncu talepleri",
        openEventRequest: "Etkinlik talebi aç",
        ticketType: "Bilet türü",
        eventRequest: "Etkinlik talebi",
        supportQuestion: "Bu talep için doğrudan admin / organizatör desteğine ihtiyacın var mı?",
        supportQuestionAria: "Bu talep için doğrudan admin veya organizatör desteğine ihtiyacın var mı?",
        no: "Hayır",
        yes: "Evet",
        subject: "Konu",
        details: "Detaylar",
        noDescription: "Henüz açıklama yok.",
        interestCount: "İlgilenen: {count}",
        listedCount: "{count} listelendi",
        noEvents: "Etkinlik yok",
        quietMonth:
          "Takvim, sıradaki pazar, savaş konseyi, baskın, mahkeme oturumu veya topluluk gecesi planlanana kadar burada hazır bekler.",
        quietDate:
          "Burada bir şey planlatmak istiyorsan veya doğrudan yardıma ihtiyacın varsa aşağıdan bir bilet aç; ekip UCP üzerinden seninle koordine olabilir.",
        ledgerIntro:
          "Takvim, sen içine adım atmaya karar verene kadar kenarda durur. Bir pazar, savaş konseyi, baskın veya topluluk gecesi senin için önemli olduğunda kaydı aç ve ayrıntıları takip et.",
        monthMetaLede: "{count} listelendi",
        dateSelectUpcoming: "{date} tarihinde yaklaşan: {count}. Tam açıklamayı okumak için aşağıdan birini seç.",
        dateSelectListed: "{date} tarihinde listelenen: {count}. Tam açıklamayı okumak için aşağıdan birini seç.",
        createdBy: "{name} tarafından oluşturuldu",
        dateSelected: "Seçili tarih",
        monthLabels: [
          "Sabah Yıldızı",
          "Güneşin Şafağı",
          "İlk Tohum",
          "Yağmurun Eli",
          "İkinci Tohum",
          "Yıl Ortası",
          "Güneşin Tepesi",
          "Son Tohum",
          "Ocak Ateşi",
          "Don Düşüşü",
          "Güneşin Alacakaranlığı",
          "Akşam Yıldızı",
        ],
        eventStatus: {
          SCHEDULED: "PLANLANDI",
          CANCELLED: "İPTAL EDİLDİ",
          COMPLETED: "TAMAMLANDI",
        },
        timeMeta: {
          showingHost: "Sunucu sahibinin saati gösteriliyor.",
          showingLocal: "Yerel tarayıcı saatin gösteriliyor.",
          hostMatches: "Sunucu {offset}. Tarayıcın bu ay sunucu saatiyle eşleşiyor.",
          hostBehind: "Sunucu {offset}. Bu ay sunucudan {difference} geridesin.",
          hostAhead: "Sunucu {offset}. Bu ay sunucudan {difference} ileridesin.",
        },
        heroAlert: {
          openNow: "Şimdi Aç",
          liveAria: "Şu anda canlı: {title}",
          upcomingAria: "Önümüzdeki yirmi dört saat içinde: {title}",
          liveKicker: "Şu anda canlı",
          upcomingKicker: "Önümüzdeki 24 saat içinde",
          startedAt: "{time} başladı",
          plusMore: "+{count} daha",
          liveCopy:
            "Bu etkinlik bir saatten kısa süre önce başladı. Ayrıntılara atlamak ve ilgi işaretlemek için takvimi aç.",
          liveCopyMore:
            "Bu etkinlik bir saatten kısa süre önce başladı. Aynı zaman aralığında yakında başka etkinlikler de planlandı.",
          upcomingCopy:
            "Bu etkinlik yakında başlıyor. Tüm ayrıntıları okumak ve ilgi işaretlemek için takvimi aç.",
          upcomingCopyMore:
            "Bu etkinlik yakında başlıyor. Aynı yirmi dört saatlik aralıkta başka etkinlikler de var.",
        },
        ticket: {
          introTitle: "Etkinlik talep et",
          introCopy:
            "Bir topluluk etkinliği talep etmek için buradan bilet aç. Doğrudan admin veya organizatör desteğine de ihtiyacın varsa aşağıdaki formda belirt.",
          introCopySignedOut:
            "Bu takvim penceresinden adminlere ve etkinlik organizatörlerine doğrudan bilet açmak için giriş yap.",
          formTitle: "Etkinlik talebi aç",
          formNote:
            "Bu, adminlerin ve etkinlik organizatörlerinin talebini doğrudan inceleyebilmesi için UCP'de gerçek bir bilet açar.",
          placeholder:
            "Ekibe ne tür bir etkinlik istediğini, hangi tarihi hedeflediğini ve önemli olan fraksiyon ya da karakter bağlamını anlat.",
          signInMessage: "Takvimden etkinlik talebi açmak için giriş yap.",
          defaultSubject: "{date} için etkinlik talebi",
          directSupport: "Doğrudan admin / organizatör desteği istendi: {value}\n\n{message}",
        },
        messages: {
          loadError: "Etkinlikler şu anda yüklenemedi.",
          interestAdded: "Kendini ilgili olarak işaretledin.",
          interestRemoved: "İlgi kaldırıldı.",
          interestError: "Etkinlik ilgisi güncellenemedi.",
          signInCarry: "Önce burada giriş yap; ilgi işaretin hesabına taşınacak.",
          sessionExpiredInterest:
            "Web oturumun sona erdi. Tekrar giriş yap, ilgi işareti kaldığı yerden devam edecek.",
          pickDate: "Önce bir tarih seç, sonra o günden talep aç.",
          addDetails: "Ekibin neye ihtiyacın olduğunu bilmesi için birkaç detay ekle.",
          ticketOpened: "Biletin açık. Adminler ve etkinlik organizatörleri UCP'de takip edebilir.",
          ticketOpenedWithId:
            "Bilet #{id} açıldı. Adminler ve etkinlik organizatörleri artık UCP biletlerinde yanıt verebilir.",
          sessionExpiredTicket:
            "Web oturumun sona erdi. Tekrar giriş yap, bilet talep formu yeniden açılacak.",
          ticketError: "Şu anda bilet açılamadı.",
        },
      },
      contactModal: {
        verificationUnavailable:
          "Doğrulama şu anda kullanılamıyor. Bu iletişim akışını korumak için sunucu ayarlarına Turnstile anahtarları ekle.",
        verificationTest:
          "Yerel önizleme Cloudflare Turnstile test anahtarlarını kullanıyor. Herkese açık yayından önce gerçek anahtarlarla değiştir.",
        verificationPrompt: "Göndermeden önce doğrulama adımını tamamla.",
        verificationLoadFailed: "Doğrulama şu anda yüklenemedi. Sayfayı yenileyip tekrar dene.",
        verificationScriptFailed: "Doğrulama betiği yüklenemedi. Bağlantını kontrol edip tekrar dene.",
        verificationComplete: "Doğrulama tamamlandı. Mesajını şimdi gönderebilirsin.",
        verificationCompleteTest: "Doğrulama Cloudflare'ın Turnstile test anahtarlarıyla tamamlandı.",
        verificationExpired: "Doğrulama süresi doldu. Captcha'yı yeniden tamamla.",
        verificationChallengeFailed: "Doğrulama yüklenemedi. Adımı yenilemeyi dene.",
        verificationPassed: "Doğrulama geçti. Göndermeden önce posta uygulamandaki e-posta taslağını gözden geçir.",
        verificationFailed: "Doğrulama başarısız. Captcha'yı tamamlayıp tekrar dene.",
        mailto: {
          subjectPrefix: "[İçerik Üretici Programı]",
          greeting: "Merhaba Skyrim Unbound ekibi,",
          interest: "Resmî içerik üretici programına başvurmak istiyorum.",
          labelName: "Ad",
          labelEmail: "E-posta",
          labelSubject: "Konu",
          labelMessage: "Mesaj",
        },
      },
      auth: {
        challengeEmail: "{email} adresine gönderilen 6 haneli kodu gir.",
        challengeTotp: "Doğrulayıcı uygulamandaki geçerli 6 haneli kodu gir.",
        emailOtpPlaceholder: "6 haneli e-posta kodu",
        totpPlaceholder: "6 haneli doğrulayıcı kodu",
        footerHtml:
          "Şifre kurtarma veya tam hesap kurulumu mu gerekiyor? <a data-ucp-link=\"login\" href=\"/ucp/?auth=login\">UCP hesap merkezinde</a> devam et.",
        sessionExpired: "Oturum sona erdi. Devam etmek için tekrar giriş yap.",
        welcomeBack: "Tekrar hoş geldin, {username}.",
        primaryAccepted: "Birincil şifre kabul edildi. Kalan doğrulama adımlarını tamamla.",
        signInError: "Şu anda giriş yapılamadı.",
        verificationFailed: "Doğrulama başarısız.",
      },
    },
    es: {
      meta: {
        title: "Skyrim Unbound",
        description:
          "Skyrim Unbound es un servidor de roleplay de Skyrim en un solo shard, centrado en personajes persistentes, entrada revisada por el staff y narrativa textual de largo formato.",
      },
      hero: {
        title: "Skyrim Unbound",
        trailerTitle: "Skyrim Unbound próximamente",
        features: [
          {
            title: "Desarrollo de lore enfocado",
            body:
              "Las tramas, eventos y tensiones regionales se mantienen arraigados al mundo para que crezca con intención en lugar de ruido.",
          },
          {
            title: "Mundo dirigido por jugadores",
            body:
              "La economía, las viviendas y los negocios están pensados para ser poseídos, defendidos y moldeados por quienes viven en el shard.",
          },
          {
            title: "Facciones oficiales y no oficiales",
            body:
              "Los poderes reconocidos y los grupos emergentes pueden construir ventajas, identidad e influencia según cómo se organizan y actúan.",
          },
          {
            title: "Territorios y política",
            body:
              "El territorio de facción y el conflicto político importan a pequeña y gran escala, así que las decisiones locales pueden resonar hacia fuera.",
          },
          {
            title: "Consecuencias reales",
            body:
              "Las acciones de tu personaje pueden moldear reputación, acceso, confianza y la forma en que escenas posteriores responden a lo que hiciste.",
          },
          {
            title: "Espacio para cada estilo de juego",
            body:
              "Aunque el mundo se sienta más frío y duro, también hay espacio para personajes tranquilos, legales, sociales y de desarrollo lento.",
          },
          {
            title: "Actualizaciones regulares",
            body: "Mejoras constantes y nuevas funciones para enriquecer tu experiencia.",
          },
          {
            title: "Roleplay estricto",
            body: "Gran énfasis en el desarrollo realista de personajes y la narración inmersiva.",
          },
          {
            title: "Staff profesional",
            body: "Equipo experimentado dedicado a mantener estándares de roleplay de calidad.",
          },
        ],
      },
      join: {
        steps: [
          {
            title: "Crea tu UCP",
            body: "Crea tu cuenta, protégela y configura la identidad que usarás en tus personajes e historial de soporte.",
            cta: "Crear cuenta",
          },
          {
            title: "Envía la whitelist",
            body: "Responde la solicitud de roleplay, completa el trasfondo de tu personaje y espera la revisión de Supporters y Admins.",
            cta: "Iniciar solicitud",
          },
          {
            title: "Instala el cliente",
            body: "Obtén el paquete del launcher local y conéctate mediante la configuración de cliente compatible con este shard.",
            cta: "Abrir launcher",
          },
          {
            title: "Entra al mundo",
            body: "Elige tu ranura de personaje, entra al mundo y construye una historia que permanezca en el tiempo.",
            cta: "Gestionar personajes",
          },
        ],
      },
      media: {
        labels: [
          "Mostrar la primera imagen de la vitrina",
          "Mostrar la segunda imagen de la vitrina",
          "Mostrar la tercera imagen de la vitrina",
        ],
      },
      footer: {
        poweredHtml:
          "Creado con <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> para admitir roleplay persistente multijugador en Skyrim.",
      },
      calendar: {
        timeDisplayLabel: "Visualización de hora del calendario",
        gridLabel: "Calendario de eventos de la comunidad",
        openLedger: "Abrir el registro del camino",
        playerRequests: "Solicitudes de jugadores",
        openEventRequest: "Abrir solicitud de evento",
        ticketType: "Tipo de ticket",
        eventRequest: "Solicitud de evento",
        supportQuestion: "¿Necesitas soporte directo de admin / organizador con esta solicitud?",
        supportQuestionAria: "¿Necesitas soporte directo de admin u organizador con esta solicitud?",
        no: "No",
        yes: "Sí",
        subject: "Asunto",
        details: "Detalles",
        noDescription: "Aún no hay descripción.",
        interestCount: "Interesados: {count}",
        listedCount: "{count} listados",
        noEvents: "No hay eventos",
        quietMonth:
          "El calendario permanece listo aquí hasta que se programe el próximo mercado, consejo de guerra, incursión, sesión de corte o noche comunitaria.",
        quietDate:
          "Si quieres programar algo aquí o necesitas ayuda directa, abre un ticket abajo y el staff podrá coordinar contigo desde el UCP.",
        ledgerIntro:
          "El calendario queda a un lado hasta que decidas entrar. Cuando un mercado, consejo de guerra, incursión o noche comunitaria te importe, abre la entrada y sigue los detalles.",
        monthMetaLede: "{count} listados",
        dateSelectUpcoming: "Próximos el {date}: {count}. Selecciona uno abajo para leer la descripción completa.",
        dateSelectListed: "Listados el {date}: {count}. Selecciona uno abajo para leer la descripción completa.",
        createdBy: "Creado por {name}",
        dateSelected: "Fecha seleccionada",
        monthLabels: [
          "Estrella Matutina",
          "Amanecer del Sol",
          "Primera Semilla",
          "Mano de Lluvia",
          "Segunda Semilla",
          "Medio Año",
          "Altura del Sol",
          "Última Semilla",
          "Fuego del Hogar",
          "Caída de Escarcha",
          "Crepúsculo del Sol",
          "Estrella Vespertina",
        ],
        eventStatus: {
          SCHEDULED: "PROGRAMADO",
          CANCELLED: "CANCELADO",
          COMPLETED: "COMPLETADO",
        },
        timeMeta: {
          showingHost: "Mostrando la hora del host.",
          showingLocal: "Mostrando la hora local de tu navegador.",
          hostMatches: "Host {offset}. Tu navegador coincide con el host este mes.",
          hostBehind: "Host {offset}. Estás {difference} detrás del host este mes.",
          hostAhead: "Host {offset}. Estás {difference} por delante del host este mes.",
        },
        heroAlert: {
          openNow: "Abrir ahora",
          liveAria: "En vivo ahora: {title}",
          upcomingAria: "Próximo en las siguientes veinticuatro horas: {title}",
          liveKicker: "En vivo ahora mismo",
          upcomingKicker: "En las próximas 24 horas",
          startedAt: "Comenzó {time}",
          plusMore: "+{count} más",
          liveCopy:
            "Este evento comenzó hace menos de una hora. Abre el calendario para ir a los detalles y marcar interés.",
          liveCopyMore:
            "Este evento comenzó hace menos de una hora. Hay más eventos programados pronto en la misma ventana.",
          upcomingCopy:
            "Este evento se acerca. Abre el calendario para leer todos los detalles y marcar interés.",
          upcomingCopyMore:
            "Este evento se acerca. Otros eventos también caen dentro de la misma ventana de veinticuatro horas.",
        },
        ticket: {
          introTitle: "Solicitar un evento",
          introCopy:
            "Abre un ticket aquí para solicitar un evento comunitario. Si también necesitas ayuda directa de admin u organizador, márcalo en el formulario de abajo.",
          introCopySignedOut:
            "Inicia sesión para abrir un ticket directo para admins y organizadores desde esta ventana del calendario.",
          formTitle: "Abrir solicitud de evento",
          formNote:
            "Esto abre un ticket real en el UCP para que admins y organizadores puedan revisar tu solicitud directamente.",
          placeholder:
            "Dile al staff qué tipo de evento quieres, qué fecha tienes en mente y cualquier contexto de facción o personaje que importe.",
          signInMessage: "Inicia sesión para abrir una solicitud de evento desde el calendario.",
          defaultSubject: "Solicitud de evento para {date}",
          directSupport: "Soporte directo de admin / organizador solicitado: {value}\n\n{message}",
        },
        messages: {
          loadError: "No se pudieron cargar los eventos ahora mismo.",
          interestAdded: "Te marcaste como interesado.",
          interestRemoved: "Interés eliminado.",
          interestError: "No se pudo actualizar el interés del evento.",
          signInCarry: "Inicia sesión aquí primero y la marca de interés se trasladará a tu cuenta.",
          sessionExpiredInterest:
            "Tu sesión web expiró. Inicia sesión de nuevo y la marca de interés continuará.",
          pickDate: "Elige una fecha primero y luego abre una solicitud desde ese día.",
          addDetails: "Agrega algunos detalles para que el staff sepa qué ayuda necesitas.",
          ticketOpened:
            "Tu ticket está abierto. Admins y organizadores pueden hacer seguimiento en el UCP.",
          ticketOpenedWithId:
            "El ticket #{id} está abierto. Admins y organizadores ya pueden responder en tus tickets UCP.",
          sessionExpiredTicket:
            "Tu sesión web expiró. Inicia sesión de nuevo y el formulario de solicitud de ticket se reabrirá.",
          ticketError: "No se pudo abrir un ticket ahora mismo.",
        },
      },
      contactModal: {
        verificationUnavailable:
          "La verificación no está disponible ahora mismo. Agrega claves de Turnstile en la configuración del servidor para proteger este flujo de contacto.",
        verificationTest:
          "La vista previa local usa claves de prueba de Cloudflare Turnstile. Reemplázalas con claves reales antes del lanzamiento público.",
        verificationPrompt: "Completa el desafío de verificación antes de enviar.",
        verificationLoadFailed:
          "La verificación no se pudo cargar ahora mismo. Actualiza la página e inténtalo de nuevo.",
        verificationScriptFailed:
          "El script de verificación no se pudo cargar. Revisa tu conexión e inténtalo de nuevo.",
        verificationComplete: "Verificación completa. Ya puedes enviar tu mensaje.",
        verificationCompleteTest: "Verificación completa con las claves de prueba de Cloudflare Turnstile.",
        verificationExpired: "La verificación expiró. Completa el captcha de nuevo.",
        verificationChallengeFailed: "La verificación no se pudo cargar. Intenta actualizar el desafío.",
        verificationPassed:
          "Verificación superada. Revisa tu borrador de correo en tu aplicación de correo antes de enviarlo.",
        verificationFailed: "La verificación falló. Completa el captcha e inténtalo de nuevo.",
        mailto: {
          subjectPrefix: "[Programa de creadores]",
          greeting: "Hola equipo de Skyrim Unbound,",
          interest: "Me gustaría postularme al programa oficial de creadores de contenido.",
          labelName: "Nombre",
          labelEmail: "Correo",
          labelSubject: "Asunto",
          labelMessage: "Mensaje",
        },
      },
      auth: {
        challengeEmail: "Introduce el código de 6 dígitos enviado a {email}.",
        challengeTotp: "Introduce el código actual de 6 dígitos de tu aplicación autenticadora.",
        emailOtpPlaceholder: "Código de correo de 6 dígitos",
        totpPlaceholder: "Código autenticador de 6 dígitos",
        footerHtml:
          "¿Necesitas recuperar contraseña o completar la configuración de la cuenta? Continúa en el <a data-ucp-link=\"login\" href=\"/ucp/?auth=login\">centro de cuentas UCP</a>.",
        sessionExpired: "La sesión expiró. Inicia sesión de nuevo para continuar.",
        welcomeBack: "Bienvenido de nuevo, {username}.",
        primaryAccepted: "Contraseña principal aceptada. Completa los pasos de verificación restantes.",
        signInError: "No se pudo iniciar sesión ahora mismo.",
        verificationFailed: "La verificación falló.",
      },
    },
    ru: {
      meta: {
        title: "Skyrim Unbound",
        description:
          "Skyrim Unbound — одношардовый roleplay-сервер Skyrim с постоянными персонажами, входом через проверку staff и длинным текстовым повествованием.",
      },
      hero: {
        title: "Skyrim Unbound",
        trailerTitle: "Skyrim Unbound скоро выйдет",
        features: [
          {
            title: "Сфокусированное развитие лора",
            body:
              "Сюжеты, события и региональное напряжение остаются укоренены в сеттинге, чтобы мир рос осмысленно, а не шумно.",
          },
          {
            title: "Мир, управляемый игроками",
            body:
              "Экономика, жильё игроков и бизнесы задуманы так, чтобы ими владели, их защищали и формировали люди, живущие в шарде.",
          },
          {
            title: "Официальные и неофициальные фракции",
            body:
              "Признанные силы и растущие группы могут строить преимущества, идентичность и влияние через то, как они организуются и действуют.",
          },
          {
            title: "Территории и политика",
            body:
              "Фракционные территории и политически мотивированные конфликты важны и в малом, и в большом масштабе, поэтому локальные решения могут расходиться дальше.",
          },
          {
            title: "Реальные последствия",
            body:
              "Действия вашего персонажа могут менять репутацию, доступ, доверие и то, как последующие сцены ответят на сделанный выбор.",
          },
          {
            title: "Место для любого стиля игры",
            body:
              "Даже если мир кажется холоднее и суровее, в нём есть место спокойным, законным, социальным и медленно развивающимся персонажам.",
          },
          {
            title: "Регулярные обновления",
            body: "Постоянные улучшения и новые функции, которые делают опыт богаче.",
          },
          {
            title: "Строгий roleplay",
            body: "Сильный акцент на реалистичном развитии персонажа и погружающем повествовании.",
          },
          {
            title: "Профессиональный staff",
            body: "Опытная команда, посвящённая поддержанию качественных стандартов roleplay.",
          },
        ],
      },
      join: {
        steps: [
          {
            title: "Создайте свой UCP",
            body: "Создайте аккаунт, защитите его и настройте личность, которую будете использовать для персонажей и истории поддержки.",
            cta: "Создать аккаунт",
          },
          {
            title: "Отправьте whitelist",
            body: "Ответьте на roleplay-заявку, завершите биографию персонажа и пройдите проверку Supporters и Admins.",
            cta: "Начать заявку",
          },
          {
            title: "Установите клиент",
            body: "Получите локальный пакет launcher и подключитесь через поддерживаемую настройку клиента для этого шарда.",
            cta: "Открыть launcher",
          },
          {
            title: "Войдите в мир",
            body: "Выберите слот персонажа, шагните в мир и стройте историю, которая сохраняется со временем.",
            cta: "Управлять персонажами",
          },
        ],
      },
      media: {
        labels: [
          "Показать первое изображение витрины",
          "Показать второе изображение витрины",
          "Показать третье изображение витрины",
        ],
      },
      footer: {
        poweredHtml:
          "Создано на <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> для поддержки постоянного многопользовательского Skyrim roleplay.",
      },
      calendar: {
        timeDisplayLabel: "Отображение времени календаря",
        gridLabel: "Календарь событий сообщества",
        openLedger: "Открыть дорожный реестр",
        playerRequests: "Запросы игроков",
        openEventRequest: "Открыть запрос события",
        ticketType: "Тип тикета",
        eventRequest: "Запрос события",
        supportQuestion: "Нужна ли вам прямая помощь admin / организатора по этому запросу?",
        supportQuestionAria: "Нужна ли вам прямая помощь admin или организатора по этому запросу?",
        no: "Нет",
        yes: "Да",
        subject: "Тема",
        details: "Детали",
        noDescription: "Описание пока отсутствует.",
        interestCount: "Заинтересованы: {count}",
        listedCount: "{count} указано",
        noEvents: "Нет событий",
        quietMonth:
          "Календарь остаётся готовым здесь, пока не будет назначен следующий рынок, военный совет, рейд, судебная сессия или вечер сообщества.",
        quietDate:
          "Если вы хотите запланировать что-то здесь или нужна прямая помощь, откройте тикет ниже, и staff сможет координироваться с вами через UCP.",
        ledgerIntro:
          "Календарь стоит в стороне, пока вы не решите войти в него. Когда рынок, военный совет, рейд или вечер сообщества важен для вас, откройте запись и следуйте деталям.",
        monthMetaLede: "{count} указано",
        dateSelectUpcoming: "Предстоящие на {date}: {count}. Выберите одно ниже, чтобы прочитать полное описание.",
        dateSelectListed: "Указано на {date}: {count}. Выберите одно ниже, чтобы прочитать полное описание.",
        createdBy: "Создал {name}",
        dateSelected: "Выбранная дата",
        monthLabels: [
          "Утренняя звезда",
          "Рассвет солнца",
          "Первое зерно",
          "Рука дождя",
          "Второе зерно",
          "Середина года",
          "Высота солнца",
          "Последнее зерно",
          "Огонь очага",
          "Морозопад",
          "Сумерки солнца",
          "Вечерняя звезда",
        ],
        eventStatus: {
          SCHEDULED: "ЗАПЛАНИРОВАНО",
          CANCELLED: "ОТМЕНЕНО",
          COMPLETED: "ЗАВЕРШЕНО",
        },
        timeMeta: {
          showingHost: "Показано время host.",
          showingLocal: "Показано локальное время вашего браузера.",
          hostMatches: "Host {offset}. В этом месяце ваш браузер совпадает с host.",
          hostBehind: "Host {offset}. В этом месяце вы отстаёте от host на {difference}.",
          hostAhead: "Host {offset}. В этом месяце вы опережаете host на {difference}.",
        },
        heroAlert: {
          openNow: "Открыть сейчас",
          liveAria: "Сейчас идёт: {title}",
          upcomingAria: "В ближайшие двадцать четыре часа: {title}",
          liveKicker: "Идёт прямо сейчас",
          upcomingKicker: "В ближайшие 24 часа",
          startedAt: "Началось {time}",
          plusMore: "+ещё {count}",
          liveCopy:
            "Это событие началось меньше часа назад. Откройте календарь, чтобы перейти к деталям и отметить интерес.",
          liveCopyMore:
            "Это событие началось меньше часа назад. В том же окне скоро запланированы и другие события.",
          upcomingCopy:
            "Это событие скоро начнётся. Откройте календарь, чтобы прочитать все детали и отметить интерес.",
          upcomingCopyMore:
            "Это событие скоро начнётся. Другие события тоже попадают в то же двадцатичетырёхчасовое окно.",
        },
        ticket: {
          introTitle: "Запросить событие",
          introCopy:
            "Откройте здесь тикет, чтобы запросить событие сообщества. Если вам также нужна прямая помощь admin или организатора, отметьте это в форме ниже.",
          introCopySignedOut:
            "Войдите, чтобы открыть прямой тикет для admins и организаторов событий из этого окна календаря.",
          formTitle: "Открыть запрос события",
          formNote:
            "Это открывает реальный тикет в UCP, чтобы admins и организаторы событий могли напрямую рассмотреть ваш запрос.",
          placeholder:
            "Расскажите staff, какое событие вы хотите, на какую дату ориентируетесь и какой контекст фракции или персонажа важен.",
          signInMessage: "Войдите, чтобы открыть запрос события из календаря.",
          defaultSubject: "Запрос события на {date}",
          directSupport: "Запрошена прямая поддержка admin / организатора: {value}\n\n{message}",
        },
        messages: {
          loadError: "Не удалось загрузить события прямо сейчас.",
          interestAdded: "Вы отметили себя заинтересованным.",
          interestRemoved: "Интерес удалён.",
          interestError: "Не удалось обновить интерес к событию.",
          signInCarry: "Сначала войдите здесь, и отметка интереса перенесётся в ваш аккаунт.",
          sessionExpiredInterest:
            "Ваша веб-сессия истекла. Войдите снова, и отметка интереса продолжится.",
          pickDate: "Сначала выберите дату, затем откройте запрос из этого дня.",
          addDetails: "Добавьте несколько деталей, чтобы staff понимал, какая помощь нужна.",
          ticketOpened: "Ваш тикет открыт. Admins и организаторы теперь могут продолжить в UCP.",
          ticketOpenedWithId:
            "Тикет #{id} открыт. Admins и организаторы теперь могут ответить в ваших UCP тикетах.",
          sessionExpiredTicket:
            "Ваша веб-сессия истекла. Войдите снова, и форма запроса тикета откроется заново.",
          ticketError: "Не удалось открыть тикет прямо сейчас.",
        },
      },
      contactModal: {
        verificationUnavailable:
          "Проверка сейчас недоступна. Добавьте ключи Turnstile в настройках сервера, чтобы защитить этот контактный поток.",
        verificationTest:
          "Локальный предпросмотр использует тестовые ключи Cloudflare Turnstile. Замените их настоящими ключами перед публичным запуском.",
        verificationPrompt: "Завершите проверку перед отправкой.",
        verificationLoadFailed: "Проверку не удалось загрузить прямо сейчас. Обновите страницу и попробуйте снова.",
        verificationScriptFailed: "Скрипт проверки не удалось загрузить. Проверьте соединение и попробуйте снова.",
        verificationComplete: "Проверка завершена. Теперь можно отправить сообщение.",
        verificationCompleteTest: "Проверка завершена с тестовыми ключами Cloudflare Turnstile.",
        verificationExpired: "Срок проверки истёк. Пройдите captcha снова.",
        verificationChallengeFailed: "Проверку не удалось загрузить. Попробуйте обновить challenge.",
        verificationPassed: "Проверка пройдена. Проверьте черновик письма в почтовом приложении перед отправкой.",
        verificationFailed: "Проверка не пройдена. Пройдите captcha и попробуйте снова.",
        mailto: {
          subjectPrefix: "[Программа создателей]",
          greeting: "Здравствуйте, команда Skyrim Unbound,",
          interest: "Я хотел бы подать заявку в официальную программу создателей контента.",
          labelName: "Имя",
          labelEmail: "Email",
          labelSubject: "Тема",
          labelMessage: "Сообщение",
        },
      },
      auth: {
        challengeEmail: "Введите 6-значный код, отправленный на {email}.",
        challengeTotp: "Введите текущий 6-значный код из приложения-аутентификатора.",
        emailOtpPlaceholder: "6-значный код из email",
        totpPlaceholder: "6-значный код аутентификатора",
        footerHtml:
          "Нужно восстановить пароль или полностью настроить аккаунт? Перейдите в <a data-ucp-link=\"login\" href=\"/ucp/?auth=login\">центр аккаунта UCP</a>.",
        sessionExpired: "Сессия истекла. Войдите снова, чтобы продолжить.",
        welcomeBack: "С возвращением, {username}.",
        primaryAccepted: "Основной пароль принят. Завершите оставшиеся шаги проверки.",
        signInError: "Не удалось войти прямо сейчас.",
        verificationFailed: "Проверка не пройдена.",
      },
    },
  };

  function mergeTranslationBranch(target, source) {
    if (Array.isArray(source)) {
      return source;
    }

    if (!source || typeof source !== "object") {
      return source;
    }

    const merged = target && typeof target === "object" && !Array.isArray(target) ? target : {};
    Object.keys(source).forEach((key) => {
      merged[key] = mergeTranslationBranch(merged[key], source[key]);
    });
    return merged;
  }

  const GE_CLEANUP = {
    meta: {
      title: "Skyrim Unbound",
      description:
        "Skyrim Unbound არის Skyrim-ის მკაცრი როლური სერვერი მუდმივი პერსონაჟებით, ხელით განხილული დაშვებით და გრძელ ტექსტურ ისტორიებზე აქცენტით.",
    },
    language: {
      select: "ენის არჩევა",
      selector: "ენის სია",
    },
    nav: {
      primary: "მთავარი ნავიგაცია",
      home: "მთავარი",
      join: "როგორ შემოუერთდე",
      world: "რატომ ჩვენ",
      community: "საზოგადოება",
      media: "მედია",
      events: "ღონისძიებები",
      contact: "კონტაქტი",
    },
    account: {
      defaultName: "ანგარიში",
      logOut: "გასვლა",
      openUcp: "UCP-ის გახსნა",
      signIn: "შესვლა",
      install: "ჩამოტვირთვა და დაყენება",
    },
    hero: {
      title: "Skyrim Unbound",
      lede:
        "Skyrim-ის მკაცრი როლური სერვერი მუდმივი პერსონაჟებით, დაშვების განაცხადით და ტექსტურ ისტორიებზე აქცენტით.",
      createAccount: "ანგარიშის შექმნა",
      joinDiscord: "Discord-ში შესვლა",
      calendarEyebrow: "საზოგადოების ღონისძიებები",
      calendarIntro:
        "ფრაქციის შეხვედრები, კონფლიქტის ღამეები, სასამართლო სცენები და სერვერის ღონისძიებები ერთ მშვიდ კალენდარში.",
      openCalendar: "კალენდრის გახსნა",
      trailerTitle: "Skyrim Unbound მალე გამოვა",
      trailerSubtitle: "მიმდინარე ჩვენება",
      worldTitle: "მკაცრი როლური თამაში",
      features: [
        {
          title: "გააზრებული სამყარო",
          body: "სიუჟეტები და დაძაბულობა Skyrim-ის გარემოს ეყრდნობა, ამიტომ ისტორია ბუნებრივად ვითარდება.",
        },
        {
          title: "მოთამაშეთა სამყარო",
          body: "ეკონომიკა, სახლები და ბიზნესები მოთამაშეების ხელშია და მათივე მოქმედებებით იცვლება.",
        },
        {
          title: "ფრაქციები",
          body: "ოფიციალურ და ახალ ჯგუფებს შეუძლიათ გავლენის, იდენტობისა და ძალაუფლების აშენება.",
        },
        {
          title: "ტერიტორიები და პოლიტიკა",
          body: "ადგილობრივი არჩევანი შეიძლება მთელ რეგიონზე აისახოს, განსაკუთრებით კონფლიქტის დროს.",
        },
        {
          title: "რეალური შედეგები",
          body: "ქმედებები ცვლის რეპუტაციას, ნდობას, წვდომას და მომავალ სცენებს.",
        },
        {
          title: "ადგილი ყველა სტილისთვის",
          body: "მკაცრ სამყაროშიც მნიშვნელოვანია მშვიდი, კანონიერი, სოციალური და ნელი ისტორიები.",
        },
        {
          title: "რეგულარული განახლებები",
          body: "სერვერი მუდმივად იხვეწება ახალი ფუნქციებითა და უკეთესი გამოცდილებით.",
        },
        {
          title: "მკაცრი როლური თამაში",
          body: "აქცენტი კეთდება რეალისტურ პერსონაჟებზე, წესებზე და ჩაძირულ ტექსტურ სცენებზე.",
        },
        {
          title: "გამოცდილი გუნდი",
          body: "გუნდი ზრუნავს წესრიგზე, ხარისხზე და სამართლიან განხილვაზე.",
        },
      ],
    },
    join: {
      title: "როგორ შემოუერთდე",
      intro: "შექმენი ანგარიში, გაგზავნე დაშვების განაცხადი, დააყენე კლიენტი და შედი სამყაროში.",
      steps: [
        {
          title: "შექმენი UCP ანგარიში",
          body: "შექმენი და დაიცავი ანგარიში, რომლითაც პერსონაჟებსა და მხარდაჭერის ისტორიას მართავ.",
          cta: "ანგარიშის შექმნა",
        },
        {
          title: "გაგზავნე დაშვების განაცხადი",
          body: "უპასუხე კითხვებს, აღწერე პერსონაჟის ისტორია და დაელოდე გუნდის განხილვას.",
          cta: "განაცხადის დაწყება",
        },
        {
          title: "დააყენე კლიენტი",
          body: "ჩამოტვირთე გამშვები პაკეტი და დაუკავშირდი სერვერს მხარდაჭერილი კლიენტით.",
          cta: "გამშვების გახსნა",
        },
        {
          title: "შედი სამყაროში",
          body: "აირჩიე პერსონაჟი და დაიწყე ისტორია, რომელიც დროთა განმავლობაში შენარჩუნდება.",
          cta: "პერსონაჟების მართვა",
        },
      ],
    },
    community: {
      titleHtml: "შემოუერთდი ჩვენს <span>საზოგადოებას</span>",
      intro: "გაიცანი სხვა მოთამაშეები, გააზიარე ისტორიები და მიიღე სიახლეები.",
      cards: [
        {
          titleHtml: "Discord საზოგადოება <span aria-hidden=\"true\">&#8599;</span>",
          bodyHtml:
            "ჩვენს Discord სერვერზე არის <strong data-discord-member-copy>Live</strong> წევრი. მხარდაჭერა, განცხადებები და ღონისძიებები აქ ხდება.",
          cta: "Discord-ზე გადასვლა",
          stats: [
            { value: "Live", label: "წევრი" },
            { value: "Checking", label: "ონლაინ" },
          ],
        },
        {
          titleHtml: "ოფიციალური ფორუმი <span aria-hidden=\"true\">&#10022;</span>",
          bodyHtml: "ოფიციალური ფორუმი მზადდება. ამ ეტაპზე მთავარი საკომუნიკაციო სივრცე Discord-ია.",
          cta: "მალე",
          stats: [
            { value: "Soon", label: "ფორუმი" },
            { value: "Discord", label: "ახლა აქტიურია" },
          ],
        },
      ],
    },
    media: {
      title: "საზოგადოების გალერეა",
      intro: "სერვერში გადაღებული მომენტები, რომლებიც სამყაროს განვითარებას აჩვენებს.",
      labels: [
        "პირველი სურათის ჩვენება",
        "მეორე სურათის ჩვენება",
        "მესამე სურათის ჩვენება",
      ],
    },
    contact: {
      eyebrow: "შემქმნელთა პროგრამა",
      title: "გახდი სერვერის ოფიციალური კონტენტის შემქმნელი",
      body:
        "ვეძებთ შემქმნელებს, რომლებიც გააშუქებენ ღონისძიებებს, პერსონაჟებს, ფრაქციების ამბებს და ყოველდღიურ სცენებს.",
      cta: "დაგვიკავშირდი",
    },
    youtube: {
      text: "გამოიწერე ჩვენი YouTube არხი სერვერის ვიდეოებისთვის, სიახლეებისთვის და საზოგადოების კონტენტისთვის.",
      cta: "YouTube-ზე გადასვლა",
    },
    footer: {
      legalTitle: "უფლებები და შენიშვნა",
      legalBody:
        "Skyrim Unbound არის დამოუკიდებელი როლური პროექტი The Elder Scrolls V: Skyrim-ისთვის და არ არის დაკავშირებული Bethesda Softworks-თან, Bethesda Game Studios-თან, ZeniMax Media-სთან, Microsoft-თან ან სხვა უფლებათმფლობელებთან.",
      quickLinksTitle: "სწრაფი ბმულები",
      quickLinks: ["მთავარი", "როგორ შემოუერთდე", "რატომ ჩვენ", "საზოგადოება", "ღონისძიებები", "UCP", "გამშვები"],
      poweredTitle: "მუშაობს SkyMP-ზე",
      poweredHtml:
        "აშენებულია <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a>-ზე, მუდმივი მრავალმოთამაშიანი Skyrim გამოცდილების მხარდასაჭერად.",
      meta: "Skyrim Unbound. ყველა უფლება ეკუთვნის შესაბამის მფლობელებს.",
      legalLinks: ["გამოყენების პირობები", "კონფიდენციალურობა", "გადახდები"],
    },
    cookie: {
      notice: "საიტს შეუძლია დაიმახსოვროს შენი თანხმობა და ვიზუალური პარამეტრები შემდეგი ვიზიტებისთვის.",
      close: "დახურვა",
      allow: "დაშვება",
    },
    calendar: {
      closeLabel: "ღონისძიების დეტალების დახურვა",
      timeDisplayLabel: "კალენდრის დრო",
      gridLabel: "საზოგადოების ღონისძიებების კალენდარი",
      openLedger: "ჩანაწერის გახსნა",
      previous: "წინა",
      next: "შემდეგი",
      loading: "ღონისძიებები იტვირთება...",
      serverTime: "სერვერის დრო",
      localTime: "ლოკალური დრო",
      playerRequests: "მოთამაშეთა მოთხოვნები",
      requestEvent: "ღონისძიების მოთხოვნა",
      signInRequestEvent: "შედი მოთხოვნის გასახსნელად",
      openEventRequest: "ღონისძიების მოთხოვნის გახსნა",
      ticketType: "ტიკეტის ტიპი",
      eventRequest: "ღონისძიების მოთხოვნა",
      supportQuestion: "გჭირდება გუნდის პირდაპირი დახმარება ამ მოთხოვნაზე?",
      supportQuestionAria: "გჭირდება გუნდის პირდაპირი დახმარება ამ მოთხოვნაზე?",
      no: "არა",
      yes: "დიახ",
      subject: "თემა",
      details: "დეტალები",
      openTicket: "ტიკეტის გახსნა",
      cancel: "გაუქმება",
      markInterested: "ინტერესის მონიშვნა",
      removeInterest: "ინტერესის მოხსნა",
      signInInterest: "შედი ინტერესის მოსანიშნად",
      eventStarted: "ღონისძიება დაწყებულია",
      cancelled: "გაუქმებულია",
      noDescription: "აღწერა ჯერ არ არის.",
      interestCount: "დაინტერესებული: {count}",
      listedCount: "{count} ჩანაწერი",
      noEvents: "ღონისძიებები არ არის",
      noEventsForMonth: "{month}-ში საზოგადოების ღონისძიება ჯერ არ არის დაგეგმილი.",
      noEventsForDate: "ამ თარიღზე ღონისძიება არ არის მითითებული.",
      quietMonth: "კალენდარი მზად არის, სანამ შემდეგი ბაზარი, საბჭო, სასამართლო სცენა ან საზოგადოების საღამო დაიგეგმება.",
      quietDate: "თუ ამ დღეზე რამე გსურს ან დახმარება გჭირდება, გახსენი ტიკეტი და გუნდი UCP-დან დაგიკავშირდება.",
      ledgerIntro: "კალენდარი გვერდით დგას, სანამ მისი გახსნა დაგჭირდება. აირჩიე ჩანაწერი და ნახე დეტალები.",
      monthMetaLede: "{count} ჩანაწერი",
      dateSelectUpcoming: "{date}-ზე დაგეგმილია: {count}. აირჩიე ჩანაწერი სრული აღწერისთვის.",
      dateSelectListed: "{date}-ზე მითითებულია: {count}. აირჩიე ჩანაწერი სრული აღწერისთვის.",
      createdBy: "შემქმნელი: {name}",
      dateSelected: "არჩეული თარიღი",
      weekdayLabels: ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
      eventStatus: {
        SCHEDULED: "დაგეგმილია",
        CANCELLED: "გაუქმებულია",
        COMPLETED: "დასრულებულია",
      },
      timeMeta: {
        showingHost: "ნაჩვენებია სერვერის დრო.",
        showingLocal: "ნაჩვენებია შენი ბრაუზერის დრო.",
        hostMatches: "სერვერი {offset}. შენი ბრაუზერის დრო ამ თვეში ემთხვევა.",
        hostBehind: "სერვერი {offset}. ამ თვეში შენ {difference}-ით უკან ხარ.",
        hostAhead: "სერვერი {offset}. ამ თვეში შენ {difference}-ით წინ ხარ.",
      },
      heroAlert: {
        openNow: "ახლავე გახსნა",
        liveAria: "ახლა მიმდინარეობს: {title}",
        upcomingAria: "შემდეგ 24 საათში: {title}",
        liveKicker: "ახლა მიმდინარეობს",
        upcomingKicker: "შემდეგ 24 საათში",
        startedAt: "დაიწყო {time}",
        plusMore: "+{count} კიდევ",
        liveCopy: "ღონისძიება ცოტა ხნის წინ დაიწყო. გახსენი კალენდარი დეტალებისთვის.",
        liveCopyMore: "ღონისძიება ცოტა ხნის წინ დაიწყო. ამავე პერიოდში სხვა ღონისძიებებიც არის.",
        upcomingCopy: "ღონისძიება მალე იწყება. გახსენი კალენდარი დეტალებისთვის.",
        upcomingCopyMore: "ღონისძიება მალე იწყება. ამავე 24-საათიან პერიოდში სხვა ღონისძიებებიც არის.",
      },
      ticket: {
        introTitle: "ღონისძიების მოთხოვნა",
        introCopy: "გახსენი ტიკეტი საზოგადოების ღონისძიების მოთხოვნით. თუ პირდაპირი დახმარებაც გჭირდება, მონიშნე ფორმაში.",
        introCopySignedOut: "შედი ანგარიშში, რომ კალენდრიდან პირდაპირი ტიკეტი გახსნა.",
        formTitle: "ღონისძიების მოთხოვნის გახსნა",
        formNote: "ეს UCP-ში რეალურ ტიკეტს გახსნის, რომ გუნდმა მოთხოვნა განიხილოს.",
        placeholder: "აღწერე ღონისძიება, სასურველი თარიღი და საჭირო პერსონაჟის ან ფრაქციის კონტექსტი.",
        signInMessage: "შედი ანგარიშში, რომ კალენდრიდან ღონისძიების მოთხოვნა გახსნა.",
        defaultSubject: "ღონისძიების მოთხოვნა {date}-ისთვის",
        directSupport: "პირდაპირი დახმარება მოთხოვნილია: {value}\n\n{message}",
      },
      messages: {
        loadError: "ღონისძიებების ჩატვირთვა ვერ მოხერხდა.",
        interestAdded: "ინტერესი მონიშნულია.",
        interestRemoved: "ინტერესი მოხსნილია.",
        interestError: "ღონისძიების ინტერესის განახლება ვერ მოხერხდა.",
        signInCarry: "ჯერ შედი ანგარიშში და ინტერესის მონიშვნა შენს პროფილზე გადავა.",
        sessionExpiredInterest: "სესია ამოიწურა. ხელახლა შედი და ინტერესი გაგრძელდება.",
        pickDate: "ჯერ აირჩიე თარიღი, შემდეგ გახსენი მოთხოვნა.",
        addDetails: "დაამატე რამდენიმე დეტალი, რომ გუნდმა იცოდეს რა გჭირდება.",
        ticketOpened: "ტიკეტი გახსნილია. გუნდი UCP-დან დაგიკავშირდება.",
        ticketOpenedWithId: "ტიკეტი #{id} გახსნილია. გუნდი UCP-დან დაგიკავშირდება.",
        sessionExpiredTicket: "სესია ამოიწურა. ხელახლა შედი და ფორმა ისევ გაიხსნება.",
        ticketError: "ტიკეტის გახსნა ახლა ვერ მოხერხდა.",
      },
    },
    contactModal: {
      closeLabel: "კონტაქტის ფორმის დახურვა",
      title: "დაგვიკავშირდი",
      intro: "გამოგვიგზავნე შეტყობინება და მალე გიპასუხებთ.",
      name: "სახელი",
      email: "ელფოსტა",
      subject: "თემა",
      message: "შეტყობინება",
      yourName: "შენი სახელი",
      yourEmail: "your.email@example.com",
      about: "რას ეხება?",
      messagePlaceholder: "შენი შეტყობინება...",
      loadingVerification: "შემოწმება იტვირთება...",
      sendMessage: "შეტყობინების გაგზავნა",
      mailto: {
        subjectPrefix: "[შემქმნელთა პროგრამა]",
        greeting: "გამარჯობა Skyrim Unbound-ის გუნდო,",
        interest: "მსურს ოფიციალური კონტენტის შემქმნელთა პროგრამაში მონაწილეობა.",
        labelName: "სახელი",
        labelEmail: "ელფოსტა",
        labelSubject: "თემა",
        labelMessage: "შეტყობინება",
      },
    },
    auth: {
      closeLabel: "შესვლის დახურვა",
      eyebrow: "ანგარიშზე წვდომა",
      title: "შედი გვერდიდან გაუსვლელად",
      intro: "გამოიყენე შენი UCP ანგარიში, რომ ღონისძიებებზე ინტერესი და წვდომა ერთ პროფილზე დარჩეს.",
      login: "მომხმარებლის სახელი ან ელფოსტა",
      password: "პაროლი",
      signIn: "შესვლა",
      createAccount: "ანგარიშის შექმნა",
      challengeDefault: "დაასრულე ამ შესვლის დარჩენილი შემოწმება.",
      challengeEmail: "შეიყვანე {email}-ზე გაგზავნილი 6-ნიშნა კოდი.",
      challengeTotp: "შეიყვანე აპლიკაციის მიმდინარე 6-ნიშნა კოდი.",
      emailOtp: "ელფოსტის კოდი",
      emailOtpPlaceholder: "6-ნიშნა ელფოსტის კოდი",
      totpCode: "აპლიკაციის კოდი",
      totpPlaceholder: "6-ნიშნა აპლიკაციის კოდი",
      verifyContinue: "შემოწმება და გაგრძელება",
      cancel: "გაუქმება",
      sessionExpired: "სესია ამოიწურა. გასაგრძელებლად ხელახლა შედი.",
      welcomeBack: "კეთილი დაბრუნება, {username}.",
      primaryAccepted: "პაროლი მიღებულია. დაასრულე დარჩენილი შემოწმება.",
      signInError: "ახლა შესვლა ვერ მოხერხდა.",
      verificationFailed: "შემოწმება ვერ მოხერხდა.",
    },
  };

  COMPLETION_OVERRIDES.ge = mergeTranslationBranch(COMPLETION_OVERRIDES.ge || {}, GE_CLEANUP);

  const TR_CLEANUP = {
    meta: {
      title: "Skyrim Unbound",
      description:
        "Skyrim Unbound, kalıcı karakterlere, ekip tarafından incelenen girişe ve uzun metinli hikayelere odaklanan Skyrim rol yapma sunucusudur.",
    },
    language: {
      select: "Dil seç",
      selector: "Dil seçici",
    },
    nav: {
      primary: "Birincil gezinme",
      home: "Ana Sayfa",
      join: "Nasıl Katılınır",
      world: "Neden Biz",
      community: "Topluluk",
      media: "Medya",
      events: "Etkinlikler",
      contact: "İletişim",
    },
    account: {
      defaultName: "Hesap",
      logOut: "Çıkış Yap",
      openUcp: "UCP'yi Aç",
      signIn: "Giriş Yap",
      install: "İndir ve kur",
    },
    hero: {
      title: "Skyrim Unbound",
      lede:
        "Kalıcı karakterler, başvuru ile giriş ve metin odaklı hikayeler üzerine kurulu katı bir Skyrim rol yapma sunucusu.",
      createAccount: "Hesap Oluştur",
      joinDiscord: "Discord'a Katıl",
      calendarEyebrow: "Topluluk Etkinlikleri",
      calendarIntro:
        "Fraksiyon toplantıları, çatışma geceleri, duruşmalar ve sunucu etkinlikleri için sade bir takvim.",
      openCalendar: "Etkinlik Takvimini Aç",
      trailerTitle: "Skyrim Unbound Yakında",
      trailerSubtitle: "Mevcut önizleme",
      worldTitle: "Katı Rol Yapma Deneyimi",
      features: [
        {
          title: "Odaklı evren gelişimi",
          body: "Hikayeler, etkinlikler ve bölgesel gerilimler Skyrim atmosferine bağlı kalır.",
        },
        {
          title: "Oyuncuların yönettiği dünya",
          body: "Ekonomi, evler ve işletmeler oyuncular tarafından sahiplenilir, korunur ve şekillendirilir.",
        },
        {
          title: "Resmi ve bağımsız fraksiyonlar",
          body: "Tanınan güçler ve yeni gruplar kimlik, etki ve avantaj kazanabilir.",
        },
        {
          title: "Bölgeler ve siyaset",
          body: "Yerel kararlar, siyasi çatışmalar ve fraksiyon bölgeleri daha geniş sonuçlar doğurabilir.",
        },
        {
          title: "Gerçek sonuçlar",
          body: "Karakterinin eylemleri itibarını, güveni, erişimi ve sonraki sahneleri etkileyebilir.",
        },
        {
          title: "Her oyun tarzına yer",
          body: "Sert dünyada bile sakin, yasal, sosyal ve yavaş ilerleyen karakterler önemlidir.",
        },
        {
          title: "Düzenli güncellemeler",
          body: "Deneyimi geliştirmek için düzenli iyileştirmeler ve yeni özellikler eklenir.",
        },
        {
          title: "Katı rol yapma",
          body: "Gerçekçi karakter gelişimi, kurallar ve metinli sahne anlatımı merkezdedir.",
        },
        {
          title: "Deneyimli ekip",
          body: "Ekip kaliteyi, düzeni ve adil incelemeyi korumaya odaklanır.",
        },
      ],
    },
    join: {
      title: "Nasıl Katılınır",
      intro: "Hesabını oluştur, başvurunu gönder, istemciyi kur ve dünyaya gir.",
      steps: [
        {
          title: "UCP hesabını oluştur",
          body: "Hesabını aç, güvenceye al ve karakterlerin için kullanacağın profili hazırla.",
          cta: "Hesap oluştur",
        },
        {
          title: "Giriş başvurunu gönder",
          body: "Rol yapma sorularını yanıtla, karakter geçmişini tamamla ve ekip incelemesini bekle.",
          cta: "Başvuruyu başlat",
        },
        {
          title: "İstemciyi kur",
          body: "Başlatıcı paketini indir ve desteklenen istemci kurulumu ile sunucuya bağlan.",
          cta: "Başlatıcıyı aç",
        },
        {
          title: "Dünyaya gir",
          body: "Karakterini seç, dünyaya adım at ve zamanla kalıcı olacak bir hikaye kur.",
          cta: "Karakterleri yönet",
        },
      ],
    },
    community: {
      titleHtml: "<span>Topluluğumuza</span> Katıl",
      intro: "Diğer oyuncularla tanış, hikayeler paylaş ve gelişmelerden haberdar ol.",
      cards: [
        {
          titleHtml: "Discord Topluluğu <span aria-hidden=\"true\">&#8599;</span>",
          bodyHtml:
            "Discord sunucumuzda <strong data-discord-member-copy>Live</strong> üye var. Destek, duyurular ve etkinlikler burada.",
          cta: "Discord'a Katıl",
          stats: [
            { value: "Live", label: "Üye" },
            { value: "Checking", label: "Çevrimiçi" },
          ],
        },
        {
          titleHtml: "Resmi Forum <span aria-hidden=\"true\">&#10022;</span>",
          bodyHtml: "Resmi forum hazırlanıyor. Şimdilik ana topluluk alanı Discord.",
          cta: "Yakında",
          stats: [
            { value: "Soon", label: "Forum" },
            { value: "Discord", label: "Şimdi aktif" },
          ],
        },
      ],
    },
    media: {
      title: "Topluluk Vitrini",
      intro: "Sunucu içinden yakalanan ve dünya ilerledikçe değişen anlar.",
      labels: [
        "İlk vitrin görselini göster",
        "İkinci vitrin görselini göster",
        "Üçüncü vitrin görselini göster",
      ],
    },
    contact: {
      eyebrow: "İçerik Üretici Programı",
      title: "Resmi sunucu içerik üreticisi ol",
      body:
        "Etkinlikleri, karakterleri, fraksiyon hikayelerini ve günlük sahneleri göstermek isteyen üreticiler arıyoruz.",
      cta: "Bize ulaş",
    },
    youtube: {
      text: "Sunucu videoları, topluluk içerikleri ve güncellemeler için YouTube kanalımıza abone ol.",
      cta: "YouTube'a git",
    },
    footer: {
      legalTitle: "Haklar ve Uyarı",
      legalBody:
        "Skyrim Unbound, The Elder Scrolls V: Skyrim için bağımsız bir rol yapma projesidir ve Bethesda Softworks, Bethesda Game Studios, ZeniMax Media, Microsoft veya diğer hak sahipleriyle bağlantılı değildir.",
      quickLinksTitle: "Hızlı Bağlantılar",
      quickLinks: ["Ana Sayfa", "Nasıl Katılınır", "Neden Biz", "Topluluk", "Etkinlikler", "UCP", "Başlatıcı"],
      poweredTitle: "SkyMP ile çalışır",
      poweredHtml:
        "Kalıcı çok oyunculu Skyrim deneyimini desteklemek için <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> üzerine inşa edildi.",
      meta: "Skyrim Unbound. Tüm haklar ilgili sahiplerine aittir.",
      legalLinks: ["Kullanım Şartları", "Gizlilik", "Ödemeler"],
    },
  };

  COMPLETION_OVERRIDES.tr = mergeTranslationBranch(COMPLETION_OVERRIDES.tr || {}, TR_CLEANUP);

  const ES_CLEANUP = {
    meta: {
      title: "Skyrim Unbound",
      description:
        "Skyrim Unbound es un servidor de juego de rol en Skyrim con personajes persistentes, entrada revisada por el equipo e historias largas por texto.",
    },
    language: {
      select: "Seleccionar idioma",
      selector: "Selector de idioma",
    },
    nav: {
      primary: "Navegación principal",
      home: "Inicio",
      join: "Cómo unirse",
      world: "Por qué nosotros",
      community: "Comunidad",
      media: "Medios",
      events: "Eventos",
      contact: "Contacto",
    },
    account: {
      defaultName: "Cuenta",
      logOut: "Cerrar sesión",
      openUcp: "Abrir UCP",
      signIn: "Iniciar sesión",
      install: "Descargar e instalar",
    },
    hero: {
      title: "Skyrim Unbound",
      lede:
        "Un servidor estricto de juego de rol en Skyrim, con personajes persistentes, solicitud de acceso e historias centradas en texto.",
      createAccount: "Crear cuenta",
      joinDiscord: "Unirse a Discord",
      calendarEyebrow: "Eventos de la comunidad",
      calendarIntro:
        "Reuniones de facción, noches de conflicto, audiencias y eventos del servidor en un calendario sencillo.",
      openCalendar: "Abrir calendario",
      trailerTitle: "Skyrim Unbound próximamente",
      trailerSubtitle: "Vista previa actual",
      worldTitle: "Experiencia de Juego de Rol Estricto",
      features: [
        {
          title: "Desarrollo de mundo enfocado",
          body: "Las historias, eventos y tensiones regionales se mantienen fieles a Skyrim y crecen con intención.",
        },
        {
          title: "Un mundo dirigido por jugadores",
          body: "La economía, las viviendas y los negocios se poseen, defienden y moldean por las acciones de los jugadores.",
        },
        {
          title: "Facciones oficiales e independientes",
          body: "Los poderes reconocidos y los grupos nuevos pueden construir identidad, influencia y ventajas reales.",
        },
        {
          title: "Territorios y política",
          body: "Las decisiones locales, los territorios y los conflictos políticos pueden tener consecuencias más amplias.",
        },
        {
          title: "Consecuencias reales",
          body: "Las acciones de tu personaje pueden cambiar reputación, confianza, acceso y futuras escenas.",
        },
        {
          title: "Espacio para cada estilo",
          body: "También hay lugar para personajes tranquilos, legales, sociales y de desarrollo lento.",
        },
        {
          title: "Actualizaciones regulares",
          body: "El servidor mejora de forma constante con nuevas funciones y ajustes de experiencia.",
        },
        {
          title: "Juego de rol estricto",
          body: "El foco está en personajes realistas, reglas claras y escenas narradas por texto.",
        },
        {
          title: "Equipo experimentado",
          body: "El equipo cuida la calidad, el orden y una revisión justa de cada caso.",
        },
      ],
    },
    join: {
      title: "Cómo unirse",
      intro: "Crea tu cuenta, envía tu solicitud de acceso, instala el cliente y entra al mundo.",
      steps: [
        {
          title: "Crea tu cuenta UCP",
          body: "Abre tu cuenta, protégela y prepara el perfil que usarás para tus personajes.",
          cta: "Crear cuenta",
        },
        {
          title: "Envía tu solicitud de acceso",
          body: "Responde las preguntas de rol, completa la historia de tu personaje y espera la revisión del equipo.",
          cta: "Iniciar solicitud",
        },
        {
          title: "Instala el cliente",
          body: "Descarga el paquete de inicio y conéctate al servidor con la configuración compatible.",
          cta: "Abrir iniciador",
        },
        {
          title: "Entra al mundo",
          body: "Elige tu personaje, entra al mundo y empieza una historia que permanecerá con el tiempo.",
          cta: "Gestionar personajes",
        },
      ],
    },
    community: {
      titleHtml: "Únete a nuestra <span>comunidad</span>",
      intro: "Conoce a otros jugadores, comparte historias y mantente al día.",
      cards: [
        {
          titleHtml: "Comunidad de Discord <span aria-hidden=\"true\">&#8599;</span>",
          bodyHtml:
            "Nuestro servidor de Discord tiene <strong data-discord-member-copy>Live</strong> miembros. Soporte, anuncios y eventos están allí.",
          cta: "Unirse a Discord",
          stats: [
            { value: "Live", label: "Miembros" },
            { value: "Checking", label: "En línea" },
          ],
        },
        {
          titleHtml: "Foro oficial <span aria-hidden=\"true\">&#10022;</span>",
          bodyHtml: "El foro oficial está en preparación. Por ahora, Discord es el espacio principal de la comunidad.",
          cta: "Próximamente",
          stats: [
            { value: "Soon", label: "Foro" },
            { value: "Discord", label: "Activo ahora" },
          ],
        },
      ],
    },
    media: {
      title: "Galería de la comunidad",
      intro: "Momentos capturados dentro del servidor mientras el mundo sigue avanzando.",
      labels: [
        "Mostrar la primera imagen",
        "Mostrar la segunda imagen",
        "Mostrar la tercera imagen",
      ],
    },
    contact: {
      eyebrow: "Programa de creadores",
      title: "Conviértete en creador oficial del servidor",
      body:
        "Buscamos creadores que quieran mostrar eventos, personajes, historias de facción y escenas cotidianas.",
      cta: "Contáctanos",
    },
    youtube: {
      text: "Suscríbete a nuestro canal de YouTube para videos del servidor, contenido de la comunidad y novedades.",
      cta: "Ir a YouTube",
    },
    footer: {
      legalTitle: "Derechos y aviso",
      legalBody:
        "Skyrim Unbound es un proyecto independiente de juego de rol para The Elder Scrolls V: Skyrim y no está afiliado ni respaldado por Bethesda Softworks, Bethesda Game Studios, ZeniMax Media, Microsoft u otros titulares de derechos.",
      quickLinksTitle: "Enlaces rápidos",
      quickLinks: ["Inicio", "Cómo unirse", "Por qué nosotros", "Comunidad", "Eventos", "UCP", "Iniciador"],
      poweredTitle: "Funciona con SkyMP",
      poweredHtml:
        "Creado con <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> para sostener una experiencia multijugador persistente en Skyrim.",
      meta: "Skyrim Unbound. Todos los derechos pertenecen a sus respectivos propietarios.",
      legalLinks: ["Términos de uso", "Privacidad", "Pagos"],
    },
  };

  COMPLETION_OVERRIDES.es = mergeTranslationBranch(COMPLETION_OVERRIDES.es || {}, ES_CLEANUP);

  const RU_CLEANUP = {
    meta: {
      title: "Skyrim Unbound",
      description:
        "Skyrim Unbound — строгий ролевой сервер по Skyrim с постоянными персонажами, заявкой на доступ и длинными текстовыми историями.",
    },
    language: {
      select: "Выбрать язык",
      selector: "Выбор языка",
    },
    nav: {
      primary: "Основная навигация",
      home: "Главная",
      join: "Как вступить",
      world: "Почему мы",
      community: "Сообщество",
      media: "Медиа",
      events: "События",
      contact: "Контакты",
    },
    account: {
      defaultName: "Аккаунт",
      logOut: "Выйти",
      openUcp: "Открыть UCP",
      signIn: "Войти",
      install: "Скачать и установить",
    },
    hero: {
      title: "Skyrim Unbound",
      lede:
        "Строгий ролевой сервер по Skyrim с постоянными персонажами, заявкой на доступ и упором на текстовые истории.",
      createAccount: "Создать аккаунт",
      joinDiscord: "Вступить в Discord",
      calendarEyebrow: "События сообщества",
      calendarIntro:
        "Собрания фракций, ночи конфликтов, судебные сцены и серверные события в спокойном календаре.",
      openCalendar: "Открыть календарь",
      trailerTitle: "Skyrim Unbound скоро выйдет",
      trailerSubtitle: "Текущий предварительный просмотр",
      worldTitle: "Строгой Ролевой Игры",
      features: [
        {
          title: "Продуманное развитие мира",
          body: "Сюжеты, события и региональное напряжение остаются верны атмосфере Skyrim и развиваются осмысленно.",
        },
        {
          title: "Мир в руках игроков",
          body: "Экономика, дома и дела принадлежат игрокам, защищаются ими и меняются из-за их решений.",
        },
        {
          title: "Официальные и независимые фракции",
          body: "Признанные силы и новые группы могут строить личность, влияние и реальные преимущества.",
        },
        {
          title: "Территории и политика",
          body: "Локальные решения, территории и политические конфликты могут иметь широкие последствия.",
        },
        {
          title: "Реальные последствия",
          body: "Поступки персонажа могут менять репутацию, доверие, доступ и будущие сцены.",
        },
        {
          title: "Место для любого стиля",
          body: "В суровом мире есть место и спокойным, законным, социальным, медленным историям.",
        },
        {
          title: "Регулярные обновления",
          body: "Сервер постоянно улучшается новыми функциями и настройками опыта.",
        },
        {
          title: "Строгая ролевая игра",
          body: "В центре реалистичные персонажи, ясные правила и текстовые сцены.",
        },
        {
          title: "Опытная команда",
          body: "Команда следит за качеством, порядком и справедливым рассмотрением заявок.",
        },
      ],
    },
    join: {
      title: "Как вступить",
      intro: "Создайте аккаунт, отправьте заявку на доступ, установите клиент и войдите в мир.",
      steps: [
        {
          title: "Создайте аккаунт UCP",
          body: "Откройте аккаунт, защитите его и подготовьте профиль для ваших персонажей.",
          cta: "Создать аккаунт",
        },
        {
          title: "Отправьте заявку на доступ",
          body: "Ответьте на вопросы по ролевой игре, завершите историю персонажа и дождитесь проверки команды.",
          cta: "Начать заявку",
        },
        {
          title: "Установите клиент",
          body: "Скачайте пакет запуска и подключитесь к серверу через поддерживаемую настройку клиента.",
          cta: "Открыть запуск",
        },
        {
          title: "Войдите в мир",
          body: "Выберите персонажа, войдите в мир и начните историю, которая сохранится со временем.",
          cta: "Управлять персонажами",
        },
      ],
    },
    community: {
      titleHtml: "Присоединяйтесь к нашему <span>сообществу</span>",
      intro: "Знакомьтесь с другими игроками, делитесь историями и следите за новостями.",
      cards: [
        {
          titleHtml: "Сообщество Discord <span aria-hidden=\"true\">&#8599;</span>",
          bodyHtml:
            "На нашем Discord-сервере <strong data-discord-member-copy>Live</strong> участников. Поддержка, объявления и события находятся там.",
          cta: "Вступить в Discord",
          stats: [
            { value: "Live", label: "Участники" },
            { value: "Checking", label: "Онлайн" },
          ],
        },
        {
          titleHtml: "Официальный форум <span aria-hidden=\"true\">&#10022;</span>",
          bodyHtml: "Официальный форум готовится. Пока основная площадка сообщества — Discord.",
          cta: "Скоро",
          stats: [
            { value: "Soon", label: "Форум" },
            { value: "Discord", label: "Активен сейчас" },
          ],
        },
      ],
    },
    media: {
      title: "Галерея сообщества",
      intro: "Моменты с сервера, которые показывают, как развивается мир.",
      labels: [
        "Показать первое изображение",
        "Показать второе изображение",
        "Показать третье изображение",
      ],
    },
    contact: {
      eyebrow: "Программа создателей",
      title: "Станьте официальным создателем контента сервера",
      body:
        "Мы ищем авторов, которые хотят показывать события, персонажей, истории фракций и повседневные сцены.",
      cta: "Связаться с нами",
    },
    youtube: {
      text: "Подпишитесь на наш YouTube-канал, чтобы смотреть видео сервера, контент сообщества и обновления.",
      cta: "Перейти на YouTube",
    },
    footer: {
      legalTitle: "Права и уведомление",
      legalBody:
        "Skyrim Unbound — независимый ролевой проект для The Elder Scrolls V: Skyrim и не связан с Bethesda Softworks, Bethesda Game Studios, ZeniMax Media, Microsoft или другими правообладателями.",
      quickLinksTitle: "Быстрые ссылки",
      quickLinks: ["Главная", "Как вступить", "Почему мы", "Сообщество", "События", "UCP", "Запуск"],
      poweredTitle: "Работает на SkyMP",
      poweredHtml:
        "Создано на <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a> для поддержки постоянного многопользовательского опыта в Skyrim.",
      meta: "Skyrim Unbound. Все права принадлежат соответствующим владельцам.",
      legalLinks: ["Условия использования", "Конфиденциальность", "Платежи"],
    },
  };

  COMPLETION_OVERRIDES.ru = mergeTranslationBranch(COMPLETION_OVERRIDES.ru || {}, RU_CLEANUP);

  const DE_CLEANUP = {
    meta: {
      title: "Skyrim Unbound",
      description:
        "Skyrim Unbound ist ein strenger Skyrim-Rollenspielserver mit beständigen Charakteren, geprüfter Aufnahme und langen textbasierten Geschichten.",
    },
    language: {
      select: "Sprache auswählen",
      selector: "Sprachauswahl",
    },
    nav: {
      primary: "Hauptnavigation",
      home: "Startseite",
      join: "Mitmachen",
      world: "Warum wir",
      community: "Community",
      media: "Medien",
      events: "Events",
      contact: "Kontakt",
    },
    account: {
      defaultName: "Konto",
      logOut: "Abmelden",
      openUcp: "UCP öffnen",
      signIn: "Anmelden",
      install: "Herunterladen und installieren",
    },
    hero: {
      title: "Skyrim Unbound",
      lede:
        "Ein strenger Skyrim-Rollenspielserver mit beständigen Charakteren, Aufnahmebewerbung und Fokus auf textbasierte Geschichten.",
      createAccount: "Konto erstellen",
      joinDiscord: "Discord beitreten",
      calendarEyebrow: "Community-Events",
      calendarIntro:
        "Fraktionstreffen, Konfliktnächte, Gerichtsszenen und Serverevents in einem ruhigen Kalender.",
      openCalendar: "Eventkalender öffnen",
      trailerTitle: "Skyrim Unbound kommt bald",
      trailerSubtitle: "Aktuelle Vorschau",
      worldTitle: "Strenges Rollenspiel",
      features: [
        {
          title: "Gezielte Weltentwicklung",
          body: "Geschichten, Events und regionale Spannungen bleiben in Skyrim verankert und entwickeln sich mit Absicht.",
        },
        {
          title: "Eine Welt in Spielerhand",
          body: "Wirtschaft, Häuser und Geschäfte werden von Spielern besessen, verteidigt und geprägt.",
        },
        {
          title: "Offizielle und freie Fraktionen",
          body: "Anerkannte Mächte und neue Gruppen können Identität, Einfluss und echte Vorteile aufbauen.",
        },
        {
          title: "Gebiete und Politik",
          body: "Lokale Entscheidungen, Territorien und politische Konflikte können weitreichende Folgen haben.",
        },
        {
          title: "Echte Konsequenzen",
          body: "Die Taten deines Charakters können Ruf, Vertrauen, Zugang und spätere Szenen verändern.",
        },
        {
          title: "Raum für jeden Spielstil",
          body: "Auch ruhige, gesetzestreue, soziale und langsam aufgebaute Charaktere haben ihren Platz.",
        },
        {
          title: "Regelmäßige Updates",
          body: "Der Server wird stetig mit neuen Funktionen und Verbesserungen weiterentwickelt.",
        },
        {
          title: "Strenges Rollenspiel",
          body: "Realistische Charaktere, klare Regeln und textbasierte Szenen stehen im Mittelpunkt.",
        },
        {
          title: "Erfahrenes Team",
          body: "Das Team achtet auf Qualität, Ordnung und faire Prüfung jeder Anfrage.",
        },
      ],
    },
    join: {
      title: "So machst du mit",
      intro: "Erstelle dein Konto, sende deine Aufnahmebewerbung ab, installiere den Client und betrete die Welt.",
      steps: [
        {
          title: "UCP-Konto erstellen",
          body: "Erstelle und sichere dein Konto und bereite das Profil für deine Charaktere vor.",
          cta: "Konto erstellen",
        },
        {
          title: "Aufnahmebewerbung senden",
          body: "Beantworte die Rollenspielfragen, vervollständige die Hintergrundgeschichte und warte auf die Prüfung.",
          cta: "Bewerbung starten",
        },
        {
          title: "Client installieren",
          body: "Lade das Startpaket herunter und verbinde dich mit der unterstützten Client-Einrichtung.",
          cta: "Launcher öffnen",
        },
        {
          title: "Welt betreten",
          body: "Wähle deinen Charakter und beginne eine Geschichte, die über Zeit bestehen bleibt.",
          cta: "Charaktere verwalten",
        },
      ],
    },
    community: {
      titleHtml: "Tritt unserer <span>Community</span> bei",
      intro: "Lerne andere Spieler kennen, teile Geschichten und bleib auf dem Laufenden.",
      cards: [
        {
          titleHtml: "Discord-Community <span aria-hidden=\"true\">&#8599;</span>",
          bodyHtml:
            "Auf unserem Discord-Server sind <strong data-discord-member-copy>Live</strong> Mitglieder. Support, Ankündigungen und Events findest du dort.",
          cta: "Discord beitreten",
          stats: [
            { value: "Live", label: "Mitglieder" },
            { value: "Checking", label: "Online" },
          ],
        },
        {
          titleHtml: "Offizielles Forum <span aria-hidden=\"true\">&#10022;</span>",
          bodyHtml: "Das offizielle Forum wird vorbereitet. Bis dahin ist Discord der zentrale Ort der Community.",
          cta: "Bald verfügbar",
          stats: [
            { value: "Soon", label: "Forum" },
            { value: "Discord", label: "Jetzt aktiv" },
          ],
        },
      ],
    },
    media: {
      title: "Community-Galerie",
      intro: "Momente vom Server, die zeigen, wie sich die Welt weiterentwickelt.",
      labels: [
        "Erstes Bild anzeigen",
        "Zweites Bild anzeigen",
        "Drittes Bild anzeigen",
      ],
    },
    contact: {
      eyebrow: "Creator-Programm",
      title: "Werde offizieller Content Creator des Servers",
      body:
        "Wir suchen Creator, die Events, Charaktere, Fraktionsgeschichten und alltägliche Szenen zeigen möchten.",
      cta: "Kontakt aufnehmen",
    },
    youtube: {
      text: "Abonniere unseren YouTube-Kanal für Servervideos, Community-Inhalte und Updates.",
      cta: "Zu YouTube",
    },
    footer: {
      legalTitle: "Rechte und Hinweis",
      legalBody:
        "Skyrim Unbound ist ein unabhängiges Rollenspielprojekt für The Elder Scrolls V: Skyrim und steht nicht in Verbindung mit Bethesda Softworks, Bethesda Game Studios, ZeniMax Media, Microsoft oder anderen Rechteinhabern.",
      quickLinksTitle: "Schnellzugriff",
      quickLinks: ["Startseite", "Mitmachen", "Warum wir", "Community", "Events", "UCP", "Launcher"],
      poweredTitle: "Powered by SkyMP",
      poweredHtml:
        "Gebaut auf <a href=\"https://skymp.net/\" target=\"_blank\" rel=\"noreferrer\">SkyMP</a>, um ein beständiges Multiplayer-Erlebnis in Skyrim zu ermöglichen.",
      meta: "Skyrim Unbound. Alle Rechte gehören den jeweiligen Eigentümern.",
      legalLinks: ["Nutzungsbedingungen", "Datenschutz", "Zahlungen"],
    },
    cookie: {
      notice:
        "Diese Website kann deine Zustimmung und Anzeigeeinstellungen für spätere Besuche speichern.",
      close: "Schließen",
      allow: "Erlauben",
    },
    calendar: {
      closeLabel: "Eventdetails schließen",
      timeDisplayLabel: "Kalenderzeit",
      gridLabel: "Community-Eventkalender",
      openLedger: "Eintrag öffnen",
      previous: "Zurück",
      next: "Weiter",
      loading: "Events werden geladen...",
      serverTime: "Serverzeit",
      localTime: "Lokale Zeit",
      playerRequests: "Spieleranfragen",
      requestEvent: "Event anfragen",
      signInRequestEvent: "Zum Anfragen anmelden",
      openEventRequest: "Eventanfrage öffnen",
      ticketType: "Tickettyp",
      eventRequest: "Eventanfrage",
      supportQuestion: "Brauchst du direkte Hilfe des Teams für diese Anfrage?",
      supportQuestionAria: "Brauchst du direkte Hilfe des Teams für diese Anfrage?",
      no: "Nein",
      yes: "Ja",
      subject: "Betreff",
      details: "Details",
      openTicket: "Ticket öffnen",
      cancel: "Abbrechen",
      markInterested: "Interesse markieren",
      removeInterest: "Interesse entfernen",
      signInInterest: "Zum Markieren anmelden",
      eventStarted: "Event gestartet",
      cancelled: "Abgesagt",
      noDescription: "Noch keine Beschreibung.",
      interestCount: "Interessiert: {count}",
      listedCount: "{count} Einträge",
      noEvents: "Keine Events",
      noEventsForMonth: "Für {month} sind noch keine Community-Events geplant.",
      noEventsForDate: "Für dieses Datum sind keine Events eingetragen.",
      quietMonth: "Der Kalender bleibt bereit, bis das nächste Treffen, der nächste Rat oder ein Community-Abend geplant ist.",
      quietDate: "Wenn du an diesem Tag etwas planen möchtest, öffne ein Ticket und das Team meldet sich im UCP.",
      ledgerIntro: "Der Kalender bleibt im Hintergrund, bis du ihn brauchst. Öffne einen Eintrag, um die Details zu lesen.",
      monthMetaLede: "{count} Einträge",
      dateSelectUpcoming: "Geplant am {date}: {count}. Wähle unten einen Eintrag für die vollständige Beschreibung.",
      dateSelectListed: "Eingetragen am {date}: {count}. Wähle unten einen Eintrag für die vollständige Beschreibung.",
      createdBy: "Erstellt von {name}",
      dateSelected: "Ausgewähltes Datum",
      weekdayLabels: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
      eventStatus: {
        SCHEDULED: "GEPLANT",
        CANCELLED: "ABGESAGT",
        COMPLETED: "ABGESCHLOSSEN",
      },
      timeMeta: {
        showingHost: "Serverzeit wird angezeigt.",
        showingLocal: "Lokale Browserzeit wird angezeigt.",
        hostMatches: "Server {offset}. Deine Browserzeit stimmt diesen Monat überein.",
        hostBehind: "Server {offset}. Du bist diesen Monat {difference} hinter dem Server.",
        hostAhead: "Server {offset}. Du bist diesen Monat {difference} vor dem Server.",
      },
      heroAlert: {
        openNow: "Jetzt öffnen",
        liveAria: "Läuft gerade: {title}",
        upcomingAria: "Innerhalb der nächsten 24 Stunden: {title}",
        liveKicker: "Läuft gerade",
        upcomingKicker: "In den nächsten 24 Stunden",
        startedAt: "Begann {time}",
        plusMore: "+{count} weitere",
        liveCopy: "Dieses Event hat vor Kurzem begonnen. Öffne den Kalender für Details.",
        liveCopyMore: "Dieses Event hat vor Kurzem begonnen. Im selben Zeitraum sind weitere Events geplant.",
        upcomingCopy: "Dieses Event beginnt bald. Öffne den Kalender für Details.",
        upcomingCopyMore: "Dieses Event beginnt bald. Weitere Events liegen im selben 24-Stunden-Fenster.",
      },
      ticket: {
        introTitle: "Event anfragen",
        introCopy: "Öffne hier ein Ticket, um ein Community-Event anzufragen. Wenn du direkte Hilfe brauchst, markiere es im Formular.",
        introCopySignedOut: "Melde dich an, um aus dem Kalender ein direktes Ticket zu öffnen.",
        formTitle: "Eventanfrage öffnen",
        formNote: "Dies öffnet ein echtes Ticket im UCP, damit das Team deine Anfrage prüfen kann.",
        placeholder: "Beschreibe das gewünschte Event, das Datum und wichtigen Charakter- oder Fraktionskontext.",
        signInMessage: "Melde dich an, um aus dem Kalender eine Eventanfrage zu öffnen.",
        defaultSubject: "Eventanfrage für {date}",
        directSupport: "Direkte Hilfe angefragt: {value}\n\n{message}",
      },
      messages: {
        loadError: "Events konnten gerade nicht geladen werden.",
        interestAdded: "Interesse markiert.",
        interestRemoved: "Interesse entfernt.",
        interestError: "Eventinteresse konnte nicht aktualisiert werden.",
        signInCarry: "Melde dich zuerst an, dann wird dein Interesse deinem Konto zugeordnet.",
        sessionExpiredInterest: "Deine Sitzung ist abgelaufen. Melde dich erneut an.",
        pickDate: "Wähle zuerst ein Datum und öffne dann die Anfrage.",
        addDetails: "Füge ein paar Details hinzu, damit das Team weiß, was du brauchst.",
        ticketOpened: "Dein Ticket ist offen. Das Team kann nun im UCP antworten.",
        ticketOpenedWithId: "Ticket #{id} ist offen. Das Team kann nun im UCP antworten.",
        sessionExpiredTicket: "Deine Sitzung ist abgelaufen. Melde dich erneut an, dann öffnet sich das Formular wieder.",
        ticketError: "Ticket konnte gerade nicht geöffnet werden.",
      },
    },
    contactModal: {
      closeLabel: "Kontaktformular schließen",
      title: "Kontakt aufnehmen",
      intro: "Schick uns eine Nachricht und wir melden uns so bald wie möglich.",
      name: "Name",
      email: "E-Mail",
      subject: "Betreff",
      message: "Nachricht",
      yourName: "Dein Name",
      yourEmail: "deine.email@example.com",
      about: "Worum geht es?",
      messagePlaceholder: "Deine Nachricht...",
      loadingVerification: "Prüfung wird geladen...",
      sendMessage: "Nachricht senden",
      mailto: {
        subjectPrefix: "[Creator-Programm]",
        greeting: "Hallo Skyrim Unbound Team,",
        interest: "Ich möchte mich für das offizielle Content-Creator-Programm bewerben.",
        labelName: "Name",
        labelEmail: "E-Mail",
        labelSubject: "Betreff",
        labelMessage: "Nachricht",
      },
    },
    auth: {
      closeLabel: "Anmeldung schließen",
      eyebrow: "Kontozugriff",
      title: "Anmelden, ohne die Seite zu verlassen",
      intro: "Nutze dein UCP-Konto, damit Eventinteresse und Zugriff mit demselben Profil verbunden bleiben.",
      login: "Benutzername oder E-Mail",
      password: "Passwort",
      signIn: "Anmelden",
      createAccount: "Konto erstellen",
      challengeDefault: "Schließe die verbleibenden Prüfschritte für diese Anmeldung ab.",
      challengeEmail: "Gib den 6-stelligen Code ein, der an {email} gesendet wurde.",
      challengeTotp: "Gib den aktuellen 6-stelligen Code deiner Authenticator-App ein.",
      emailOtp: "E-Mail-Code",
      emailOtpPlaceholder: "6-stelliger E-Mail-Code",
      totpCode: "Authenticator-Code",
      totpPlaceholder: "6-stelliger Authenticator-Code",
      verifyContinue: "Prüfen und fortfahren",
      cancel: "Abbrechen",
      sessionExpired: "Sitzung abgelaufen. Melde dich erneut an.",
      welcomeBack: "Willkommen zurück, {username}.",
      primaryAccepted: "Passwort akzeptiert. Schließe die restliche Prüfung ab.",
      signInError: "Anmeldung ist gerade nicht möglich.",
      verificationFailed: "Prüfung fehlgeschlagen.",
    },
  };

  COMPLETION_OVERRIDES.de = mergeTranslationBranch(COMPLETION_OVERRIDES.de || {}, DE_CLEANUP);

  Object.keys(COMPLETION_OVERRIDES).forEach((language) => {
    OVERRIDES[language] = mergeTranslationBranch(OVERRIDES[language] || {}, COMPLETION_OVERRIDES[language]);
  });

  function getValue(source, path) {
    return String(path || "")
      .split(".")
      .reduce((current, segment) => (current && Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : undefined), source);
  }

  function format(template, params) {
    return String(template || "").replace(/\{(\w+)\}/g, (_match, name) => {
      return Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params[name]) : "";
    });
  }

  function get(path, language) {
    const normalizedLanguage = String(language || "en").toLowerCase();
    const fallbackValue = getValue(EN, path);
    const overrideValue = normalizedLanguage === "en" ? fallbackValue : getValue(OVERRIDES[normalizedLanguage] || {}, path);
    return overrideValue === undefined ? fallbackValue : overrideValue;
  }

  function t(language, path, params) {
    const value = get(path, language);
    return typeof value === "string" ? format(value, params || {}) : value;
  }

  window.SKYRIM_UNBOUND_I18N = {
    STORAGE_KEY,
    LANGUAGE_OPTIONS,
    get,
    t,
  };
})();
