
const app = {
    data: {
        depenses: [],
        revenus: [],
        suiviPEA: [],
        patrimoine: [],
        categoriesEpargne: ['ÉPARGNE'],
        budgets: {
            BAR: 50,
            CIGARETTE: 20,
            VETEMENT: 100,
            LOISIR: 200,
            MANGER: 300,
            CARBU: 150,
            AUTRE: 50,
            'ÉPARGNE': 0
        },
        comptes: ['Livret A', 'Livret Jeune', 'PEA', 'CTO'],
        comptesLiquides: ['Livret A', 'Livret Jeune'],
        comptesPointage: [],
        modeles: [],
        scenarios: [],
        objectifs: [],
        recurrences: [],
        abonnements: [],
        notes: [],
        lignesPEA: [],
        allocationCible: {},
        classif503020: {},
        catEmojis: {},
        parametres: {
            theme: 'auto',
            lastBackup: null,
            googleSheetsUrl: '',
            salaire: 0
        }
    },
    charts: {},
    confirmCallback: null,
    inputCallback: null,
    showMoreState: {
        depenses: false,
        pea: false,
        patrimoine: false
    },

    async init() {

        this._showLoader();
        const isAuth = await this._checkAuth();
        this._hideLoader();

        if (!isAuth) {
            this._showAuthScreen();
            return;
        }

        this._updateUserBadge();

        this._showLoader();
        await this.load();
        this._hideLoader();
        this._initApp();
    },

    _showAuthScreen() {
        const s = document.getElementById('auth-screen');
        if (s) s.style.display = 'flex';
    },

    _hideAuthScreen() {
        const s = document.getElementById('auth-screen');
        if (s) s.style.display = 'none';
    },

    showLogin() {
        this._auth.mode = 'login';
        document.getElementById('auth-subtitle').textContent = 'Connectez-vous pour accéder à vos données';
        document.getElementById('auth-submit').textContent = 'Se connecter';
        document.getElementById('auth-password2').style.display = 'none';
        document.getElementById('auth-switch-login').style.display = 'block';
        document.getElementById('auth-switch-signup').style.display = 'none';
        document.getElementById('auth-error').style.display = 'none';
        document.getElementById('auth-success').style.display = 'none';
    },

    showSignup() {
        this._auth.mode = 'signup';
        document.getElementById('auth-subtitle').textContent = 'Créez votre compte gratuitement';
        document.getElementById('auth-submit').textContent = "S'inscrire";
        document.getElementById('auth-password2').style.display = 'block';
        document.getElementById('auth-switch-login').style.display = 'none';
        document.getElementById('auth-switch-signup').style.display = 'block';
        document.getElementById('auth-error').style.display = 'none';
        document.getElementById('auth-success').style.display = 'none';
    },

    _setAuthError(msg) {
        const el = document.getElementById('auth-error');
        el.textContent = msg; el.style.display = 'block';
        document.getElementById('auth-success').style.display = 'none';
    },

    _setAuthSuccess(msg) {
        const el = document.getElementById('auth-success');
        el.textContent = msg; el.style.display = 'block';
        document.getElementById('auth-error').style.display = 'none';
    },

    async authSubmit() {
        const btn = document.getElementById('auth-submit');
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const password2 = document.getElementById('auth-password2').value;

        if (!email || !password) { this._setAuthError('Veuillez remplir tous les champs.'); return; }

        btn.disabled = true;
        btn.textContent = '⏳ Chargement…';

        try {
            if (this._auth.mode === 'signup') {
                if (password !== password2) { this._setAuthError('Les mots de passe ne correspondent pas.'); btn.disabled = false; btn.textContent = "S'inscrire"; return; }
                if (password.length < 6) { this._setAuthError('Le mot de passe doit faire au moins 6 caractères.'); btn.disabled = false; btn.textContent = "S'inscrire"; return; }
                await this._signUp(email, password);
            } else {
                await this._signIn(email, password);
                this._hideAuthScreen();
                this._updateUserBadge();
                this._showLoader();
                await this.load();
                this._hideLoader();
                this._initApp();
            }
        } catch(e) {
            this._setAuthError(e.message);
            btn.disabled = false;
            btn.textContent = this._auth.mode === 'signup' ? "S'inscrire" : 'Se connecter';
        }
    },

    async _signIn(email, password) {
        const { url, key } = this._sb;
        const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error_description || data.msg || 'Email ou mot de passe incorrect');
        this._auth.user = data.user;
        this._auth.token = data.access_token;
        this._auth.refreshToken = data.refresh_token;
        localStorage.setItem('sb_session', JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }));
    },

    async _signUp(email, password) {
        const { url, key } = this._sb;
        const r = await fetch(`${url}/auth/v1/signup`, {
            method: 'POST',
            headers: { 'apikey': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error_description || data.msg || "Inscription échouée");

        if (data.access_token) {
            this._auth.user = data.user;
            this._auth.token = data.access_token;
            this._auth.refreshToken = data.refresh_token;
            localStorage.setItem('sb_session', JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }));
            this._hideAuthScreen();
            this._updateUserBadge();
            this._showLoader();
            await this.load();
            this._hideLoader();
            this._initApp();
        } else {
            this._setAuthSuccess('✅ Compte créé ! Vérifiez votre email pour confirmer votre inscription.');
            document.getElementById('auth-submit').disabled = false;
            document.getElementById('auth-submit').textContent = "S'inscrire";
        }
    },

    async _checkAuth() {
        const stored = localStorage.getItem('sb_session');
        if (!stored) return false;
        try {
            const session = JSON.parse(stored);
            const { url, key } = this._sb;

            const r = await fetch(`${url}/auth/v1/user`, {
                headers: { 'apikey': key, 'Authorization': `Bearer ${session.access_token}` }
            });
            if (r.ok) {
                const user = await r.json();
                this._auth.user = user;
                this._auth.token = session.access_token;
                this._auth.refreshToken = session.refresh_token;
                return true;
            }

            if (session.refresh_token) {
                const rr = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
                    method: 'POST',
                    headers: { 'apikey': key, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: session.refresh_token })
                });
                if (rr.ok) {
                    const data = await rr.json();
                    this._auth.user = data.user;
                    this._auth.token = data.access_token;
                    this._auth.refreshToken = data.refresh_token;
                    localStorage.setItem('sb_session', JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }));
                    return true;
                }
            }
        } catch(e) { console.warn('Auth check failed:', e); }
        localStorage.removeItem('sb_session');
        return false;
    },

    async signOut() {
        try {
            const { url, key } = this._sb;
            await fetch(`${url}/auth/v1/logout`, {
                method: 'POST',
                headers: { 'apikey': key, 'Authorization': `Bearer ${this._auth.token}` }
            });
        } catch(e) {}
        this._auth = { user: null, token: null, refreshToken: null, mode: 'login' };
        localStorage.removeItem('sb_session');
        localStorage.removeItem('suiviFinancier');
        localStorage.removeItem('suiviFinancierTime');
        location.reload();
    },

    _updateUserBadge() {
        const email = this._auth.user?.email || '';
        const initial = email ? email[0].toUpperCase() : '?';
        const avatarEl = document.getElementById('user-avatar');
        const settingsAvatar = document.getElementById('settings-avatar');
        const settingsEmail = document.getElementById('settings-email');
        if (avatarEl) avatarEl.textContent = initial;
        if (settingsAvatar) settingsAvatar.textContent = initial;
        if (settingsEmail) settingsEmail.textContent = email;
    },

    _initApp() {

        const wrapper = document.getElementById('zoom-wrapper');
        if (wrapper) wrapper.style.display = '';
        this.initDates();
        this._initBudgetMonthLabel();
        this.applyTheme();
        if (this.data.parametres.zoom) this.setZoom(this.data.parametres.zoom);
        this.genererLignes();
        this.updateBudgetsUI();
        this.updateComptesUI();
        this.updateCategoriesSelects();
        this.updateModelesSelect();
        this.updateScenariosSelect();
        this.checkBackupReminder();
        this.refresh();
        document.getElementById('overlay').onclick = () => {
            if (document.getElementById('settings').classList.contains('open')) {
                this.toggleSettings();
            }
            if (document.getElementById('confirmModal').classList.contains('active')) {
                this.closeModal();
            }
            if (document.getElementById('inputModal').classList.contains('active')) {
                this.closeInputModal();
            }
            if (document.getElementById('budgetsModal').classList.contains('active')) {
                this.closeBudgetsModal();
            }
            if (document.getElementById('comptesModal').classList.contains('active')) {
                this.closeComptesModal();
            }
        };
        document.getElementById('analyse-periode').onchange = () => this.toggleAnalyseFilters();
        this.initEmojiPicker();
        this.refreshObjectifs();
        this.refreshNotes();
        this.refreshRecurrences();
        this.refreshLignesPEA();
        this.refreshHeatmap();
        this.checkResumeHebdo();
        if (this.data.objectifs.length === 0 && !localStorage.getItem('suiviFinancier')) {
            this.chargerDonneesExemple();
        }

        // Onboarding premier lancement
        if (!localStorage.getItem('vault_ob_done')) {
            setTimeout(() => this._startOnboarding(), 900);
        }

        // Système popup unifié
        this._initVaultPopups();
        // Fermeture dropdowns budget au clic extérieur
        document.addEventListener('click', e => {
            const depWrap = document.getElementById('budget-dep-wrap');
            if (depWrap && !depWrap.contains(e.target)) {
                document.getElementById('budget-dep-menu')?.classList.remove('open');
            }
            const anWrap = document.getElementById('budget-an-wrap');
            if (anWrap && !anWrap.contains(e.target)) {
                document.getElementById('budget-an-menu')?.classList.remove('open');
                document.getElementById('budget-an-btn')?.classList.remove('open-state');
            }
        });
        // Fermeture modales budget avec Échap
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                ['modal-budget-comp','modal-budget-regle','modal-budget-rec','modal-budget-cashflow','modal-budget-analyse'].forEach(id => {
                    document.getElementById(id)?.classList.remove('open');
                });
                const ov = document.getElementById('budget-modal-overlay');
                if (ov) ov.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
        // Appliquer la mise en page sauvegardée — délai > 150ms pour passer après applyTheme
        setTimeout(() => this.applyAllLayouts(), 200);
    },

    /* ── Onboarding ─────────────────────────────────────── */
    _startOnboarding() {
        // 6 étapes : welcome, compte, revenu, catégories, dépense, done
        const STEPS = [
            {
                key: 'welcome',
                label: 'Bienvenue',
                title: 'Vault, ton espace financier',
                desc: 'Suis tes dépenses, gère ton budget et visualise ton patrimoine. Tout est synchronisé sur le cloud, privé et gratuit.',
                cta: 'Commencer →',
            },
            {
                key: 'account',
                label: 'Étape 1 / 4',
                title: 'Crée ton compte bancaire',
                desc: 'Ajoute ton compte courant avec son solde actuel. Vault calculera tes mouvements à partir de cette date.',
                cta: 'Suivant →',
                actionLabel: '🏦 Ouvrir maintenant',
                actionFn: () => document.querySelector('[onclick*="openAddComptePointage"]')?.click(),
            },
            {
                key: 'income',
                label: 'Étape 2 / 4',
                title: 'Saisis ton revenu mensuel',
                desc: 'Entre ton salaire net. Vault s\'en sert pour calculer ton taux d\'épargne et tes capacités budgétaires.',
                cta: 'Suivant →',
                actionLabel: '💰 Saisir mon revenu',
                actionFn: () => document.querySelector('[onclick*="openBsRevenu"], [onclick*="openRevenu"]')?.click(),
            },
            {
                key: 'categories',
                label: 'Étape 3 / 4',
                title: 'Configure tes catégories',
                desc: 'Crée tes catégories de dépenses (Alimentation, Transport, Loyer…) pour organiser ton budget. Tu peux en ajouter autant que tu veux.',
                cta: 'Suivant →',
                actionLabel: '🏷 Gérer les catégories',
                actionFn: () => document.querySelector('[onclick*="openBudgetsModal"], [onclick*="budgetsModal"]')?.click(),
            },
            {
                key: 'expense',
                label: 'Étape 4 / 4',
                title: 'Première dépense',
                desc: 'Ajoute ta première dépense ou importe un relevé CSV bancaire pour remplir tout ton historique d\'un coup.',
                cta: 'Suivant →',
                actionLabel: '➕ Ajouter une dépense',
                actionFn: () => document.querySelector('[onclick*="openBsDep"], [onclick*="openDep"]')?.click(),
            },
            {
                key: 'done',
                label: 'Prêt !',
                title: 'Tu es prêt 🎉',
                desc: 'Explore les onglets Budget, PEA, Patrimoine et Bilan au fur et à mesure que tu enrichis tes données. Bonne gestion !',
                cta: 'Explorer Vault',
            },
        ];

        const ILLU = {
            welcome:    `<svg viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="54" cy="54" r="48" fill="#ede7f6"/><rect x="24" y="36" width="60" height="44" rx="8" fill="#fff" stroke="#7c4dff" stroke-width="1.5"/><rect x="30" y="46" width="22" height="4" rx="2" fill="#7c4dff" opacity=".6"/><rect x="30" y="54" width="16" height="3" rx="1.5" fill="#c5cae9"/><rect x="30" y="61" width="20" height="3" rx="1.5" fill="#c5cae9"/><circle cx="70" cy="55" r="10" fill="#3f51b5"/><path d="M65 55l3.5 3.5L76 51" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            account:    `<svg viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="54" cy="54" r="48" fill="#e8eaf6"/><rect x="18" y="40" width="72" height="42" rx="10" fill="#3f51b5"/><rect x="18" y="48" width="72" height="12" fill="#283593" opacity=".5"/><rect x="26" y="66" width="20" height="4" rx="2" fill="#fff" opacity=".5"/><rect x="26" y="74" width="28" height="3" rx="1.5" fill="#fff" opacity=".3"/><circle cx="76" cy="70" r="9" fill="#7c4dff"/><path d="M73 70h6M76 67v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
            income:     `<svg viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="54" cy="54" r="48" fill="#e8f5e9"/><path d="M22 78L40 52l14 13 15-24 12 10" stroke="#43a047" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="40" cy="52" r="3.5" fill="#43a047"/><circle cx="54" cy="65" r="3.5" fill="#43a047"/><circle cx="69" cy="41" r="3.5" fill="#43a047"/><circle cx="54" cy="30" r="12" fill="#43a047"/><path d="M54 24v10M50 27h5a2 2 0 010 4h-4a2 2 0 010 4h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
            categories: `<svg viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="54" cy="54" r="48" fill="#fff8e1"/><rect x="20" y="32" width="32" height="20" rx="6" fill="#ffb300" opacity=".8"/><rect x="56" y="32" width="32" height="20" rx="6" fill="#7c4dff" opacity=".8"/><rect x="20" y="58" width="32" height="20" rx="6" fill="#3f51b5" opacity=".7"/><rect x="56" y="58" width="32" height="20" rx="6" fill="#43a047" opacity=".7"/><text x="36" y="46" text-anchor="middle" fill="#fff" font-size="8" font-family="sans-serif">🍔</text><text x="72" y="46" text-anchor="middle" fill="#fff" font-size="8" font-family="sans-serif">🚗</text><text x="36" y="72" text-anchor="middle" fill="#fff" font-size="8" font-family="sans-serif">🏠</text><text x="72" y="72" text-anchor="middle" fill="#fff" font-size="8" font-family="sans-serif">🎮</text></svg>`,
            expense:    `<svg viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="54" cy="54" r="48" fill="#fce4ec"/><rect x="24" y="46" width="60" height="34" rx="8" fill="#fff" stroke="#e53935" stroke-width="1.5"/><path d="M24 58h60" stroke="#e53935" stroke-width="1" opacity=".3"/><rect x="32" y="63" width="12" height="8" rx="3" fill="#e53935" opacity=".7"/><rect x="48" y="63" width="12" height="8" rx="3" fill="#ef9a9a"/><rect x="64" y="63" width="12" height="8" rx="3" fill="#ef9a9a"/><circle cx="54" cy="36" r="12" fill="#e53935"/><path d="M54 31v6M51 34h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
            done:       `<svg viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="54" cy="54" r="48" fill="#ede7f6"/><circle cx="54" cy="54" r="26" fill="#7c4dff"/><path d="M42 54l8.5 8.5 16-17" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="54" cy="54" r="33" stroke="#7c4dff" stroke-width="1.5" stroke-dasharray="4 3" opacity=".35"/><circle cx="82" cy="24" r="7" fill="#43a047"/><path d="M79 24l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        };
        // Stocker pour que _obPause puisse y accéder
        this._obIllu = ILLU;

        // Empty state illustrations (pour usage dans refreshes)
        this._emptyIllus = {
            depenses: `<svg viewBox="0 0 110 110" fill="none"><circle cx="55" cy="55" r="50" fill="#f0f4ff"/><rect x="22" y="38" width="66" height="12" rx="5" fill="#c5cae9"/><rect x="22" y="56" width="66" height="12" rx="5" fill="#dce0f0"/><rect x="22" y="74" width="66" height="12" rx="5" fill="#c5cae9"/><rect x="22" y="38" width="8" height="12" rx="4" fill="#7c4dff" opacity=".7"/><rect x="22" y="74" width="8" height="12" rx="4" fill="#3f51b5" opacity=".5"/></svg>`,
            pea:      `<svg viewBox="0 0 110 110" fill="none"><circle cx="55" cy="55" r="50" fill="#f0f4ff"/><path d="M18 88L36 66l15 12L68 44l16 18" stroke="#c5cae9" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 3"/><circle cx="36" cy="66" r="4" fill="#c5cae9"/><circle cx="68" cy="44" r="4" fill="#c5cae9"/><circle cx="55" cy="72" r="16" fill="none" stroke="#7c4dff" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M55 64v8M51 68h8" stroke="#7c4dff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
            patrimoine: `<svg viewBox="0 0 110 110" fill="none"><circle cx="55" cy="55" r="50" fill="#f0f4ff"/><path d="M55 22L96 88H14Z" fill="#e8eaf6" stroke="#c5cae9" stroke-width="1.5"/><path d="M55 22L76 63H34Z" fill="#c5cae9" stroke="#7c4dff" stroke-width="1" opacity=".6"/><circle cx="55" cy="22" r="5" fill="#7c4dff"/></svg>`,
            bilan:    `<svg viewBox="0 0 110 110" fill="none"><circle cx="55" cy="55" r="50" fill="#f0f4ff"/><rect x="20" y="36" width="70" height="52" rx="8" fill="#e8eaf6"/><rect x="28" y="50" width="30" height="4" rx="2" fill="#c5cae9"/><rect x="28" y="60" width="22" height="4" rx="2" fill="#c5cae9"/><rect x="28" y="70" width="26" height="4" rx="2" fill="#c5cae9"/><circle cx="73" cy="60" r="12" fill="#7c4dff" opacity=".15"/><path d="M69 60h8M73 56v8" stroke="#7c4dff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        };

        let step = 0;
        const overlay = document.createElement('div');
        overlay.className = 'v-ob-overlay';
        overlay.innerHTML = `
          <div class="v-ob-card">
            <button class="v-ob-skip">Passer</button>
            <div class="v-ob-body" id="_ob_body">
              <div class="v-ob-illu" id="_ob_illu"></div>
              <div class="v-ob-label" id="_ob_label"></div>
              <h2 class="v-ob-title" id="_ob_title"></h2>
              <p class="v-ob-desc" id="_ob_desc"></p>
              <div class="v-ob-dots" id="_ob_dots"></div>
              <div id="_ob_action_wrap"></div>
              <div class="v-ob-actions">
                <button class="v-ob-btn-back" id="_ob_back" style="display:none">← Retour</button>
                <button class="v-ob-btn-next" id="_ob_next"></button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        this._obOverlay = overlay;

        const render = (idx, dir = 1) => {
            this._obCurrentStep = idx;
            const body = document.getElementById('_ob_body');
            body.classList.add('exit');
            setTimeout(() => {
                const s = STEPS[idx];
                document.getElementById('_ob_illu').innerHTML = ILLU[s.key] || '';
                document.getElementById('_ob_label').textContent = s.label;
                document.getElementById('_ob_title').textContent = s.title;
                document.getElementById('_ob_desc').textContent = s.desc;
                document.getElementById('_ob_next').textContent = s.cta;
                document.getElementById('_ob_back').style.display = idx > 0 && idx < STEPS.length - 1 ? '' : 'none';
                document.getElementById('_ob_dots').innerHTML = STEPS.map((_,i) =>
                    `<span class="v-ob-dot${i===idx?' active':''}"></span>`).join('');
                // Bouton "Faire maintenant" si l'étape a une action
                const aw = document.getElementById('_ob_action_wrap');
                if (s.actionLabel && s.actionFn) {
                    aw.innerHTML = `<button class="v-ob-btn-action" id="_ob_action">${s.actionLabel}</button>`;
                    document.getElementById('_ob_action').onclick = () => {
                        // Masquer l'overlay sans marquer comme terminé
                        this._obPause();
                        setTimeout(() => { try { s.actionFn(); } catch(e){} }, 150);
                    };
                } else {
                    aw.innerHTML = '';
                }
                body.classList.remove('exit');
                body.classList.add('enter');
                requestAnimationFrame(() => body.classList.remove('enter'));
            }, 180);
        };

        document.getElementById('_ob_next').onclick = () => {
            if (step < STEPS.length - 1) { step++; render(step, 1); }
            else this._closeOnboarding();
        };
        document.getElementById('_ob_back').onclick = () => {
            if (step > 0) { step--; render(step, -1); }
        };
        overlay.querySelector('.v-ob-skip').onclick = () => this._closeOnboarding();
        overlay.addEventListener('click', e => { if (e.target === overlay) this._closeOnboarding(); });

        this._obCurrentStep = 0;
        this._obSteps = STEPS;
        this._obRender = render;
        render(0);
    },

    // Pause : masque l'overlay, affiche le pill "reprendre"
    _obPause() {
        const o = this._obOverlay;
        if (!o) return;
        o.style.display = 'none';
        document.getElementById('_ob_resume_pill')?.remove();
        const pill = document.createElement('button');
        pill.id = '_ob_resume_pill';
        pill.className = 'v-ob-resume-pill';
        pill.innerHTML = '<span class="v-ob-pill-dot"></span> Reprendre le guide';
        pill.onclick = () => this._obAutoResume(false);
        document.body.appendChild(pill);
    },

    // Reprise auto (après save) ou manuelle (pill)
    // advance=true → passe à l'étape suivante ; false → reste sur l'étape courante
    _obAutoResume(advance = true) {
        document.getElementById('_ob_resume_pill')?.remove();
        const o = this._obOverlay;
        if (!o || !this._obRender || !this._obSteps) return;
        const steps = this._obSteps;
        const nextStep = advance
            ? Math.min(this._obCurrentStep + 1, steps.length - 1)
            : this._obCurrentStep;
        o.style.display = '';
        this._obRender(nextStep);
    },

    _closeOnboarding() {
        localStorage.setItem('vault_ob_done', '1');
        document.getElementById('_ob_resume_pill')?.remove();
        const o = this._obOverlay;
        if (!o) return;
        o.classList.add('closing');
        setTimeout(() => o.remove(), 260);
        this._obOverlay = null;
    },

    /* ── Système popup unifié — retire les styles inline ─── */
    _initVaultPopups() {

        // 1. Créer l'overlay global unique pour les .modal
        const globalOverlay = document.createElement('div');
        globalOverlay.id = 'vp-global-overlay';
        globalOverlay.className = 'vp-overlay-bg';
        document.body.appendChild(globalOverlay);
        // Clic sur l'overlay ferme le modal actif
        // Fix : on ignore le click si le mousedown a commencé à l'intérieur du modal
        let _vpMouseDownInsideModal = false;
        document.addEventListener('mousedown', e => {
            const active = document.querySelector('.modal.active');
            _vpMouseDownInsideModal = !!(active && active.contains(e.target));
        });
        globalOverlay.addEventListener('click', () => {
            if (_vpMouseDownInsideModal) return; // drag depuis l'intérieur → on ignore
            const active = document.querySelector('.modal.active');
            if (active) {
                const closeBtn = active.querySelector('[onclick*="close"], [onclick*="Close"], [onclick*="Modal"]');
                if (closeBtn) {
                    this._vpCloseModal(active);
                    setTimeout(() => closeBtn.click(), 200);
                } else {
                    this._vpCloseModal(active);
                }
            }
        });

        // ── Fix drag-out global : tous les .bs-overlay et budget-modal-overlay ──
        // Principe : on enregistre si le mousedown a commencé DANS le contenu du sheet.
        // Si oui, on bloque la fermeture même si le pointeur finit sur l'overlay.
        let _bsMouseDownInside = false;

        document.addEventListener('mousedown', e => {
            // .bs-overlay : le contenu est le premier enfant direct (le sheet)
            const bsOverlay = e.target.closest('.bs-overlay');
            if (bsOverlay) {
                const sheet = bsOverlay.querySelector(':scope > *:not([data-bs-close])') || bsOverlay.firstElementChild;
                _bsMouseDownInside = !!(sheet && sheet.contains(e.target));
            } else {
                _bsMouseDownInside = false;
            }

            // budget-modal-overlay : contenu = les .budget-modal-box.open
            const openBudgetModal = ['modal-budget-comp','modal-budget-regle','modal-budget-rec',
                'modal-budget-cashflow','modal-budget-analyse','budget-hist-complet-wrap',
                'modal-all-cats','modal-emoji-cat']
                .map(id => document.getElementById(id))
                .find(el => el?.classList.contains('open'));
            this._budgetMouseDownInside = !!(openBudgetModal && openBudgetModal.contains(e.target));
        });

        // Attacher les handlers mouseup sur tous les .bs-overlay (remplace les onclick inline)
        document.querySelectorAll('.bs-overlay[data-bs-close]').forEach(overlay => {
            overlay.addEventListener('mouseup', e => {
                // Ferme seulement si : clic directement sur l'overlay ET pas de drag depuis l'intérieur
                if (e.target === overlay && !_bsMouseDownInside) {
                    const fn = overlay.dataset.bsClose;
                    if (fn) {
                        try { eval(fn); } catch(err) { console.warn('bs-close error', err); }
                    }
                }
            });
        });

        // 2. Intercepter l'ouverture/fermeture des .modal via MutationObserver
        const obs = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
                const el = m.target;
                if (!el.classList.contains('modal')) continue;
                if (el.classList.contains('active')) {
                    this._vpShowOverlay();
                    // Supprimer vpDone pour re-patcher si le innerHTML a changé
                    delete el.dataset.vpDone;
                    this._vpPatchModal(el);
                } else {
                    if (!document.querySelector('.modal.active')) this._vpHideOverlay();
                }
            }
            // Modals créés dynamiquement (objectif, récurrence, etc.)
            for (const m of muts) {
                for (const node of (m.addedNodes || [])) {
                    if (node.nodeType !== 1) continue;
                    if (node.classList?.contains('modal')) this._vpPatchModal(node);
                    node.querySelectorAll?.('.modal').forEach(n => this._vpPatchModal(n));
                }
            }
        });
        obs.observe(document.body, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['class']
        });

        // 3. Patcher les .bs-sheet (bottom sheets) dès le départ
        document.querySelectorAll('.bs-sheet').forEach(sheet => this._vpPatchSheet(sheet));

        // 4. Patcher les .modal déjà dans le DOM
        document.querySelectorAll('.modal').forEach(m => this._vpPatchModal(m));
    },

    _vpShowOverlay() {
        const o = document.getElementById('vp-global-overlay');
        if (!o) return;
        o.classList.add('vp-active');
        requestAnimationFrame(() => o.classList.add('vp-visible'));
    },

    _vpHideOverlay() {
        const o = document.getElementById('vp-global-overlay');
        if (!o) return;
        o.classList.remove('vp-visible');
        setTimeout(() => o.classList.remove('vp-active'), 260);
    },

    // Ferme un bs-overlay avec animation de sortie propre
    _vpBsClose(overlayOrId) {
        const el = typeof overlayOrId === 'string'
            ? document.getElementById(overlayOrId)
            : overlayOrId;
        if (!el) return;
        el.classList.add('vp-bs-closing');
        el.classList.remove('open');
        setTimeout(() => el.classList.remove('vp-bs-closing'), 220);
    },

    _vpCloseModal(modal) {
        if (!modal) return;
        const isMobile = window.innerWidth <= 600;
        if (!isMobile) {
            modal.classList.add('closing');
            setTimeout(() => modal.classList.remove('active', 'closing'), 210);
        } else {
            modal.classList.add('closing');
            setTimeout(() => modal.classList.remove('active', 'closing'), 230);
        }
        setTimeout(() => {
            if (!document.querySelector('.modal.active')) this._vpHideOverlay();
        }, 50);
    },

    // Patch un .modal : retire styles inline, ajoute classes VP
    _vpPatchModal(modal) {
        if (modal.dataset.vpDone) return;
        modal.dataset.vpDone = '1';

        // Boutons ✕ : retirer tous les styles inline et ajouter .vp-close
        modal.querySelectorAll('button').forEach(btn => {
            const txt = btn.textContent.trim();
            const onclick = btn.getAttribute('onclick') || '';
            if (txt === '✕' || txt === '×' || onclick.includes('close') || onclick.includes('Close')) {
                btn.removeAttribute('style');
                btn.classList.add('vp-close');
            }
        });

        // Boutons footer
        this._vpPatchButtons(modal);

        // Pré-titre dans le header
        this._vpInjectPretitle(modal);
    },

    // Patch un .bs-sheet : retire styles inline, ajoute classes VP
    _vpPatchSheet(sheet) {
        if (sheet.dataset.vpDone) return;
        sheet.dataset.vpDone = '1';

        // Boutons ✕
        sheet.querySelectorAll('button').forEach(btn => {
            const txt = btn.textContent.trim();
            const onclick = btn.getAttribute('onclick') || '';
            if (txt === '✕' || txt === '×' || onclick.includes('close') || onclick.includes('Close')) {
                btn.removeAttribute('style');
                btn.classList.add('vp-close');
            }
        });

        // Boutons footer
        this._vpPatchButtons(sheet);
    },

    _vpPatchButtons(container) {
        // bs-btn-save / bs-btn-cancel → classes VP
        container.querySelectorAll('.bs-btn-save').forEach(b => {
            b.classList.add('vp-btn-save');
        });
        container.querySelectorAll('.bs-btn-cancel').forEach(b => {
            b.classList.add('vp-btn-cancel');
        });

        // Boutons modal-footer
        container.querySelectorAll('.modal-footer button, .modal-footer .btn').forEach(btn => {
            const onclick = btn.getAttribute('onclick') || '';
            const cls = btn.className || '';
            const txt = btn.textContent.trim().toLowerCase();
            if (
                cls.includes('btn-secondary') ||
                onclick.includes('close') || onclick.includes('Close') ||
                onclick.includes('annuler') || onclick.includes('cancel') ||
                txt === 'annuler' || txt === 'fermer'
            ) {
                btn.classList.add('vp-btn-cancel');
            } else if (btn.id === 'confirmBtn' || onclick.includes('supprimer') || txt.includes('supprimer') || txt.includes('réinit')) {
                btn.classList.add('vp-btn-save', 'vp-btn-danger');
            } else {
                btn.classList.add('vp-btn-save');
            }
        });
    },

    _vpInjectPretitle(modal) {
        const header = modal.querySelector('.modal-header');
        if (!header || header.querySelector('.vp-pretitle')) return;
        const titleEl = header.querySelector('.modal-title, h2');
        if (!titleEl) return;

        const PRE = [
            [/(objectif)/i,             'Bilan · Objectifs'],
            [/(récurrence|recurrence)/i, 'Budget · Récurrences'],
            [/(ligne.*pea|pea.*ligne|nouveau.*pea)/i, 'PEA · Portefeuille'],
            [/(retraite)/i,             'Projection · Retraite'],
            [/(simulat|scénario)/i,     'Simulateur PEA'],
            [/(confirm|supprimer)/i,    'Confirmation'],
            [/(personnalis|couleur)/i,  'Paramètres'],
            [/(calculat)/i,             'Outils PEA'],
            [/(catégorie|categorie)/i,  'Budget · Catégories'],
        ];

        const text = titleEl.textContent || '';
        let label = '';
        for (const [re, l] of PRE) { if (re.test(text)) { label = l; break; } }
        if (!label) return;

        const pre = document.createElement('div');
        pre.className = 'vp-pretitle';
        pre.textContent = label;
        pre.style.cssText = 'font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-gradient-end);margin-bottom:.2rem;font-family:"DM Mono",monospace;display:block';

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-width:0';
        titleEl.parentNode.insertBefore(wrap, titleEl);
        wrap.appendChild(pre);
        wrap.appendChild(titleEl);
    },

    _showLoader() {
        const loader = document.createElement('div');
        loader.id = 'app-loader';
        loader.style.cssText = 'position:fixed;inset:0;background:var(--bg-primary);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:1rem;font-family:Outfit,sans-serif';
        loader.innerHTML = `
            <div style="width:48px;height:48px;border:4px solid var(--border-color);border-top-color:var(--accent-primary);border-radius:50%;animation:spin .8s linear infinite"></div>
            <div style="font-size:1.1rem;font-weight:600;color:var(--text-primary)">Chargement…</div>
            <div style="font-size:0.75rem;color:var(--text-tertiary)">Synchronisation avec le cloud</div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;
        document.body.appendChild(loader);
    },

    _hideLoader() {
        document.getElementById('app-loader')?.remove();
    },

    /* ── Fermeture modale avec animation ── */
    _closeModal(modalId, overlayId = 'overlay') {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('active');
        modal.classList.add('closing');
        modal.addEventListener('animationend', () => {
            modal.classList.remove('closing');
            const overlay = document.getElementById(overlayId);
            if (overlay) overlay.classList.remove('active');
        }, { once: true });
        // Fallback si animationend ne se déclenche pas
        setTimeout(() => {
            modal.classList.remove('closing');
            const overlay = document.getElementById(overlayId);
            if (overlay) overlay.classList.remove('active');
        }, 300);
    },

    chargerDonneesExemple() {

        const now = new Date();
        const m = (d) => `${now.getFullYear()}-${String(now.getMonth()+1+d).padStart(2,'0')}`;

        this.data.objectifs = [
            { id: 1, nom: 'Voyage au Japon', emoji: '✈️', cible: 3500, actuel: 2100, dateTarget: m(4) },
            { id: 2, nom: 'Voiture', emoji: '🚗', cible: 8000, actuel: 800, dateTarget: m(10) },
            { id: 3, nom: 'Apport immobilier', emoji: '🏠', cible: 30000, actuel: 12400, dateTarget: m(24) }
        ];
        this.data.recurrences = [
            { id: 1, nom: 'Loyer', emoji: '🏠', montant: 850, jour: 1, freq: 'mensuel', actif: true },
            { id: 2, nom: 'Netflix + Spotify', emoji: '📺', montant: 23, jour: 15, freq: 'mensuel', actif: true },
            { id: 3, nom: 'Forfait mobile', emoji: '📱', montant: 19, jour: 20, freq: 'mensuel', actif: true }
        ];
        this.data.notes = [
            { id: 1, mois: m(-1), texte: 'Prime de fin d\'année reçue — +1 200 € versés directement sur PEA.', tag: 'Revenu exceptionnel' },
            { id: 2, mois: m(-2), texte: 'Déménagement — frais de transport + dépôt de garantie. Budget shopping dépassé.', tag: 'Dépense exceptionnelle' }
        ];
        this.data.lignesPEA = [
            { id: 1, nom: 'MSCI World', ticker: 'CW8', parts: 42, pru: 95.40, valeurActuelle: 108.95 },
            { id: 2, nom: 'S&P 500', ticker: '500', parts: 18, pru: 98.20, valeurActuelle: 105.20 },
            { id: 3, nom: 'Emerging Mkt', ticker: 'AEEM', parts: 30, pru: 31.50, valeurActuelle: 28.90 }
        ];
        this.data.allocationCible = { 'MSCI World': 60, 'S&P 500': 25, 'Emerging Mkt': 15 };
        this.save();
        this.refreshObjectifs();
        this.refreshNotes();
        this.refreshRecurrences();
        this.refreshLignesPEA();
    },

    // Échappe tous les caractères HTML dangereux — à utiliser sur toute
    // donnée externe (libellés bancaires, notes, catégories) avant injection dans innerHTML
    _esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    formatCurrency(amount) {
        return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
    },

    _sb: {
        url: 'https://qtjpckemaqxhiavmzmfj.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anBja2VtYXF4aGlhdm16bWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDQyNDQsImV4cCI6MjA4NzY4MDI0NH0.LfG_FEuQ2n05WzA_qPjI1_IKBEiY6USzkuo-7HK2D9U',
        table: 'suivi_data',
    },

    _auth: { user: null, token: null, refreshToken: null, mode: 'login' },

    async _sbFetch(method, body) {
        const { url, key, table } = this._sb;
        const token = this._auth.token || key;
        const userId = this._auth.user?.id;
        const isUpsert = method === 'UPSERT';

        let endpoint;
        if (isUpsert) {
            endpoint = `${url}/rest/v1/${table}?on_conflict=user_id`;
        } else {
            endpoint = userId
                ? `${url}/rest/v1/${table}?user_id=eq.${userId}`
                : `${url}/rest/v1/${table}?user_id=eq.null`;
        }

        const headers = {
            'apikey': key,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        if (isUpsert)        headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
        if (method === 'GET') headers['Prefer'] = 'return=representation';

        const r = await fetch(endpoint, {
            method: isUpsert ? 'POST' : method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!r.ok) {
            const errText = await r.text();
            throw new Error(`Supabase ${method} ${r.status}: ${errText}`);
        }
        return method === 'GET' ? r.json() : null;
    },

    async load() {
        /* Score de complétude d'un jeu de données */
        const _score = d => !d ? 0 :
            (d.depenses||[]).length +
            (d.patrimoine||[]).length +
            (d.suiviPEA||[]).length +
            (d.lignesPEA||[]).length +
            (d.revenus||[]).length +
            (d.objectifs||[]).length +
            (d.recurrences||[]).length +
            (d.notes||[]).length;

        let cloudData = null;
        let cloudTime = 0;
        try {
            const rows = await this._sbFetch('GET');
            cloudData = rows?.[0]?.data || null;
            cloudTime = rows?.[0]?.updated_at ? new Date(rows[0].updated_at).getTime() : 0;
        } catch(e) {
            console.warn('Supabase indisponible, fallback localStorage:', e.message);
        }

        let localData = null;
        let localTime = 0;
        try {
            const raw = localStorage.getItem('suiviFinancier');
            if (raw) localData = JSON.parse(raw);
            localTime = parseInt(localStorage.getItem('suiviFinancierTime') || '0');
        } catch(e) {}

        const cloudScore = _score(cloudData);
        const localScore = _score(localData);

        /* Prendre la source la plus complète.
           En cas d'égalité, prendre la plus récente. */
        let best = null;
        if (cloudScore > 0 || localScore > 0) {
            if (cloudScore > localScore) {
                best = cloudData;
            } else if (localScore > cloudScore) {
                best = localData;
            } else {
                /* Scores égaux → plus récent */
                best = (cloudTime >= localTime) ? cloudData : localData;
            }
        }

        if (best) {
            this._applyLoaded(best);
            /* Resynchroniser localStorage et Supabase sur la meilleure source */
            try { localStorage.setItem('suiviFinancier', JSON.stringify(best)); } catch(e) {}
            if (best === localData && cloudScore < localScore) {
                /* localStorage plus complet → remonter vers Supabase */
                this._syncToSupabase();
            } else if (best === cloudData) {
                localStorage.setItem('suiviFinancierTime', cloudTime.toString());
            }
        }
    },

    _applyLoaded(loaded) {
        this.data = {
            depenses:           loaded.depenses          || [],
            revenus:            loaded.revenus            || [],
            suiviPEA:           loaded.suiviPEA           || [],
            patrimoine:         loaded.patrimoine          || [],
            budgets:            loaded.budgets             || this.data.budgets,
            categoriesEpargne:  loaded.categoriesEpargne  || ['ÉPARGNE'],
            comptes:            loaded.comptes             || this.data.comptes,
            comptesLiquides:    loaded.comptesLiquides     || [],
            comptesPointage:    loaded.comptesPointage     || [],
            modeles:            loaded.modeles             || [],
            scenarios:          loaded.scenarios           || [],
            objectifs:          loaded.objectifs           || [],
            recurrences:        loaded.recurrences         || [],
            notes:              loaded.notes               || [],
            abonnements:        loaded.abonnements         || [],
            lignesPEA:          loaded.lignesPEA           || [],
            allocationCible:    loaded.allocationCible     || {},
            classif503020:      loaded.classif503020       || {},
            chartColors:        loaded.chartColors          || {},
            hiddenCards:        loaded.hiddenCards          || {},
            cardOrder:          loaded.cardOrder            || {},
            cardLayout:         loaded.cardLayout           || {},
            categorieColors:    loaded.categorieColors      || {},
            catEmojis:          loaded.catEmojis             || {},
            parametres:         loaded.parametres          || this.data.parametres
        };
        if (!this.data.parametres.theme)  this.data.parametres.theme  = 'auto';
        if (!this.data.parametres.salaire) this.data.parametres.salaire = 0;
        const elTheme   = document.getElementById('set-theme');
        const elSalaire = document.getElementById('set-salaire');
        if (elTheme)   elTheme.value   = this.data.parametres.theme;
        if (elSalaire) {
            elSalaire.value = this.data.parametres.salaire || '';
            this._updateSalaireDisplay(this.data.parametres.salaire || 0);
        }
        const elFinnhub = document.getElementById('set-finnhub-key');
        if (elFinnhub) elFinnhub.value = this.data.parametres.finnhubKey || '';
    },

    save() {
        try {
            const now = Date.now();
            localStorage.setItem('suiviFinancier', JSON.stringify(this.data));
            localStorage.setItem('suiviFinancierTime', now.toString());
            this._lastChange = now;
            this._lastSyncOk = false;
        } catch(e) { console.error('localStorage save error:', e); }

        this._syncToSupabase();
    },

    async _syncToSupabase() {
        const dot   = document.getElementById('sync-dot');
        const label = document.getElementById('sync-label');
        if (dot)   dot.style.background = 'var(--warning)';
        if (label) label.textContent    = 'sync…';
        try {

            if (!this._auth.user?.id) return;
            await this._sbFetch('UPSERT', {
                user_id: this._auth.user.id,
                data: this.data,
                updated_at: new Date().toISOString()
            });
            if (dot)   dot.style.background = 'var(--success)';
            if (label) label.textContent    = 'sauvé ✓';
            this._lastSyncOk = true;
            setTimeout(() => {
                if (dot)   dot.style.background = 'var(--text-tertiary)';
                if (label) label.textContent    = 'cloud';
            }, 2500);
        } catch(e) {
            if (dot)   dot.style.background = 'var(--danger)';
            if (label) label.textContent    = 'erreur';
            this._lastSyncOk = false;
            console.error('Supabase sync error:', e.message);

            this.notify(`☁️ Sync échouée : ${e.message}`, 'error');
        }
    },

    checkBackupReminder() {
        const lastBackup = this.data.parametres.lastBackup;
        if (!lastBackup) {

            return;
        }

        const daysSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24);
        if (daysSinceBackup >= 7) {

        }
    },

    backupData() {
        this.data.parametres.lastBackup = Date.now();
        this._lastChange = null;
        this.save();
        const wb = XLSX.utils.book_new();

        const depenses = this.data.depenses.map(d => ({
            Date: d.date,
            Catégorie: d.categorie,
            Montant: d.montant,
            Note: d.note,
            ID: d.id
        }));
        const wsDepenses = XLSX.utils.json_to_sheet(depenses);
        XLSX.utils.book_append_sheet(wb, wsDepenses, "Dépenses");

        if (this.data.revenus && this.data.revenus.length > 0) {
            const revenus = this.data.revenus.map(r => ({
                Date: r.date, Mois: r.mois, Type: r.type, Montant: r.montant, Note: r.note, ID: r.id
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revenus), "Revenus");
        }

        const pea = this.data.suiviPEA.map(p => ({
            Date: p.date,
            Valeur: p.valeur,
            Investi: p.investi,
            GainPerte: p.gainPerte,
            Performance: p.performance,
            Note: p.note,
            ID: p.id
        }));
        const wsPEA = XLSX.utils.json_to_sheet(pea);
        XLSX.utils.book_append_sheet(wb, wsPEA, "PEA");

        const patrimoine = this.data.patrimoine.map(p => {
            const obj = { Date: p.date || p.mois, Mois: p.mois, ID: p.id };
            this.data.comptes.forEach(compte => {
                obj[compte] = p[compte] || 0;
            });
            obj.Total = p.total;
            return obj;
        });
        const wsPatrimoine = XLSX.utils.json_to_sheet(patrimoine);
        XLSX.utils.book_append_sheet(wb, wsPatrimoine, "Patrimoine");

        const budgets = Object.keys(this.data.budgets).map(cat => ({
            Catégorie: cat,
            Budget: this.data.budgets[cat]
        }));
        const wsBudgets = XLSX.utils.json_to_sheet(budgets);
        XLSX.utils.book_append_sheet(wb, wsBudgets, "Budgets");

        const comptes = this.data.comptes.map((c, i) => ({ Ordre: i + 1, Compte: c }));
        const wsComptes = XLSX.utils.json_to_sheet(comptes);
        XLSX.utils.book_append_sheet(wb, wsComptes, "Comptes");

        const modeles = this.data.modeles.map(m => ({
            ID: m.id,
            Nom: m.nom,
            Lignes: JSON.stringify(m.lignes)
        }));
        if (modeles.length > 0) {
            const wsModeles = XLSX.utils.json_to_sheet(modeles);
            XLSX.utils.book_append_sheet(wb, wsModeles, "Modèles");
        }

        const scenarios = this.data.scenarios.map(s => ({
            ID: s.id,
            Nom: s.nom,
            Actuel: s.actuel,
            Mensuel: s.mensuel,
            Taux: s.taux,
            Années: s.annees
        }));
        if (scenarios.length > 0) {
            const wsScenarios = XLSX.utils.json_to_sheet(scenarios);
            XLSX.utils.book_append_sheet(wb, wsScenarios, "Scénarios");
        }

        if (this.data.objectifs.length > 0) {
            const wsObj = XLSX.utils.json_to_sheet(this.data.objectifs.map(o => ({
                ID: o.id, Nom: o.nom, Emoji: o.emoji,
                Cible: o.cible, Actuel: o.actuel, DateCible: o.dateTarget || ''
            })));
            XLSX.utils.book_append_sheet(wb, wsObj, "Objectifs");
        }

        if (this.data.notes.length > 0) {
            const wsNotes = XLSX.utils.json_to_sheet(this.data.notes.map(n => ({
                ID: n.id, Mois: n.mois, Tag: n.tag, Texte: n.texte
            })));
            XLSX.utils.book_append_sheet(wb, wsNotes, "Notes");
        }

        if (this.data.recurrences.length > 0) {
            const wsRec = XLSX.utils.json_to_sheet(this.data.recurrences.map(r => ({
                ID: r.id, Nom: r.nom, Emoji: r.emoji,
                Montant: r.montant, Jour: r.jour, Freq: r.freq, Actif: r.actif ? 1 : 0
            })));
            XLSX.utils.book_append_sheet(wb, wsRec, "Récurrences");
        }

        if (this.data.lignesPEA.length > 0) {
            const wsLignes = XLSX.utils.json_to_sheet(this.data.lignesPEA.map(l => ({
                ID: l.id, Nom: l.nom, ISIN: l.isin || '', Ticker: l.ticker || '',
                Parts: l.parts, PRU: l.pru, ValeurActuelle: l.valeurActuelle || l.pru
            })));
            XLSX.utils.book_append_sheet(wb, wsLignes, "LignesPEA");
        }

        if (Object.keys(this.data.allocationCible).length > 0) {
            const wsAlloc = XLSX.utils.json_to_sheet(
                Object.entries(this.data.allocationCible).map(([nom, pct]) => ({ Nom: nom, Cible: pct }))
            );
            XLSX.utils.book_append_sheet(wb, wsAlloc, "AllocationCible");
        }

        const wsParams = XLSX.utils.json_to_sheet([{
            Theme: this.data.parametres.theme || 'auto',
            Salaire: this.data.parametres.salaire || 0
        }]);
        XLSX.utils.book_append_sheet(wb, wsParams, "Paramètres");

        if (this.data.categorieColors && Object.keys(this.data.categorieColors).length > 0) {
            const wsColors = XLSX.utils.json_to_sheet(
                Object.entries(this.data.categorieColors).map(([compte, couleur]) => ({ Compte: compte, Couleur: couleur }))
            );
            XLSX.utils.book_append_sheet(wb, wsColors, "CouleurDonut");
        }

        if (this.data.chartColors && Object.keys(this.data.chartColors).length > 0) {
            const rows = [];
            Object.entries(this.data.chartColors).forEach(([theme, charts]) => {
                Object.entries(charts).forEach(([chartId, colors]) => {
                    (colors || []).forEach((col, i) => {
                        rows.push({ Theme: theme, ChartId: chartId, Index: i, Couleur: col });
                    });
                });
            });
            if (rows.length > 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "CouleurGraphiques");
            }
        }

        XLSX.writeFile(wb, 'suivi-financier-backup-' + new Date().toISOString().split('T')[0] + '.xlsx');

        this.data.parametres.lastBackup = Date.now();
        this.save();
        this.checkBackupReminder();
        this.notify('💾 Sauvegarde réussie', 'success');
    },

    importExcel() {
        const file = document.getElementById('import-excel').files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });

                if (workbook.SheetNames.includes('Dépenses')) {
                    const ws = workbook.Sheets['Dépenses'];
                    const data = XLSX.utils.sheet_to_json(ws);
                    this.data.depenses = data.map(d => ({
                        id: d.ID || crypto.randomUUID(),
                        categorie: d.Catégorie,
                        montant: d.Montant,
                        date: d.Date,
                        note: d.Note
                    }));
                }

                if (workbook.SheetNames.includes('PEA')) {
                    const ws = workbook.Sheets['PEA'];
                    const data = XLSX.utils.sheet_to_json(ws);
                    this.data.suiviPEA = data.map(p => ({
                        id: p.ID || crypto.randomUUID(),
                        date: p.Date,
                        valeur: p.Valeur,
                        investi: p.Investi,
                        gainPerte: p.GainPerte,
                        performance: p.Performance,
                        note: p.Note
                    }));
                }

                if (workbook.SheetNames.includes('Patrimoine')) {
                    const ws = workbook.Sheets['Patrimoine'];
                    const data = XLSX.utils.sheet_to_json(ws);
                    this.data.patrimoine = data.map(p => {
                        const obj = {
                            id: p.ID || crypto.randomUUID(),
                            mois: p.Mois,
                            total: p.Total
                        };
                        this.data.comptes.forEach(compte => {
                            if (p[compte] !== undefined) obj[compte] = p[compte];
                        });
                        return obj;
                    });
                }

                if (workbook.SheetNames.includes('Budgets')) {
                    const ws = workbook.Sheets['Budgets'];
                    const data = XLSX.utils.sheet_to_json(ws);
                    this.data.budgets = {};
                    data.forEach(b => {
                        this.data.budgets[b.Catégorie] = b.Budget;
                    });
                }

                if (workbook.SheetNames.includes('Comptes')) {
                    const ws = workbook.Sheets['Comptes'];
                    const data = XLSX.utils.sheet_to_json(ws);
                    this.data.comptes = data.sort((a, b) => a.Ordre - b.Ordre).map(c => c.Compte);
                }

                if (workbook.SheetNames.includes('Modèles')) {
                    const ws = workbook.Sheets['Modèles'];
                    const data = XLSX.utils.sheet_to_json(ws);
                    this.data.modeles = data.map(m => ({
                        id: m.ID,
                        nom: m.Nom,
                        lignes: JSON.parse(m.Lignes || '[]')
                    }));
                }

                if (workbook.SheetNames.includes('Scénarios')) {
                    const ws = workbook.Sheets['Scénarios'];
                    const data = XLSX.utils.sheet_to_json(ws);
                    this.data.scenarios = data.map(s => ({
                        id: s.ID,
                        nom: s.Nom,
                        actuel: s.Actuel,
                        mensuel: s.Mensuel,
                        taux: s.Taux,
                        annees: s.Années
                    }));
                }

                if (workbook.SheetNames.includes('Objectifs')) {
                    const ws = workbook.Sheets['Objectifs'];
                    this.data.objectifs = XLSX.utils.sheet_to_json(ws).map(o => ({
                        id: o.ID, nom: o.Nom, emoji: o.Emoji || '🎯',
                        cible: o.Cible, actuel: o.Actuel, dateTarget: o.DateCible || ''
                    }));
                }

                if (workbook.SheetNames.includes('Notes')) {
                    const ws = workbook.Sheets['Notes'];
                    this.data.notes = XLSX.utils.sheet_to_json(ws).map(n => ({
                        id: n.ID, mois: n.Mois, tag: n.Tag, texte: n.Texte
                    }));
                }

                if (workbook.SheetNames.includes('Récurrences')) {
                    const ws = workbook.Sheets['Récurrences'];
                    this.data.recurrences = XLSX.utils.sheet_to_json(ws).map(r => ({
                        id: r.ID, nom: r.Nom, emoji: r.Emoji || '💳',
                        montant: r.Montant, jour: r.Jour, freq: r.Freq, actif: r.Actif === 1
                    }));
                }

                if (workbook.SheetNames.includes('LignesPEA')) {
                    const ws = workbook.Sheets['LignesPEA'];
                    this.data.lignesPEA = XLSX.utils.sheet_to_json(ws).map(l => ({
                        id: l.ID, nom: l.Nom, isin: l.ISIN || '', ticker: l.Ticker || '',
                        parts: l.Parts, pru: l.PRU, valeurActuelle: l.ValeurActuelle || l.PRU
                    }));
                }

                if (workbook.SheetNames.includes('AllocationCible')) {
                    const ws = workbook.Sheets['AllocationCible'];
                    this.data.allocationCible = {};
                    XLSX.utils.sheet_to_json(ws).forEach(r => {
                        this.data.allocationCible[r.Nom] = r.Cible;
                    });
                }

                if (workbook.SheetNames.includes('Paramètres')) {
                    const ws = workbook.Sheets['Paramètres'];
                    const rows = XLSX.utils.sheet_to_json(ws);
                    if (rows.length > 0) {
                        if (rows[0].Salaire !== undefined) this.data.parametres.salaire = rows[0].Salaire;
                        if (rows[0].Theme) this.data.parametres.theme = rows[0].Theme;
                    }
                }

                if (workbook.SheetNames.includes('CouleurGraphiques')) {
                    const ws = workbook.Sheets['CouleurGraphiques'];
                    const rows = XLSX.utils.sheet_to_json(ws);
                    this.data.chartColors = this.data.chartColors || {};
                    rows.forEach(r => {
                        if (r.Theme && r.ChartId && r.Couleur) {
                            if (!this.data.chartColors[r.Theme]) this.data.chartColors[r.Theme] = {};
                            if (!this.data.chartColors[r.Theme][r.ChartId]) this.data.chartColors[r.Theme][r.ChartId] = [];
                            this.data.chartColors[r.Theme][r.ChartId][parseInt(r.Index) || 0] = r.Couleur;
                        }
                    });
                }
                if (workbook.SheetNames.includes('CouleurDonut')) {
                    const ws = workbook.Sheets['CouleurDonut'];
                    this.data.categorieColors = {};
                    XLSX.utils.sheet_to_json(ws).forEach(r => {
                        if (r.Compte && r.Couleur) this.data.categorieColors[r.Compte] = r.Couleur;
                    });
                }

                this.save();
                this.updateBudgetsUI();
                this.updateComptesUI();
                this.updateCategoriesSelects();
                this.notify('Restauration réussie', 'success');
                location.reload();
            } catch (err) {
                this.notify('Erreur lors de l\'import', 'error');
                console.error(err);
            }
        };
        reader.readAsBinaryString(file);
    },

    initDates() {
        const today = new Date().toISOString().split('T')[0];
        const month = today.slice(0, 7);
        document.getElementById('dep-date').value = today;
        document.getElementById('pea-date').value = today;
        document.getElementById('pat-mois').value = today;
        document.getElementById('rev-date').value = today;
        document.getElementById('analyse-mois').value = month;
        document.getElementById('analyse-annee').value = new Date().getFullYear();
        document.getElementById('note-mois').value = month;
    },

    switchTab(name) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        this.applyTabCards(name);

        const realName = name === 'objectifs' ? 'bilan' : name;
        const tab = document.getElementById('tab-' + realName);
        if (tab) tab.classList.add('active');
        document.querySelectorAll('.nav-tab').forEach(t => {
            if (t.getAttribute('onclick') && t.getAttribute('onclick').includes("'" + realName + "'")) t.classList.add('active');
        });
        this._currentTab = realName;
        if (realName === 'dashboard') { this.refreshDashboard(); this.refreshHeatmap(); }
        if (realName === 'depenses') { this.analyseDepenses(); this.refreshRegle503020(); this.refreshComparaison(); this.refreshRevenus(); this.refreshHistoriqueRevenus(); this.refreshPointage(); }
        if (realName === 'bilan') { this.refreshObjectifs(); this.refreshNotes(); this.refreshBilanAnnuel(); this.initRapportSelect(); this.initBilanSelect(); }
        if (realName === 'patrimoine') { this.afficherPatrimoine(); this.refreshStatsPatrimoine(); }
        if (realName === 'pea') { this.refreshLignesPEA(); }

        try { localStorage.setItem('lastTab', realName); } catch(e) {}
    },

    toggleAvance() {
        document.getElementById('avance-panel').classList.toggle('open');
        document.getElementById('overlay').classList.toggle('active');
    },

    applyHeatmapColor() {
        const custom = this.getChartCustomColors('chart-heatmap');
        const hex = (custom && custom[0]) ? custom[0] : '#3f51b5';
        const r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
        document.documentElement.style.setProperty('--heatmap-rgb', `${r},${g},${b}`);
        this.refreshHeatmap();
    },

    refreshHeatmap() {
        // Appliquer la couleur custom si elle existe
        const custom = this.getChartCustomColors('chart-heatmap');
        if (custom && custom[0]) {
            const hex = custom[0];
            const r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
            document.documentElement.style.setProperty('--heatmap-rgb', `${r},${g},${b}`);
        }
        const now = new Date();
        const annee = now.getFullYear();
        const el = document.getElementById('heatmap-annee');
        if (el) el.textContent = annee;
        const moisLabels = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
        const labels = document.getElementById('heatmap-months-labels');
        const grid = document.getElementById('heatmap-grid');
        if (!labels || !grid) return;
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        const totaux = Array(12).fill(0);
        this.data.depenses.forEach(d => {
            const date = new Date(d.date);
            if (date.getFullYear() === annee && !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())))
                totaux[date.getMonth()] += d.montant;
        });
        const max = Math.max(...totaux, 1);
        labels.innerHTML = moisLabels.map(m =>
            `<div style="font-family:DM Mono,monospace;font-size:0.5rem;color:var(--text-tertiary);text-align:center">${m}</div>`
        ).join('');
        grid.innerHTML = totaux.map((val, i) => {
            const intensity = val / max;
            const isCurrent = i === now.getMonth();
            const alpha = val === 0 ? 0 : (0.1 + intensity * 0.9);
            const bg = val === 0 ? 'var(--bg-secondary)' : `rgba(var(--heatmap-rgb),${alpha.toFixed(2)})`;
            return `<div
                title="${moisLabels[i]}: ${this.formatCurrency(val)}"
                onclick="app.heatmapClick(${i},'${annee}')"
                style="aspect-ratio:1;border-radius:5px;background:${bg};border:${isCurrent ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)'};cursor:pointer;transition:transform .12s"
                onmouseover="this.style.transform='scale(1.2)'"
                onmouseout="this.style.transform='scale(1)'"></div>`;
        }).join('');
        const moisMax = totaux.indexOf(max);
        const legend = document.getElementById('heatmap-legend');
        if (legend && max > 0) legend.textContent = `Mois le + chargé : ${moisLabels[moisMax]} (${this.formatCurrency(max)})`;
    },

    heatmapClick(moisIndex, annee) {
        const moisStr = `${annee}-${String(moisIndex + 1).padStart(2,'0')}`;
        this.switchTab('depenses');
        const sel = document.getElementById('analyse-periode');
        if (sel) { sel.value = 'mois-choisi'; this.toggleAnalyseFilters(); }
        const inp = document.getElementById('analyse-mois');
        if (inp) { inp.value = moisStr; this.analyseDepenses(); }
    },

    initComparaisonSelects() {
        const moisDispo = [...new Set(this.data.depenses.map(d => d.date.slice(0,7)))].sort().reverse();
        if (moisDispo.length === 0) return;

        const defaults = [moisDispo[1] || moisDispo[0], moisDispo[0]];
        ['comp-mois-a','comp-mois-b'].forEach((id, i) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const current = sel.value;
            const defaultVal = current || defaults[i];
            sel.innerHTML = moisDispo.map(m => `<option value="${m}" ${m === defaultVal ? 'selected' : ''}>${m}</option>`).join('');
        });
    },

    refreshComparaison() {
        this.initComparaisonSelects();
        const moisA = document.getElementById('comp-mois-a')?.value;
        const moisB = document.getElementById('comp-mois-b')?.value;
        const container = document.getElementById('comparaison-container');
        if (!container) return;

        if (!moisA || !moisB || moisA === moisB) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div>Sélectionne deux mois différents</div></div>';
            return;
        }
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        const sansEpargne = d => !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase()));
        const depA = this.data.depenses.filter(d => d.date.startsWith(moisA) && sansEpargne(d));
        const depB = this.data.depenses.filter(d => d.date.startsWith(moisB) && sansEpargne(d));
        if (depA.length === 0 && depB.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div>Pas de données sur ces mois</div></div>';
            return;
        }
        const totA = depA.reduce((s, d) => s + d.montant, 0);
        const totB = depB.reduce((s, d) => s + d.montant, 0);
        const cats = [...new Set([...depA, ...depB].map(d => d.categorie))].sort((a,b) => {
            const va = depA.filter(d=>d.categorie===a).reduce((s,d)=>s+d.montant,0);
            const vb = depB.filter(d=>d.categorie===b).reduce((s,d)=>s+d.montant,0);
            return Math.max(vb,0) - Math.max(va,0);
        });

        const diffTotal = totB - totA;
        const pctTotal = totA > 0 ? ((diffTotal / totA) * 100).toFixed(1) : '—';
        const signTotal = diffTotal >= 0 ? '+' : '';
        const colorTotal = diffTotal > 0 ? 'var(--danger)' : diffTotal < 0 ? 'var(--success)' : 'var(--text-secondary)';

        const fmt = m => { const [y,mo] = m.split('-'); return new Date(y,mo-1).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}); };

        const badge = (diff) => {
            if (diff === 0) return `<span style="background:var(--bg-secondary);color:var(--text-tertiary);font-family:'DM Mono',monospace;font-size:.65rem;padding:.18rem .55rem;border-radius:100px;font-weight:700">= 0 €</span>`;
            const color = diff > 0 ? 'rgba(244,67,54,.12)' : 'rgba(0,200,83,.12)';
            const textColor = diff > 0 ? 'var(--danger)' : 'var(--success)';
            const sign = diff > 0 ? '+' : '';
            return `<span style="background:${color};color:${textColor};font-family:'DM Mono',monospace;font-size:.65rem;padding:.18rem .55rem;border-radius:100px;font-weight:700">${sign}${this.formatCurrency(Math.abs(diff))}</span>`;
        };

        const rows = cats.map(cat => {
            const a = depA.filter(d => d.categorie === cat).reduce((s, d) => s + d.montant, 0);
            const b = depB.filter(d => d.categorie === cat).reduce((s, d) => s + d.montant, 0);
            const diff = b - a;
            return `<tr>
                <td style="padding:.55rem .6rem;border-bottom:1px solid var(--border-color);font-size:.78rem;font-weight:500;color:var(--text-secondary)">${cat}</td>
                <td style="padding:.55rem .6rem;border-bottom:1px solid var(--border-color);font-family:'DM Mono',monospace;font-size:.75rem;text-align:right;color:var(--text-primary)">${a > 0 ? this.formatCurrency(a) : '<span style="color:var(--text-tertiary)">—</span>'}</td>
                <td style="padding:.55rem .6rem;border-bottom:1px solid var(--border-color);font-family:'DM Mono',monospace;font-size:.75rem;text-align:right;color:var(--text-primary)">${b > 0 ? this.formatCurrency(b) : '<span style="color:var(--text-tertiary)">—</span>'}</td>
                <td style="padding:.55rem .6rem;border-bottom:1px solid var(--border-color);text-align:right">${badge(diff)}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.6rem;align-items:center;margin-bottom:1.5rem">
                <div style="background:var(--bg-secondary);border-radius:12px;padding:.65rem .85rem;box-shadow:inset 2px 2px 6px var(--shadow-light),inset -2px -2px 6px var(--shadow-dark)">
                    <div style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);margin-bottom:.2rem">${fmt(moisA)}</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.25rem;font-weight:700;color:var(--accent-primary)">${this.formatCurrency(totA)}</div>
                    <div style="font-size:.62rem;color:var(--text-tertiary);margin-top:.1rem">${depA.length} dépenses</div>
                </div>
                <div style="text-align:center">
                    <div style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:800;color:${colorTotal};line-height:1">${signTotal}${pctTotal}%</div>
                    <div style="font-family:'DM Mono',monospace;font-size:.62rem;font-weight:600;color:${colorTotal};margin-top:.15rem">${signTotal}${this.formatCurrency(Math.abs(diffTotal))}</div>
                </div>
                <div style="background:var(--bg-secondary);border-radius:12px;padding:.65rem .85rem;box-shadow:inset 2px 2px 6px var(--shadow-light),inset -2px -2px 6px var(--shadow-dark)">
                    <div style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);margin-bottom:.2rem">${fmt(moisB)}</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.25rem;font-weight:700;color:var(--text-primary)">${this.formatCurrency(totB)}</div>
                    <div style="font-size:.62rem;color:var(--text-tertiary);margin-top:.1rem">${depB.length} dépenses</div>
                </div>
            </div>
            <div style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.1em;color:var(--text-tertiary);font-weight:600;margin-bottom:.5rem">Détail par catégorie</div>
            <div class="table-container">
            <table style="width:100%;border-collapse:collapse">
                <thead>
                    <tr>
                        <th style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:600;padding:.3rem .6rem;border-bottom:2px solid var(--border-color);text-align:left">Catégorie</th>
                        <th style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:600;padding:.3rem .6rem;border-bottom:2px solid var(--border-color);text-align:right">${fmt(moisA)}</th>
                        <th style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:600;padding:.3rem .6rem;border-bottom:2px solid var(--border-color);text-align:right">${fmt(moisB)}</th>
                        <th style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:600;padding:.3rem .6rem;border-bottom:2px solid var(--border-color);text-align:right">Écart</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td style="padding:.65rem .6rem;font-size:.8rem;font-weight:700;color:var(--text-primary);border-top:2px solid var(--border-color)">Total</td>
                        <td style="padding:.65rem .6rem;font-family:'DM Mono',monospace;font-size:.78rem;font-weight:700;text-align:right;color:var(--accent-primary);border-top:2px solid var(--border-color)">${this.formatCurrency(totA)}</td>
                        <td style="padding:.65rem .6rem;font-family:'DM Mono',monospace;font-size:.78rem;font-weight:700;text-align:right;color:var(--text-primary);border-top:2px solid var(--border-color)">${this.formatCurrency(totB)}</td>
                        <td style="padding:.65rem .6rem;text-align:right;border-top:2px solid var(--border-color)">${badge(diffTotal)}</td>
                    </tr>
                </tfoot>
            </table>
            </div>`;
    },

    _simHorizon: 10,
    ouvrirModalSimulateur() {
        let modal = document.getElementById('simulateurModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'simulateurModal';
            modal.className = 'modal';
            modal.style.maxWidth = '600px';
            document.body.appendChild(modal);
        }
        const h = this._simHorizon || 10;
        modal.innerHTML = `
            <div class="modal-header"><h2 class="modal-title">🎲 Simulateur "Et si…"</h2></div>
            <div class="modal-body">
                <div class="form-group" style="margin-bottom:1.25rem">
                    <label class="form-label">Si j'épargnais… par mois</label>
                    <div style="display:flex;align-items:center;gap:1rem">
                        <input type="range" id="sim-epargne" min="50" max="2000" value="300" step="50" style="flex:1;accent-color:var(--accent-primary)" oninput="app.refreshSimulateur()">
                        <span id="sim-epargne-val" style="font-family:DM Mono,monospace;font-size:1rem;font-weight:700;color:var(--accent-primary);min-width:60px">300 €</span>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:1.25rem">
                    <label class="form-label">Rendement annuel</label>
                    <div style="display:flex;align-items:center;gap:1rem">
                        <input type="range" id="sim-taux" min="1" max="12" value="6" step="0.5" style="flex:1;accent-color:var(--accent-primary)" oninput="app.refreshSimulateur()">
                        <span id="sim-taux-val" style="font-family:DM Mono,monospace;font-size:1rem;font-weight:700;color:var(--accent-primary);min-width:40px">6%</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.5rem">
                    <button class="btn btn-small ${h===5?'':'btn-secondary'}" onclick="app.simSetHorizon(5)" id="sim-5">5 ans</button>
                    <button class="btn btn-small ${h===10?'':'btn-secondary'}" onclick="app.simSetHorizon(10)" id="sim-10">10 ans</button>
                    <button class="btn btn-small ${h===20?'':'btn-secondary'}" onclick="app.simSetHorizon(20)" id="sim-20">20 ans</button>
                    <button class="btn btn-small ${h===30?'':'btn-secondary'}" onclick="app.simSetHorizon(30)" id="sim-30">30 ans</button>
                </div>
                <div class="grid grid-3 grid-stats" style="margin-bottom:1rem">
                    <div class="stat-card stat-card-main"><div class="stat-label">Capital final</div><div class="stat-value accent" id="sim-result-capital" style="font-size:1.6rem">0 €</div></div>
                    <div class="stat-card stat-card-main"><div class="stat-label">Versé</div><div class="stat-value" id="sim-result-verse">0 €</div></div>
                    <div class="stat-card stat-card-main"><div class="stat-label">Intérêts</div><div style="font-family:'Outfit',sans-serif;font-size:2rem;font-weight:700;color:var(--success)" id="sim-result-interets">0 €</div></div>
                </div>
                <div id="sim-conseil" style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;padding:0.75rem;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border-color)"></div>
            </div>
            <div class="modal-footer">
                <button class="vp-btn-cancel" onclick="document.getElementById('simulateurModal').classList.remove('active');document.getElementById('overlay').classList.remove('active')">Fermer</button>
            </div>
        `;
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
        this.refreshSimulateur();
    },

    simSetHorizon(ans) {
        this._simHorizon = ans;
        [5, 10, 20, 30].forEach(n => {
            const btn = document.getElementById('sim-' + n);
            if (btn) btn.className = n === ans ? 'btn btn-small' : 'btn btn-small btn-secondary';
        });
        this.refreshSimulateur();
    },
    refreshSimulateur() {
        const epargne = parseFloat(document.getElementById('sim-epargne')?.value) || 300;
        const taux = parseFloat(document.getElementById('sim-taux')?.value) || 6;
        const horizon = this._simHorizon || 10;
        const g = id => document.getElementById(id);
        if (g('sim-epargne-val')) g('sim-epargne-val').textContent = epargne + ' €';
        if (g('sim-taux-val')) g('sim-taux-val').textContent = taux + '%';
        const r = taux / 100 / 12;
        const n = horizon * 12;
        const capital = r > 0 ? epargne * ((Math.pow(1 + r, n) - 1) / r) : epargne * n;
        const verse = epargne * n;
        const interets = capital - verse;
        if (g('sim-result-capital')) g('sim-result-capital').textContent = this.formatCurrency(capital);
        if (g('sim-result-verse')) g('sim-result-verse').textContent = this.formatCurrency(verse);
        if (g('sim-result-interets')) g('sim-result-interets').textContent = this.formatCurrency(interets);
        const mult = (capital / verse).toFixed(1);
        const conseil = g('sim-conseil');
        if (conseil) conseil.innerHTML = `💡 En ${horizon} ans tu multiplies ta mise par <strong>${mult}x</strong>. Les intérêts représentent <strong>${((interets/capital)*100).toFixed(0)}%</strong> du capital — la magie des intérêts composés.`;
    },

    initBilanSelect() {
        const annees = [...new Set(this.data.depenses.map(d => new Date(d.date).getFullYear()))].sort().reverse();
        if (annees.length === 0) return;
        const sel = document.getElementById('bilan-annee');
        if (!sel) return;

        const currentVal = parseInt(sel.value);
        const defaultAnnee = annees.includes(currentVal) ? currentVal : (annees.includes(new Date().getFullYear()) ? new Date().getFullYear() : annees[0]);
        sel.innerHTML = annees.map(a => `<option value="${a}" ${a === defaultAnnee ? 'selected' : ''}>${a}</option>`).join('');
    },
    refreshBilanAnnuel() {
        this.initBilanSelect();
        const annee = parseInt(document.getElementById('bilan-annee')?.value) || new Date().getFullYear();
        const container = document.getElementById('bilan-annuel-container');
        if (!container) return;
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        const deps = this.data.depenses.filter(d => new Date(d.date).getFullYear() === annee);
        const revsAnnee = (this.data.revenus||[]).filter(r => r.mois && r.mois.startsWith(annee));
        if (deps.length === 0 && revsAnnee.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏅</div><div>Pas de données pour ${annee}</div></div>`;
            return;
        }
        const mL = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
        const now = new Date();

        const parMoisDep = Array(12).fill(0);
        deps.forEach(d => {
            if (!exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())))
                parMoisDep[new Date(d.date).getMonth()] += d.montant;
        });
        const totalDepEff = parMoisDep.reduce((s,v) => s+v, 0);

        let totalVirEpargne = 0;
        deps.forEach(d => {
            if (exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())))
                totalVirEpargne += d.montant;
        });

        const parMoisRev = Array(12).fill(0);
        let totalRevenuAnnuel = 0;
        for (let m = 0; m < 12; m++) {
            if (annee === now.getFullYear() && m > now.getMonth()) continue;
            const { total: rev } = this.getRevenusMois(annee, m);
            parMoisRev[m] = rev;
            totalRevenuAnnuel += rev;
        }

        const epargneNette = totalRevenuAnnuel > 0 ? Math.max(0, totalRevenuAnnuel - totalDepEff) : 0;
        const txEpargne = totalRevenuAnnuel > 0 ? ((epargneNette / totalRevenuAnnuel) * 100) : null;

        const anneePrec = annee - 1;
        const depsPrec = this.data.depenses.filter(d => new Date(d.date).getFullYear() === anneePrec);
        const parMoisDepPrec = Array(12).fill(0);
        let totalDepEffPrec = 0, totalRevPrec = 0;
        depsPrec.forEach(d => {
            if (!exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())))
                parMoisDepPrec[new Date(d.date).getMonth()] += d.montant;
        });
        totalDepEffPrec = parMoisDepPrec.reduce((s,v) => s+v, 0);
        for (let m = 0; m < 12; m++) {
            const { total: rev } = this.getRevenusMois(anneePrec, m);
            totalRevPrec += rev;
        }
        const epargnePrec = totalRevPrec > 0 ? Math.max(0, totalRevPrec - totalDepEffPrec) : 0;
        const txEpargnePrec = totalRevPrec > 0 ? ((epargnePrec / totalRevPrec) * 100) : null;
        const hasPrec = depsPrec.length > 0 || totalRevPrec > 0;

        const nonZero = parMoisDep.filter(v => v > 0);
        const maxMoisVal = Math.max(...parMoisDep, 1);
        const moisMaxIdx = parMoisDep.indexOf(Math.max(...parMoisDep));
        const moisSageIdx = nonZero.length > 0 ? parMoisDep.indexOf(Math.min(...nonZero)) : -1;

        const parCat = {};
        deps.forEach(d => {
            if (!exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())))
                parCat[d.categorie] = (parCat[d.categorie] || 0) + d.montant;
        });
        const catsSorted = Object.entries(parCat).sort((a,b) => b[1]-a[1]);
        const catMax = catsSorted[0];

        const patAnnee = (this.data.patrimoine||[]).filter(p => p.mois && p.mois.startsWith(annee)).sort((a,b) => (a.date||a.mois).localeCompare(b.date||b.mois));
        const patDebut = patAnnee[0]?.total || 0;
        const patFin = patAnnee[patAnnee.length-1]?.total || 0;
        const patDelta = patFin - patDebut;

        const txColor = txEpargne === null ? 'var(--text-primary)' : txEpargne >= 20 ? 'var(--success)' : txEpargne >= 10 ? 'var(--warning)' : 'var(--danger)';

        container.innerHTML = `
        <div id="bilan-annuel-print">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:.5rem">
            <div>
                <div style="font-size:.62rem;font-family:DM Mono,monospace;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.1em">Bilan complet</div>
                <div style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:800;color:var(--text-primary)">${annee}</div>
            </div>
            <button onclick="app.exportBilanPDF(${annee})" class="btn btn-small" style="display:flex;align-items:center;gap:.4rem">🖨 Exporter PDF</button>
        </div>

        <!-- 4 stats -->
        <div class="grid grid-4 grid-stats" style="margin-bottom:1.25rem">
            ${[
                {icon:'↑', label:'Revenus totaux',     val: totalRevenuAnnuel > 0 ? this.formatCurrency(totalRevenuAnnuel) : '—', color:'var(--success)',
                 delta: hasPrec && totalRevPrec > 0 && totalRevenuAnnuel > 0 ? ((totalRevenuAnnuel-totalRevPrec)/totalRevPrec*100) : null, inv: false},
                {icon:'—', label:'Dépenses effectives', val: this.formatCurrency(totalDepEff), color:'var(--accent-primary)',
                 delta: hasPrec && totalDepEffPrec > 0 ? ((totalDepEff-totalDepEffPrec)/totalDepEffPrec*100) : null, inv: true},
                {icon:'€', label:'Épargne nette',       val: totalRevenuAnnuel > 0 ? this.formatCurrency(epargneNette) : '—', color: epargneNette > 0 ? 'var(--success)' : 'var(--danger)',
                 delta: hasPrec && epargnePrec > 0 && totalRevenuAnnuel > 0 ? ((epargneNette-epargnePrec)/epargnePrec*100) : null, inv: false},
                {icon:'◎', label:"Taux d'épargne",     val: txEpargne !== null ? txEpargne.toFixed(0)+'%' : '—', color: txEpargne === null ? 'var(--text-primary)' : txEpargne >= 20 ? 'var(--success)' : txEpargne >= 10 ? 'var(--warning)' : 'var(--danger)',
                 delta: hasPrec && txEpargnePrec !== null && txEpargne !== null ? (txEpargne - txEpargnePrec) : null, inv: false, isTx: true}
            ].map(k => {
                const dStr = k.delta !== null ? (() => {
                    const v = k.isTx ? k.delta.toFixed(1) + 'pt' : Math.abs(k.delta).toFixed(1) + '%';
                    const good = k.inv ? k.delta <= 0 : k.delta >= 0;
                    return `<div class="stat-delta-pill ${good ? 'positive' : 'negative'}" style="margin-top:.3rem">${good ? '↑' : '↓'} ${v} vs N-1</div>`;
                })() : '';
                return `<div class="stat-card stat-card-main" style="text-align:center">
                    <div class="stat-label">${k.label}</div>
                    <div class="stat-value" style="color:${k.color};font-size:1.5rem">${k.val}</div>
                    ${dStr}
                </div>`;
            }).join('')}
        </div>

        <!-- Comparaison N vs N-1 -->
        ${hasPrec ? (() => {
            const rows = [
                {label:'Revenus',       n: totalRevenuAnnuel, p: totalRevPrec,     fmt: v => this.formatCurrency(v), invertDelta: false},
                {label:'Dépenses',      n: totalDepEff,       p: totalDepEffPrec,  fmt: v => this.formatCurrency(v), invertDelta: true},
                {label:'Épargne nette', n: epargneNette,      p: epargnePrec,      fmt: v => this.formatCurrency(v), invertDelta: false},
                {label:"Taux d'épargne",n: txEpargne,         p: txEpargnePrec,    fmt: v => v !== null ? v.toFixed(1)+'%' : '—', invertDelta: false}
            ];
            const cards = rows.map(({label, n, p, fmt, invertDelta}) => {
                const delta    = (n !== null && p !== null && p > 0) ? n - p : null;
                const pct      = (delta !== null && p > 0) ? (delta / p * 100) : null;
                const isGood   = delta === null || delta === 0 ? null : invertDelta ? delta < 0 : delta > 0;
                const color    = isGood === null ? 'var(--text-tertiary)' : isGood ? 'var(--success)' : 'var(--danger)';
                const arrow    = delta === null || delta === 0 ? '→' : delta > 0 ? '↑' : '↓';
                const pctStr   = pct !== null ? (pct > 0 ? '+' : '') + pct.toFixed(1) + '%' : '';
                return '<div style="background:var(--bg-card);border-radius:10px;padding:.65rem .85rem;border:1px solid var(--border-color)">'
                    + '<div style="font-size:.62rem;font-family:DM Mono,monospace;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:.3rem">' + label + '</div>'
                    + '<div style="display:flex;align-items:baseline;gap:.4rem;flex-wrap:wrap">'
                    +   '<span style="font-family:Outfit,sans-serif;font-weight:700;font-size:1rem;color:var(--text-primary)">' + fmt(n) + '</span>'
                    +   (pct !== null ? '<span style="font-family:DM Mono,monospace;font-size:.68rem;font-weight:700;color:' + color + '">' + arrow + ' ' + pctStr + '</span>' : '')
                    + '</div>'
                    + '<div style="font-size:.67rem;color:var(--text-tertiary);margin-top:.15rem">' + (p > 0 ? anneePrec + ' : ' + fmt(p) : 'Pas de données ' + anneePrec) + '</div>'
                    + '</div>';
            });
            return '<div style="margin-bottom:1.25rem;background:var(--bg-secondary);border-radius:14px;padding:1rem 1.25rem;border:1px solid var(--border-color)">'
                + '<div class="stat-label" style="margin-bottom:.75rem"> Comparaison ' + annee + ' vs ' + anneePrec + '</div>'
                + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.6rem">' + cards.join('') + '</div>'
                + '</div>';
        })() : ''}

        <!-- Mini graphe + stats -->
        <div class="grid grid-2" style="margin-bottom:1.25rem">
            <div style="background:var(--bg-secondary);border-radius:14px;padding:1rem;border:1px solid var(--border-color)">
                <div class="stat-label" style="margin-bottom:.75rem">Dépenses effectives mois par mois</div>
                <div style="display:flex;align-items:flex-end;gap:3px;height:64px">
                    ${parMoisDep.map((v,i) => {
                        const h = Math.max(2,(v/maxMoisVal*100).toFixed(0));
                        return '<div title="'+mL[i]+': '+this.formatCurrency(v)+'" style="flex:1;height:'+h+'%;border-radius:3px 3px 0 0;background:'+(i===moisMaxIdx?'var(--danger)':'linear-gradient(180deg,var(--accent-gradient-start),var(--accent-gradient-end))')+';opacity:.85;min-height:2px"></div>';
                    }).join('')}
                </div>
                <div style="display:flex;margin-top:.3rem">
                    ${mL.map(l => '<span style="flex:1;text-align:center;font-family:DM Mono,monospace;font-size:.42rem;color:var(--text-tertiary)">'+l[0]+'</span>').join('')}
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:.45rem">
                ${patAnnee.length >= 2 ? `
                <div style="background:var(--bg-secondary);border-radius:12px;padding:.7rem 1rem;border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                    <span class="stat-label" style="margin:0"> Croissance patrimoine</span>
                    <strong style="color:${patDelta>=0?'var(--success)':'var(--danger)'}">${patDelta>=0?'+':''}${this.formatCurrency(patDelta)}</strong>
                </div>` : ''}
                <div style="background:var(--bg-secondary);border-radius:12px;padding:.7rem 1rem;border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                    <span class="stat-label" style="margin:0">🏆 Mois le + sage</span>
                    <strong>${moisSageIdx >= 0 ? mL[moisSageIdx]+' ('+this.formatCurrency(parMoisDep[moisSageIdx])+')' : '—'}</strong>
                </div>
                <div style="background:var(--bg-secondary);border-radius:12px;padding:.7rem 1rem;border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                    <span class="stat-label" style="margin:0">😬 Mois le + chargé</span>
                    <strong style="color:var(--danger)">${mL[moisMaxIdx]} (${this.formatCurrency(parMoisDep[moisMaxIdx])})</strong>
                </div>
                <div style="background:var(--bg-secondary);border-radius:12px;padding:.7rem 1rem;border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                    <span class="stat-label" style="margin:0">💸 Catégorie principale</span>
                    <strong>${catMax ? catMax[0]+' ('+this.formatCurrency(catMax[1])+')' : '—'}</strong>
                </div>
                <div style="background:var(--bg-secondary);border-radius:12px;padding:.7rem 1rem;border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                    <span class="stat-label" style="margin:0"> Moy. dépenses/mois</span>
                    <strong>${this.formatCurrency(totalDepEff / Math.max(1, nonZero.length))}</strong>
                </div>
            </div>
        </div>

        <!-- Top catégories -->
        ${catsSorted.length > 0 ? `
        <div style="margin-bottom:1.25rem">
            <div class="stat-label" style="margin-bottom:.65rem">Répartition par catégorie (hors épargne)</div>
            <div style="display:flex;flex-direction:column;gap:.35rem">
            ${catsSorted.slice(0,6).map(([cat,val]) => {
                const pct = (val/Math.max(totalDepEff,1)*100).toFixed(0);
                return '<div style="display:flex;align-items:center;gap:.75rem">'
                    +'<span style="font-size:.78rem;min-width:100px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+cat+'</span>'
                    +'<div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:100px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,var(--accent-gradient-start),var(--accent-gradient-end));border-radius:100px"></div></div>'
                    +'<span style="font-family:DM Mono,monospace;font-size:.67rem;color:var(--text-tertiary);min-width:100px;text-align:right">'+this.formatCurrency(val)+' ('+pct+'%)</span>'
                    +'</div>';
            }).join('')}
            </div>
        </div>` : ''}

        <!-- Tableau mensuel -->
        <div style="margin-bottom:1.25rem;overflow-x:auto">
            <div class="stat-label" style="margin-bottom:.65rem">Détail mensuel</div>
            <table class="table" style="font-size:.75rem">
                <thead><tr>
                    <th>Mois</th>
                    <th style="text-align:right">Revenus</th>
                    <th style="text-align:right">Dépenses</th>
                    <th style="text-align:right">Cashflow</th>
                    <th style="text-align:right">Taux ép.</th>
                </tr></thead>
                <tbody>
                ${mL.map((ml,i) => {
                    const rev = parMoisRev[i], dep = parMoisDep[i];
                    if (rev === 0 && dep === 0) return '';
                    const cf = rev > 0 ? rev - dep : null;
                    const tx = rev > 0 ? ((rev-dep)/rev*100).toFixed(0) : null;
                    const txC = tx === null ? '' : tx >= 20 ? 'color:var(--success)' : tx >= 10 ? 'color:var(--warning)' : 'color:var(--danger)';
                    return '<tr>'
                        +'<td style="font-family:DM Mono,monospace;font-size:.7rem">'+ml+'</td>'
                        +'<td style="text-align:right;color:var(--success);font-weight:600">'+(rev>0?this.formatCurrency(rev):'—')+'</td>'
                        +'<td style="text-align:right">'+this.formatCurrency(dep)+'</td>'
                        +'<td style="text-align:right;font-weight:700;'+(cf===null?'':'color:'+(cf>=0?'var(--success)':'var(--danger)'))+'">'+( cf!==null?(cf>=0?'+':'')+this.formatCurrency(cf):'—')+'</td>'
                        +'<td style="text-align:right;font-weight:700;'+txC+'">'+(tx!==null?tx+'%':'—')+'</td>'
                        +'</tr>';
                }).join('')}
                </tbody>
            </table>
        </div>

        <!-- Synthèse narrative -->
        <div style="padding:1rem;background:linear-gradient(135deg,rgba(63,81,181,.06),rgba(124,58,237,.04));border-radius:14px;border:1px solid rgba(63,81,181,.12);color:var(--text-secondary);line-height:1.7;font-size:.85rem">
            💬 <strong>Synthèse ${annee} :</strong>
            ${totalRevenuAnnuel > 0 ? 'Revenus : <strong>'+this.formatCurrency(totalRevenuAnnuel)+'</strong>. ' : ''}
            Dépenses effectives : <strong>${this.formatCurrency(totalDepEff)}</strong>${totalVirEpargne > 0 ? ' + <strong>'+this.formatCurrency(totalVirEpargne)+'</strong> virés vers l\'épargne' : ''}.
            ${epargneNette > 0 ? 'Épargne nette : <strong style="color:var(--success)">'+this.formatCurrency(epargneNette)+'</strong>'+(txEpargne!==null?' (taux : <strong>'+txEpargne.toFixed(0)+'%</strong>)':'')+'. ' : ''}
            ${catMax ? 'Poste principal : <strong>'+catMax[0]+'</strong> ('+this.formatCurrency(catMax[1])+'). ' : ''}
            ${patAnnee.length >= 2 ? 'Patrimoine : <strong style="color:'+(patDelta>=0?'var(--success)':'var(--danger)')+'">'+(patDelta>=0?'+':'')+this.formatCurrency(patDelta)+'</strong> sur l\'année.' : ''}
        </div>
        </div>`;
    },

    exportBilanPDF(annee) {
        const el = document.getElementById('bilan-annuel-print');
        if (!el) { this.notify('Génère d\'abord le bilan', 'warning'); return; }
        const y = annee || new Date().getFullYear();
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bilan ${y}</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=DM+Mono&family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                *{box-sizing:border-box}
                body{margin:2rem;font-family:'Inter',sans-serif;background:#fff;color:#1e3a5f;font-size:13px}
                h1{font-family:'Outfit',sans-serif;font-size:1.8rem;font-weight:800;color:#1e3a5f;margin:0 0 .25rem}
                .label{font-family:'DM Mono',monospace;font-size:.55rem;text-transform:uppercase;letter-spacing:.08em;color:#7891ab;margin-bottom:.3rem;display:block}
                .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:1rem}
                .grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1rem}
                .card{background:#f5f9fc;border-radius:10px;padding:.85rem;text-align:center}
                .big{font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:800}
                .row{display:flex;justify-content:space-between;align-items:center;padding:.55rem .75rem;background:#f5f9fc;border-radius:8px;margin-bottom:.35rem;font-size:.8rem}
                .bar-wrap{height:5px;background:#e8edf2;border-radius:100px;overflow:hidden;flex:1;margin:0 .5rem}
                .bar-fill{height:100%;background:linear-gradient(90deg,#3f51b5,#7c4dff);border-radius:100px}
                table{width:100%;border-collapse:collapse;font-size:.75rem}
                th{font-family:'DM Mono',monospace;font-size:.55rem;text-transform:uppercase;color:#7891ab;padding:.5rem;text-align:left;border-bottom:1px solid #e8edf2}
                td{padding:.45rem .5rem;border-bottom:1px solid #f0f4f8}
                .footer{text-align:center;font-family:'DM Mono',monospace;font-size:.55rem;color:#a0aec0;margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e8edf2}
                button{display:none!important}
                @media print{body{margin:.5cm}@page{margin:.5cm}}
            </style>
            </head><body>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:2px solid #e8edf2">
                <div>
                    <span class="label">Bilan financier personnel</span>
                    <h1>${y}</h1>
                </div>
                <div style="text-align:right;font-family:'DM Mono',monospace;font-size:.65rem;color:#7891ab">Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
            </div>
            ${el.innerHTML}
            <div class="footer">Document généré automatiquement — Suivi Financier Personnel · ${y}</div>
            <script>window.onload=()=>window.print()<\/script></body></html>`);
        w.document.close();
    },

    initRapportSelect() {
        const moisDispo = [...new Set(this.data.depenses.map(d => d.date.slice(0,7)))].sort().reverse();
        const sel = document.getElementById('rapport-mois');
        if (!sel) return;
        const now = new Date().toISOString().slice(0,7);
        sel.innerHTML = moisDispo.map(m => `<option value="${m}" ${m === now ? 'selected' : ''}>${m}</option>`).join('');
    },
    genererRapport() {
        const mois = document.getElementById('rapport-mois')?.value;
        const container = document.getElementById('rapport-container');
        if (!container || !mois) return;
        const [yearS, monthS] = mois.split('-');
        const year = parseInt(yearS), month = parseInt(monthS) - 1;
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];

        const deps = this.data.depenses.filter(d => d.date.startsWith(mois));

        const depsEff = deps.filter(d => !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())));
        const depsEp  = deps.filter(d => exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())));
        const total = depsEff.reduce((s,d) => s+d.montant, 0);
        const totalVirEp = depsEp.reduce((s,d) => s+d.montant, 0);
        const totalBrut = deps.reduce((s,d) => s+d.montant, 0);

        const { total: revenus, source } = this.getRevenusMois(year, month);
        const cashflow = revenus > 0 ? revenus - total : null;
        const tauxEp = revenus > 0 ? ((revenus - total) / revenus * 100) : null;

        const budgetTotal = Object.entries(this.data.budgets || {})
            .filter(([cat,v]) => v > 0 && !exclus.some(e => cat.toUpperCase().includes(e.toUpperCase())))
            .reduce((s,[,v]) => s+v, 0);
        const resteBudget = budgetTotal > 0 ? budgetTotal - total : null;

        const parCat = {};
        depsEff.forEach(d => parCat[d.categorie] = (parCat[d.categorie] || 0) + d.montant);
        const catsSorted = Object.entries(parCat).sort((a,b) => b[1]-a[1]);
        const maxCat = catsSorted[0]?.[1] || 1;
        const moisLabel = new Date(mois + '-01').toLocaleDateString('fr-FR', {month:'long',year:'numeric'});
        const obj = this.data.objectifs || [];
        const peaList = this.data.suiviPEA || [];
        const peaLast = peaList.filter(p => p.date.startsWith(mois)).pop() || peaList[peaList.length - 1];
        document.getElementById('btn-imprimer').style.display = 'inline-flex';
        container.innerHTML = `
        <div id="rapport-print" style="background:white;border-radius:16px;padding:2rem;border:1px solid var(--border-color)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #e8edf2">
                <div>
                    <div style="font-family:DM Mono,monospace;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:#7891ab">Bilan financier</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.6rem;font-weight:800;color:#1e3a5f">${moisLabel.charAt(0).toUpperCase()+moisLabel.slice(1)}</div>
                </div>
                <div style="text-align:right">
                    <div style="font-family:'Outfit',sans-serif;font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#3f51b5,#7c4dff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${this.formatCurrency(total)}</div>
                    <div style="font-family:DM Mono,monospace;font-size:0.7rem;color:var(--text-primary)">${resteBudget >= 0 ? '✅' : '⚠️'} ${resteBudget >= 0 ? '+' : ''}${this.formatCurrency(resteBudget)} vs budget</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(${revenus>0?4:3},1fr);gap:0.6rem;margin-bottom:1.5rem">
                ${[
                    revenus > 0 ? ['Revenus', this.formatCurrency(revenus), source==='salaire' ? '#7891ab' : '#00c853'] : null,
                    ['Dépenses eff.', this.formatCurrency(total), '#1e3a5f'],
                    cashflow !== null ? ['Cashflow', (cashflow>=0?'+':'')+this.formatCurrency(cashflow), cashflow>=0?'#00c853':'#f44336'] : null,
                    tauxEp !== null ? ['Taux épargne', tauxEp.toFixed(0)+'%', tauxEp>=20?'#00c853':tauxEp>=10?'#f59e0b':'#f44336'] : null,
                ].filter(Boolean).map(([l,v,clr]) => `<div style="background:#f5f9fc;border-radius:12px;padding:0.75rem;text-align:center">
                    <div style="font-family:DM Mono,monospace;font-size:0.55rem;text-transform:uppercase;letter-spacing:0.08em;color:#7891ab">${l}</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1rem;font-weight:700;color:${clr}">${v}</div>
                </div>`).join('')}
            </div>
            ${resteBudget !== null ? `<div style="margin-bottom:1.25rem;font-family:DM Mono,monospace;font-size:0.7rem;color:var(--text-primary);text-align:right">${resteBudget>=0?'✅':'⚠️'} ${resteBudget>=0?'+':''}${this.formatCurrency(resteBudget)} vs budget alloué</div>` : ''}
            ${totalVirEp > 0 ? `<div style="background:#f0fdf4;border-radius:10px;padding:.65rem 1rem;margin-bottom:1.25rem;border:1px solid #bbf7d0;font-size:.8rem;color:#166534">
                💰 Virements épargne ce mois : <strong>${this.formatCurrency(totalVirEp)}</strong>
            </div>` : ''}
            ${catsSorted.length > 0 ? `<div style="margin-bottom:1.5rem">
                <div style="font-family:DM Mono,monospace;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:#7891ab;margin-bottom:0.75rem">Répartition par catégorie</div>
                ${catsSorted.map(([cat, val]) => `<div style="margin-bottom:0.5rem">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.2rem">
                        <span style="font-size:0.85rem;color:#2d3748">${cat}</span>
                        <span style="font-family:DM Mono,monospace;font-size:0.72rem;color:#4a6785">${this.formatCurrency(val)} (${((val/total)*100).toFixed(0)}%)</span>
                    </div>
                    <div style="height:6px;background:#e8edf2;border-radius:100px;overflow:hidden">
                        <div style="width:${((val/maxCat)*100).toFixed(0)}%;height:100%;background:linear-gradient(90deg,#3f51b5,#7c4dff);border-radius:100px"></div>
                    </div>
                </div>`).join('')}
            </div>` : ''}
            ${peaLast ? `<div style="background:#f5f9fc;border-radius:12px;padding:1rem;margin-bottom:1.5rem;border:1px solid #d4e2ed">
                <div style="font-family:DM Mono,monospace;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:#7891ab;margin-bottom:0.5rem">PEA</div>
                <div style="display:flex;justify-content:space-between;font-size:0.85rem">
                    <span>Valeur : <strong>${this.formatCurrency(peaLast.valeur)}</strong></span>
                    <span style="color:${parseFloat(peaLast.performance)>=0?'#00c853':'#f44336'}">Perf : ${peaLast.performance}%</span>
                </div>
            </div>` : ''}
            ${obj.length > 0 ? `<div style="margin-bottom:1.5rem">
                <div style="font-family:DM Mono,monospace;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:#7891ab;margin-bottom:0.75rem">Objectifs en cours</div>
                ${obj.map(o => { const pct = Math.min(100,(o.actuel/o.cible)*100).toFixed(0); return `<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
                    <span style="font-size:1.1rem">${o.emoji}</span>
                    <div style="flex:1">
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.2rem">
                            <span style="font-size:0.85rem">${o.nom}</span>
                            <span style="font-family:DM Mono,monospace;font-size:0.7rem;color:#4a6785">${pct}%</span>
                        </div>
                        <div style="height:5px;background:#e8edf2;border-radius:100px;overflow:hidden">
                            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#3f51b5,#7c4dff);border-radius:100px"></div>
                        </div>
                    </div>
                </div>`; }).join('')}
            </div>` : ''}
            <div style="text-align:center;font-family:DM Mono,monospace;font-size:0.6rem;color:#a0aec0;padding-top:1rem;border-top:1px solid #e8edf2">Généré le ${new Date().toLocaleDateString('fr-FR')} — Suivi Financier</div>
        </div>`;
        this.notify('Rapport généré ✓', 'success');
    },
    imprimerRapport() {
        const el = document.getElementById('rapport-print');
        if (!el) return;
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rapport</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=DM+Mono&family=Crimson+Pro&display=swap" rel="stylesheet">
            <style>body{margin:1.5rem;font-family:'Crimson Pro',serif}@media print{body{margin:0}}</style>
            </head><body>${el.outerHTML}<script>window.onload=()=>window.print()<\/script></body></html>`);
        w.document.close();
    },

    _helpContent: {
        dashboard: {
            title: '🏠 Dashboard',
            body: `
<p style="margin-bottom:.85rem;color:var(--text-secondary);font-size:.8rem">Le Dashboard est ta <strong>vue d'ensemble instantanée</strong>. Voici le rôle de chaque carte, dans l'ordre où elles apparaissent.</p>
<div style="display:flex;flex-direction:column;gap:.65rem">

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">💎 Patrimoine Net</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> total de tous tes comptes du dernier mois saisi, et le taux d'épargne moyen sur 12 mois.<br>
    <strong>Taux d'épargne · 12 mois :</strong> moyenne de (Revenus − Dépenses) / Revenus sur les 12 derniers mois. Vert ≥ 20%, orange ≥ 10%, rouge &lt; 10%.<br>
    <strong>À surveiller :</strong> si le taux baisse mois après mois, tu dépenses plus que tu ne gagnes.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">📅 Ce mois vs mois dernier</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> dépenses du mois courant vs mois précédent, et l'état de ton PEA (valeur + plus-value).<br>
    <strong>À faire :</strong> si la variation est défavorable, identifie la catégorie responsable dans l'onglet Dépenses → État des catégories.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">📆 Récap de la semaine</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> résumé automatique des dépenses des 7 derniers jours — total, catégories touchées et comparaison avec la semaine précédente.<br>
    <strong>Score :</strong> emoji récapitulatif selon l'intensité de dépenses. Utile pour surveiller les petites dépenses du quotidien.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">⚡ Accès Rapide</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> raccourcis vers les actions fréquentes (saisir une dépense, ajouter un revenu, mettre à jour le PEA, ajouter au patrimoine).<br>
    <strong>Saisir dépense :</strong> bascule directement sur l'onglet Dépenses et ouvre la bottom sheet de saisie.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--warning)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--warning);font-weight:700;margin-bottom:.25rem">🔔 Alertes Intelligentes</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> alertes triées par priorité — rouge = urgent, orange = attention, vert = bonne nouvelle.<br>
    <strong>Types :</strong> fonds d'urgence insuffisant 🛡️, taux d'épargne faible 📉, dépassement de budget 💸, dépense inhabituelle 🔍.<br>
    <strong>Astuce :</strong> la carte s'ouvre automatiquement s'il y a une alerte urgente.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--success)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--success);font-weight:700;margin-bottom:.25rem">Évolution Patrimoine</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> courbe de ton patrimoine total mois par mois, alimentée par tes saisies dans l'onglet Patrimoine.<br>
    <strong>À analyser :</strong> la tendance doit être haussière. Un creux peut venir d'une dépense exceptionnelle ou d'une correction de marché (PEA).</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">Répartition</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> graphe en anneau montrant la part de chaque compte dans ton patrimoine total (dernier mois saisi).<br>
    <strong>Personnaliser :</strong> clique 🎨 Couleurs pour attribuer une couleur à chaque compte.<br>
    <strong>À analyser :</strong> trop concentré sur un seul compte peut indiquer un déséquilibre entre liquidités et investissements.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">Dépenses : Réel vs Budget</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> graphe à barres comparant ce que tu as dépensé vs le budget fixé pour chaque catégorie.<br>
    <strong>Exclusions :</strong> catégories sans budget (0€) et catégories épargne n'apparaissent pas ici.<br>
    <strong>À analyser :</strong> une barre "Dépensé" qui dépasse "Budget" signale un dépassement à surveiller.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">🌡 Heatmap annuelle</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> une case par mois, colorée selon le montant dépensé. Plus c'est foncé, plus tu as dépensé.<br>
    <strong>À analyser :</strong> repère les mois sombres (fêtes, vacances, rentrée) pour mieux les anticiper l'année suivante.<br>
    <strong>Note :</strong> la couleur est relative à ton maximum annuel, pas à un seuil fixe.</p>
  </div>

</div>`
        },
        depenses: {
            title: '💸 Dépenses',
            body: `
<p style="margin-bottom:.85rem;color:var(--text-secondary);font-size:.8rem">Onglet central de ta gestion quotidienne. Chaque carte dans l'ordre d'apparition.</p>
<div style="display:flex;flex-direction:column;gap:.65rem">

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">💳 Soldes bancaires</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> le solde total de tous tes comptes bancaires en un coup d'œil.<br>
    <strong>Voir le détail :</strong> clique sur la flèche ▾ à droite du montant pour afficher / masquer le détail compte par compte.<br>
    <strong>Ajouter un compte :</strong> bouton "+ Compte" en haut à droite — saisis le nom, le type (Courant, Épargne…) et le solde initial à une date donnée. Vault recalcule ensuite le solde automatiquement en ajoutant tes revenus et en retranchant tes dépenses liées à ce compte.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--success)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--success);font-weight:700;margin-bottom:.25rem">💰 Revenu</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> total des revenus saisis pour le mois, avec le détail des saisies (Salaire, Prime, Locatif…).<br>
    <strong>Comment saisir :</strong> clique <em>＋ Ajouter</em>, entre le montant et le type. Tu peux en ajouter plusieurs dans le même mois.<br>
    <strong>Important :</strong> si aucun revenu saisi ce mois, le salaire paramétré dans ⚙ est utilisé automatiquement comme valeur de référence.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">➕ Dépense</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on fait :</strong> saisit une nouvelle dépense avec sa catégorie, son montant, sa date et une note optionnelle.<br>
    <strong>⚙ Catégories :</strong> crée ou supprime des catégories, fixe leur budget mensuel. Budget = 0 → catégorie "sans budget" (ex : Vacances), exclue du graphe Réel vs Budget.<br>
    <strong>🏦 Import relevé bancaire :</strong> glisse le CSV de ta banque (Boursorama, BNP, CA…). L'app détecte les montants et propose une catégorie automatique. Tu valides avant d'importer.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">État des catégories</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> progression de chaque catégorie par rapport à son budget mensuel — barre de progression + montant restant.<br>
    <strong>À analyser :</strong> les catégories en rouge ont dépassé leur budget. Clique sur la carte pour la déplier.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">📊 Comparaison mois à mois</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> deux mois côte à côte pour comparer tes dépenses par catégorie.<br>
    <strong>Utilité :</strong> détecte les catégories qui dérivent dans le temps. Clique sur le titre pour déplier.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--warning)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--warning);font-weight:700;margin-bottom:.25rem">⚖️ Règle 50 / 30 / 20</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> tes dépenses du mois ventilées en 3 compartiments : Besoins (≤50%), Envies (≤30%), Épargne (≥20%).<br>
    <strong>Classification auto :</strong> Besoins = Loyer, Transport, Santé… Envies = Loisirs, Restaurant, Shopping…<br>
    <strong>🏷 Bouton Classifier :</strong> force manuellement la classification d'une catégorie si l'auto ne convient pas. Un badge "forcé" s'affiche sur les catégories modifiées.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">🔄 Dépenses Récurrentes</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> tes charges fixes paramétrées (abonnements, loyer, assurances…) avec leur montant mensuel total.<br>
    <strong>Ajouter :</strong> clique "＋ Récurrence" pour enregistrer une charge fixe — elle apparaît ici chaque mois sans avoir à la resaisir.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--success)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--success);font-weight:700;margin-bottom:.25rem">🔍 Analyse des dépenses</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> tableau détaillé avec total, moyenne mensuelle et % du total par catégorie sur la période choisie (mois, année, plage de dates).<br>
    <strong>Utilité :</strong> repère les catégories qui représentent le plus dans ton budget sur le long terme.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">📋 Historique</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> liste de toutes tes dépenses, des plus récentes aux plus anciennes.<br>
    <strong>Filtres :</strong> par mois, par catégorie, ou par mot-clé dans la note (ex : "Netflix", "Carrefour").<br>
    <strong>🕐 Ordre :</strong> bascule entre "Récent → Ancien" (défaut) et "Ancien → Récent" d'un clic.<br>
    <strong>Astuce :</strong> clique ✕ pour effacer tous les filtres d'un coup.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">📊 Historique Revenus</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> tableau des 24 derniers mois avec revenus, dépenses, cashflow et taux d'épargne mois par mois.<br>
    <strong>Utilité :</strong> suivi de l'évolution de ta santé financière dans le temps, utilisable comme justificatif.<br>
    <strong>Astuce :</strong> les mois avec "(param.)" indiquent que le salaire paramétré a été utilisé comme fallback.</p>
  </div>

</div>`
        },
        pea: {
            title: '📈 PEA',
            body: `
<p style="margin-bottom:.85rem;color:var(--text-secondary);font-size:.8rem">Suivi de ton Plan d'Épargne en Actions. Chaque carte dans l'ordre d'apparition.</p>
<div style="display:flex;flex-direction:column;gap:.65rem">

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">Stat-cards (Valeur · Investi · Gain/Perte)</div>
    <p style="font-size:.79rem;margin:0"><strong>Valeur PEA :</strong> dernier solde total saisi.<br>
    <strong>Total Investi :</strong> cumul de tes versements.<br>
    <strong>Gain/Perte :</strong> Valeur − Investi. Positif = portefeuille dans le vert. La performance en % s'affiche juste en dessous.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--success)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--success);font-weight:700;margin-bottom:.25rem">Mise à jour PEA</div>
    <p style="font-size:.79rem;margin:0"><strong>Manuel :</strong> saisis la valeur totale du PEA + montant investi cumulé pour une date donnée.<br>
    <strong>Import CSV :</strong> importe un fichier au format Date, Valeur, Investi pour alimenter l'historique en masse.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">📋 Lignes du Portefeuille & Plus-values</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on fait :</strong> ajoute chaque ligne (ETF, action) avec son ticker, nombre de parts et prix d'achat (PRU).<br>
    <strong>Actualiser les cours :</strong> si tu as une clé API Finnhub dans ⚙, le bouton récupère les cours en temps réel et recalcule la plus-value latente.<br>
    <strong>Sans Finnhub :</strong> entre le prix actuel manuellement — la performance reste calculée.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--warning)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--warning);font-weight:700;margin-bottom:.25rem">Évolution PEA : Valeur vs Investi</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> deux courbes superposées — la valeur de marché et le total investi mois par mois.<br>
    <strong>À analyser :</strong> l'écart entre les deux courbes = ta plus-value latente. Les creux sont normaux sur le long terme.<br>
    <strong>Boutons :</strong> 📊 Benchmark ajoute une courbe de référence (MSCI World). 🧮 Outils affiche des simulations.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">👴 Projection Retraite</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on fait :</strong> simule la valeur de ton PEA à l'âge de la retraite selon ton âge actuel, tes versements mensuels et un taux de rendement estimé.<br>
    <strong>Utilité :</strong> visualise l'impact des intérêts composés sur le long terme et ajuste ta stratégie d'épargne en conséquence.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">🎲 Simulateur "Et si…"</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on fait :</strong> compare plusieurs scénarios d'épargne côte à côte — que se passe-t-il si tu verses 50€ de plus par mois, ou si le marché fait +5% au lieu de +7% ?<br>
    <strong>Note :</strong> la performance affichée est la plus-value brute cumulée, pas un TRI annualisé.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">📋 Historique PEA</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> toutes tes saisies PEA classées par date (valeur + montant investi).<br>
    <strong>Utilité :</strong> modifie ou supprime une entrée erronée directement depuis ce tableau.</p>
  </div>

</div>`
        },
        patrimoine: {
            title: '🏦 Patrimoine',
            body: `
<p style="margin-bottom:.85rem;color:var(--text-secondary);font-size:.8rem">Suivi mensuel de toute ta richesse nette. Chaque carte dans l'ordre d'apparition.</p>
<div style="display:flex;flex-direction:column;gap:.65rem">

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">Stat-cards (Total · Épargne sécurisée · Investissements)</div>
    <p style="font-size:.79rem;margin:0"><strong>Total :</strong> somme de tous tes comptes du dernier mois saisi.<br>
    <strong>Épargne sécurisée :</strong> somme des comptes cochés 🛡️ (Livret A, LEP, CC…).<br>
    <strong>Investissements :</strong> somme des comptes non cochés 🛡️ (PEA, CTO, immobilier…).</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">Répartition du patrimoine</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> barre de répartition visuelle entre liquidités (🛡️) et investissements, avec les montants de chaque côté.<br>
    <strong>À analyser :</strong> assure-toi d'avoir un fonds d'urgence suffisant (3 à 6 mois de dépenses) en liquidités avant de sur-investir.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--success)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--success);font-weight:700;margin-bottom:.25rem">Mise à jour</div>
    <p style="font-size:.79rem;margin:0"><strong>Quand saisir :</strong> idéalement en fin de mois, après tous tes virements.<br>
    <strong>Comment :</strong> sélectionne une date, entre le solde de chaque compte, puis clique "+ Enregistrer".<br>
    <strong>✦ Gérer les comptes :</strong> ajoute ou supprime des comptes. Coche 🛡️ sur les comptes liquides (disponibles immédiatement) — utilisé pour le calcul du fonds d'urgence dans les Alertes.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--warning)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--warning);font-weight:700;margin-bottom:.25rem">Évolution du Patrimoine</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> courbe d'évolution du patrimoine total mois par mois.<br>
    <strong>À analyser :</strong> la pente doit être positive sur le long terme. Un mois négatif peut venir d'une dépense exceptionnelle ou d'une baisse des marchés (PEA).</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">📋 Historique Patrimoine</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> tableau de toutes tes saisies mensuelles, compte par compte, avec le total.<br>
    <strong>Astuce :</strong> coche 🛡️ uniquement sur les comptes <strong>immédiatement disponibles</strong> sans pénalité. Cible fonds d'urgence : 3 à 6 mois de dépenses.</p>
  </div>

</div>`
        },
        bilan: {
            title: '📋 Bilan',
            body: `
<p style="margin-bottom:.85rem;color:var(--text-secondary);font-size:.8rem">L'onglet qui centralise tous tes récapitulatifs. Chaque carte dans l'ordre d'apparition.</p>
<div style="display:flex;flex-direction:column;gap:.65rem">

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">🏅 Bilan annuel</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> Revenus totaux, Dépenses effectives, Épargne nette, Taux d'épargne, tableau mois par mois et top catégories.<br>
    <strong>Calcul :</strong> revenus = données saisies dans Dépenses (ou salaire en fallback). Dépenses effectives = hors catégories épargne.<br>
    <strong>Export PDF :</strong> bouton "🖨 Exporter PDF" → page imprimable utilisable comme justificatif bancaire.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--success)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--success);font-weight:700;margin-bottom:.25rem">📄 Rapport mensuel</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> rapport mis en page pour un mois donné — revenus, cashflow, taux d'épargne, dépenses par catégorie, PEA, objectifs.<br>
    <strong>Comment générer :</strong> sélectionne un mois → clique "Générer" → clique "🖨 Imprimer" → dans le navigateur, choisis "Enregistrer en PDF".</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">🎯 Objectifs</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> tes objectifs d'épargne avec progression, montant cible, échéance et effort mensuel requis.<br>
    <strong>Comment ça marche :</strong> clique "+ Nouvel objectif", entre le nom, montant cible, montant actuel et date cible. L'app calcule combien mettre de côté par mois pour y arriver.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--text-tertiary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--text-tertiary);font-weight:700;margin-bottom:.25rem">📝 Notes Mensuelles</div>
    <p style="font-size:.79rem;margin:0"><strong>Usage :</strong> note les événements importants du mois (achat exceptionnel, changement de situation, augmentation de salaire…).<br>
    <strong>Tag :</strong> classe ta note (Général, Dépense exceptionnelle, Revenu exceptionnel, Objectif atteint…) pour mieux filtrer plus tard.<br>
    <strong>Intérêt :</strong> dans 2 ans, ces notes t'expliqueront les anomalies dans tes chiffres.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">Historique des notes</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce qu'on voit :</strong> toutes tes notes mensuelles classées par date.<br>
    <strong>Utilité :</strong> consulte l'historique pour comprendre le contexte d'un mois particulier en relisant tes bilans.</p>
  </div>

</div>`
        },
        parametres: {
            title: '⚙️ Paramètres',
            body: `
<p style="margin-bottom:.85rem;color:var(--text-secondary);font-size:.8rem">Configure l'app ici. La plupart des réglages n'ont besoin d'être faits qu'une seule fois.</p>
<div style="display:flex;flex-direction:column;gap:.65rem">

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-primary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-primary);font-weight:700;margin-bottom:.25rem">🎨 Préférences</div>
    <p style="font-size:.79rem;margin:0"><strong>Thème :</strong> plusieurs thèmes disponibles — clairs (Aurora, Brume, Horizon, Aqua) et sombres (Aurora, Abyss, Obsidian, Arctic) + Auto (suit le système OS).<br>
    <strong>Salaire net mensuel :</strong> valeur de référence utilisée comme <em>fallback</em> si aucun revenu n'est saisi pour un mois donné. Utilisé dans le bilan annuel, les alertes et la règle 50/30/20.<br>
    <strong>Important :</strong> si tu saisis tes revenus réels dans l'onglet Dépenses, ce salaire est ignoré pour ce mois-là.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--success)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--success);font-weight:700;margin-bottom:.25rem">📈 Données PEA</div>
    <p style="font-size:.79rem;margin:0"><strong>Clé API Finnhub :</strong> récupère les cours boursiers en temps réel pour actualiser la valeur de tes positions PEA.<br>
    <strong>Comment obtenir :</strong> va sur <em>finnhub.io</em>, crée un compte gratuit, copie ta clé API.<br>
    <strong>Sans clé :</strong> tu peux utiliser le PEA normalement — entre juste les prix manuellement.<br>
    <strong>Limite :</strong> clé gratuite = 60 requêtes/min, suffisant pour un portefeuille standard.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--accent-secondary)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--accent-secondary);font-weight:700;margin-bottom:.25rem">💾 Sauvegarde & Export</div>
    <p style="font-size:.79rem;margin:0"><strong>Exporter en Excel :</strong> sauvegarde locale complète (dépenses, revenus, PEA, patrimoine…). Fais-le régulièrement en plus de la sync cloud.<br>
    <strong>Restaurer depuis Excel :</strong> restaure une sauvegarde précédente.<br>
    <strong>Sync Supabase :</strong> tes données sont synchronisées en temps réel — si tu ouvres l'app sur un autre appareil avec le même compte, tout est là.</p>
  </div>

  <div style="background:var(--bg-card);border-radius:12px;padding:.85rem 1rem;border-left:3px solid var(--danger)">
    <div style="font-family:DM Mono,monospace;font-size:.65rem;text-transform:uppercase;color:var(--danger);font-weight:700;margin-bottom:.25rem">⚠️ Zone de danger</div>
    <p style="font-size:.79rem;margin:0"><strong>Ce que ça fait :</strong> supprime <strong>toutes tes données</strong> (dépenses, revenus, PEA, patrimoine, objectifs, notes) de façon <strong>irréversible</strong>.<br>
    <strong>Avant de cliquer :</strong> fais impérativement un export Excel via le bouton Sauvegarde & Export.</p>
  </div>

</div>`
        }
    },

        openHelp(tabName) {
        const tab = tabName === 'current' ? (this._currentTab || 'dashboard') : tabName;
        const content = this._helpContent[tab] || this._helpContent['dashboard'];
        const panel = document.getElementById('help-panel');
        const overlay = document.getElementById('help-overlay');
        const title = document.getElementById('help-title');
        const body = document.getElementById('help-content');
        if (!panel) return;
        title.textContent = content.title;
        body.innerHTML = content.body;
        panel.style.left = '0';
        overlay.style.display = 'block';
    },

    closeHelp() {
        const panel = document.getElementById('help-panel');
        const overlay = document.getElementById('help-overlay');
        if (panel) panel.style.left = '-480px';
        if (overlay) overlay.style.display = 'none';
    },

    toggleAlertes() {
        const body = document.getElementById('alertes-body');
        const arrow = document.getElementById('alertes-arrow');
        if (!body) return;
        const isOpen = body.style.display === 'none' || body.style.display === '';
        body.style.display = isOpen ? 'block' : 'none';
        if (arrow) arrow.style.transform = isOpen ? 'rotate(90deg)' : '';
    },

    setHistRevMode(mode) {
        this.data.parametres = this.data.parametres || {};
        this.data.parametres.histRevMode = mode;
        this.save();
        ['tableau','timeline','cards'].forEach(m => {
            const btn = document.getElementById('hist-rev-btn-' + m);
            if (btn) btn.classList.toggle('active', m === mode);
        });
        this.refreshHistoriqueRevenus();
    },

    refreshHistoriqueRevenus() {
        const container = document.getElementById('historique-revenus-container');
        if (!container) return;
        const mode = (this.data.parametres && this.data.parametres.histRevMode) || 'tableau';
        // sync buttons
        ['tableau','timeline','cards'].forEach(m => {
            const btn = document.getElementById('hist-rev-btn-' + m);
            if (btn) btn.classList.toggle('active', m === mode);
        });
        const now = new Date();
        const moisSet = new Set([
            ...this.data.depenses.map(d => d.date.slice(0,7)),
            ...this.data.revenus.map(r => r.mois || r.date.slice(0,7))
        ]);
        const moisList = [...moisSet].sort().reverse().slice(0, 24);
        if (moisList.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:1.5rem"><div class="empty-state-icon">📊</div><div>Aucune donnée disponible</div></div>';
            return;
        }
        const rows = moisList.map(mois => {
            const [y, m] = mois.split('-').map(Number);
            const year = y, month = m - 1;
            const { total: revenus, source } = this.getRevenusMois(year, month);
            const depEffectives = this.getDepEffectives(year, month);
            const cashflow = revenus > 0 ? revenus - depEffectives : null;
            const tauxEp = revenus > 0 ? ((revenus - depEffectives) / revenus * 100) : null;
            const label = new Date(year, month, 1).toLocaleDateString('fr-FR', { month:'long', year:'numeric' });
            const labelShort = new Date(year, month, 1).toLocaleDateString('fr-FR', { month:'short', year:'numeric' });
            const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
            const flagColor = tauxEp === null ? 'var(--text-tertiary)' : tauxEp >= 20 ? 'var(--success)' : tauxEp >= 10 ? 'var(--warning,#f59e0b)' : 'var(--danger)';
            const detailRevenus = this.data.revenus.filter(r => (r.mois || r.date.slice(0,7)) === mois).sort((a,b) => b.date.localeCompare(a.date));
            return { mois, label, labelShort, revenus, depEffectives, cashflow, tauxEp, source, isCurrentMonth, flagColor, detailRevenus };
        });
        if (mode === 'tableau')  container.innerHTML = this._histRevTableau(rows);
        if (mode === 'timeline') container.innerHTML = this._histRevTimeline(rows);
        if (mode === 'cards')    container.innerHTML = this._histRevCards(rows);
    },

    _histRevDetailList(revs) {
        if (!revs || revs.length === 0) return '<div style="color:var(--text-tertiary);font-size:.72rem;padding:.4rem 0 .2rem">Aucun revenu saisi ce mois</div>';
        return revs.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid var(--border-color)">
                <div>
                    <span style="font-size:.72rem;font-weight:600;color:var(--text-primary)">${r.type || '—'}</span>
                    ${r.note ? `<span style="font-size:.67rem;color:var(--text-tertiary);margin-left:.4rem">${r.note}</span>` : ''}
                    <div style="font-size:.63rem;color:var(--text-tertiary);font-family:'DM Mono',monospace">${r.date}</div>
                </div>
                <div style="display:flex;align-items:center;gap:.5rem">
                    <span style="font-size:.82rem;font-weight:700;color:var(--success)">+${this.formatCurrency(r.montant)}</span>
                    <button onclick="app.supprimerRevenu(${r.id})" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:.65rem;padding:.1rem .25rem;opacity:.6" title="Supprimer">✕</button>
                </div>
            </div>`).join('');
    },

    _histRevTableau(rows) {
        return `<div class="table-container">
            <table class="table" style="font-size:.8rem">
                <thead><tr>
                    <th>Mois</th>
                    <th style="text-align:right">Revenus</th>
                    <th style="text-align:right">Dépenses</th>
                    <th style="text-align:right">Cashflow</th>
                    <th style="text-align:right">Taux épargne</th>
                    <th style="width:32px"></th>
                </tr></thead>
                <tbody>
                ${rows.map(r => `
                    <tr class="hist-rev-row" style="${r.isCurrentMonth ? 'background:rgba(var(--heatmap-rgb),.05);' : ''}" onclick="app._toggleHistRevDetail('${r.mois}')">
                        <td style="font-family:'DM Mono',monospace;font-size:.72rem;font-weight:${r.isCurrentMonth?'700':'400'}">
                            ${r.labelShort}${r.isCurrentMonth ? ' <span style="font-size:.58rem;color:var(--warning)">●</span>' : ''}
                        </td>
                        <td style="text-align:right;color:var(--success);font-weight:600">
                            ${r.revenus > 0 ? this.formatCurrency(r.revenus) : '<span style="color:var(--text-tertiary)">—</span>'}
                            ${r.source === 'salaire' ? '<span style="font-size:.55rem;color:var(--text-tertiary)"> param.</span>' : ''}
                            ${r.detailRevenus.length > 0 ? `<span style="font-size:.6rem;color:var(--accent-primary);margin-left:.3rem">${r.detailRevenus.length}</span>` : ''}
                        </td>
                        <td style="text-align:right">${this.formatCurrency(r.depEffectives)}</td>
                        <td style="text-align:right;font-weight:700;color:${r.cashflow===null?'var(--text-tertiary)':r.cashflow>=0?'var(--success)':'var(--danger)'}">
                            ${r.cashflow !== null ? (r.cashflow >= 0 ? '+' : '') + this.formatCurrency(r.cashflow) : '—'}
                        </td>
                        <td style="text-align:right;font-weight:700;color:${r.flagColor}">
                            ${r.tauxEp !== null ? r.tauxEp.toFixed(0) + ' %' : '—'}
                        </td>
                        <td style="text-align:center;color:var(--text-tertiary);font-size:.7rem" id="hist-rev-arrow-${r.mois}">›</td>
                    </tr>
                    <tr id="hist-rev-detail-${r.mois}" style="display:none">
                        <td colspan="6" style="padding:.5rem 1rem .75rem 2rem;background:var(--bg-secondary)">
                            <div style="font-size:.65rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);margin-bottom:.35rem">Revenus saisis</div>
                            ${this._histRevDetailList(r.detailRevenus)}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top:.6rem;font-size:.65rem;color:var(--text-tertiary);font-family:'DM Mono',monospace">Cliquez sur un mois pour voir le détail des revenus</div>`;
    },

    _toggleHistRevDetail(mois) {
        const row = document.getElementById('hist-rev-detail-' + mois);
        const arrow = document.getElementById('hist-rev-arrow-' + mois);
        if (!row) return;
        const open = row.style.display === 'none' || row.style.display === '';
        row.style.display = open ? 'table-row' : 'none';
        if (arrow) arrow.textContent = open ? '↓' : '›';
    },

    _histRevTimeline(rows) {
        return `<div class="hist-rev-timeline">
        ${rows.map((r, i) => {
            const barW = r.revenus > 0 ? Math.min(100, (r.depEffectives / r.revenus) * 100) : 0;
            const barColor = r.cashflow === null ? 'var(--text-tertiary)' : r.cashflow >= 0 ? 'var(--success)' : 'var(--danger)';
            return `<div class="hist-rev-tl-item">
                <div class="hist-rev-tl-dot" style="background:${r.isCurrentMonth ? 'var(--accent-primary)' : 'var(--border-color)'}"></div>
                <div class="hist-rev-tl-content">
                    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.35rem;flex-wrap:wrap;gap:.3rem">
                        <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);text-transform:capitalize">
                            ${r.label}${r.isCurrentMonth ? ' <span style="font-size:.6rem;color:var(--accent-primary);font-weight:400">en cours</span>' : ''}
                        </div>
                        <div style="display:flex;gap:1rem;align-items:baseline">
                            <span style="font-size:.72rem;color:var(--success);font-weight:600">${r.revenus > 0 ? '+' + this.formatCurrency(r.revenus) : '—'}</span>
                            <span style="font-size:.72rem;color:var(--danger)">-${this.formatCurrency(r.depEffectives)}</span>
                            <span style="font-size:.85rem;font-weight:800;color:${barColor}">${r.cashflow !== null ? (r.cashflow >= 0 ? '+' : '') + this.formatCurrency(r.cashflow) : '—'}</span>
                        </div>
                    </div>
                    ${r.revenus > 0 ? `<div style="height:4px;background:var(--bg-secondary);border-radius:2px;overflow:hidden;margin-bottom:.5rem">
                        <div style="height:100%;width:${barW}%;background:${barColor};border-radius:2px"></div>
                    </div>` : ''}
                    ${r.detailRevenus.length > 0 ? `
                    <details class="hist-rev-details">
                        <summary style="font-size:.68rem;color:var(--accent-primary);cursor:pointer;font-family:'DM Mono',monospace;list-style:none;padding:.2rem 0">
                            ▸ ${r.detailRevenus.length} revenu${r.detailRevenus.length > 1 ? 's' : ''} saisi${r.detailRevenus.length > 1 ? 's' : ''}
                        </summary>
                        <div style="margin-top:.35rem;padding-left:.5rem;border-left:2px solid var(--accent-primary)">
                            ${this._histRevDetailList(r.detailRevenus)}
                        </div>
                    </details>` : `<div style="font-size:.67rem;color:var(--text-tertiary);font-family:'DM Mono',monospace">Aucun revenu saisi${r.source === 'salaire' ? ' — salaire paramétré utilisé' : ''}</div>`}
                </div>
            </div>`;
        }).join('')}
        </div>`;
    },

    _histRevCards(rows) {
        return `<div class="hist-rev-cards-grid">
        ${rows.map(r => {
            const cashColor = r.cashflow === null ? 'var(--text-tertiary)' : r.cashflow >= 0 ? 'var(--success)' : 'var(--danger)';
            const cashSign  = r.cashflow !== null && r.cashflow >= 0 ? '+' : '';
            return `<div class="hist-rev-card${r.isCurrentMonth ? ' hist-rev-card-current' : ''}">
                <div style="font-size:.65rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:var(--text-tertiary);margin-bottom:.3rem">${r.labelShort}</div>
                <div style="font-size:1.4rem;font-weight:800;letter-spacing:-.04em;color:${cashColor};line-height:1.1;margin-bottom:.4rem">
                    ${r.cashflow !== null ? cashSign + this.formatCurrency(r.cashflow) : '—'}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.25rem .75rem;font-size:.68rem;margin-bottom:.5rem">
                    <div style="color:var(--text-tertiary)">Revenus</div>
                    <div style="text-align:right;color:var(--success);font-weight:600">${r.revenus > 0 ? this.formatCurrency(r.revenus) : '—'}</div>
                    <div style="color:var(--text-tertiary)">Dépenses</div>
                    <div style="text-align:right">${this.formatCurrency(r.depEffectives)}</div>
                    <div style="color:var(--text-tertiary)">Taux ép.</div>
                    <div style="text-align:right;font-weight:700;color:${r.flagColor}">${r.tauxEp !== null ? r.tauxEp.toFixed(0) + ' %' : '—'}</div>
                </div>
                ${r.detailRevenus.length > 0 ? `
                <details class="hist-rev-details">
                    <summary style="font-size:.65rem;color:var(--accent-primary);cursor:pointer;font-family:'DM Mono',monospace;list-style:none">
                        ▸ ${r.detailRevenus.length} revenu${r.detailRevenus.length > 1 ? 's' : ''}
                    </summary>
                    <div style="margin-top:.35rem">
                        ${this._histRevDetailList(r.detailRevenus)}
                    </div>
                </details>` : `<div style="font-size:.63rem;color:var(--text-tertiary);font-family:'DM Mono',monospace">${r.source === 'salaire' ? 'Salaire paramétré' : 'Aucun revenu saisi'}</div>`}
            </div>`;
        }).join('')}
        </div>`;
    },


    getTauxEpargne12Mois() {
        const now = new Date();
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        let totalRev = 0, totalDep = 0, nbMois = 0;
        for (let i = 1; i <= 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear(), month = d.getMonth();
            const { total: rev } = this.getRevenusMois(year, month);
            const dep = this.getDepEffectives(year, month);
            if (rev > 0 || dep > 0) { totalRev += rev; totalDep += dep; nbMois++; }
        }
        if (nbMois === 0 || totalRev === 0) return null;
        return { taux: ((totalRev - totalDep) / totalRev * 100), nbMois };
    },

    toggleSettings() {
        const isOpen = document.getElementById('settings').classList.toggle('open');
        const sov = document.getElementById('settings-overlay');
        sov.style.opacity      = isOpen ? '1'    : '0';
        sov.style.pointerEvents = isOpen ? 'auto' : 'none';
    },

    toggleAcc(headerEl) {
        const body = headerEl.nextElementSibling;
        const isOpen = body.classList.toggle('open');
        headerEl.classList.toggle('open', isOpen);
    },

    toggleSection(bodyId, arrowId, triggerId) {
        const body = document.getElementById(bodyId);
        const arrow = document.getElementById(arrowId);
        const trigger = document.getElementById(triggerId);
        if (!body) return;
        const isOpen = body.style.display === 'none';
        body.style.display = isOpen ? 'block' : 'none';
        if (arrow) arrow.style.transform = isOpen ? 'rotate(90deg)' : '';
        if (trigger) trigger.style.borderBottomColor = isOpen ? 'var(--border-color)' : 'transparent';
    },

    toggleTriPanel(panel) {
        const panels    = ['comp', 'regle', 'recurrences'];
        const bodyIds   = { comp: 'comparaison-body', regle: 'regle-body', recurrences: 'recurrences-body' };
        const arrowIds  = { comp: 'comp-arrow', regle: 'regle-arrow', recurrences: 'recurrences-arrow' };
        const triggerIds = { comp: 'comp-trigger', regle: 'regle-trigger', recurrences: 'recurrences-trigger' };
        const tripanel  = document.getElementById('tripanel-content');

        const currentlyOpen = panels.find(p => document.getElementById(bodyIds[p])?.style.display !== 'none');
        const clickingSame  = currentlyOpen === panel;

        panels.forEach(p => {
            const body    = document.getElementById(bodyIds[p]);
            const arrow   = document.getElementById(arrowIds[p]);
            const trigger = document.getElementById(triggerIds[p]);
            if (body)    body.style.display    = 'none';
            if (arrow)   arrow.style.transform = '';
            if (trigger) trigger.style.boxShadow = '';
        });

        if (clickingSame) {
            tripanel.style.display = 'none';
            return;
        }

        // ── Repositionner tripanel juste après la ligne/carte du bouton cliqué ──
        const trigger = document.getElementById(triggerIds[panel]);
        if (trigger) {
            // Remonter au [data-card-id], puis vérifier si son parent est une vault-layout-row
            const cardWrapper = trigger.closest('[data-card-id]');
            const anchor = cardWrapper
                ? (cardWrapper.parentElement.classList.contains('vault-layout-row')
                    ? cardWrapper.parentElement   // insérer après la row entière
                    : cardWrapper)                // insérer après le wrapper seul
                : null;
            if (anchor && anchor.parentElement) {
                anchor.after(tripanel);
            }
        }

        const body    = document.getElementById(bodyIds[panel]);
        const arrow   = document.getElementById(arrowIds[panel]);
        const trigger2 = document.getElementById(triggerIds[panel]);
        if (body)     body.style.display     = 'block';
        if (arrow)    arrow.style.transform  = 'rotate(90deg)';
        if (trigger2) trigger2.style.boxShadow = '8px 8px 16px var(--shadow-light), -8px -8px 16px var(--shadow-dark), inset 0 -3px 0 var(--accent-primary)';
        tripanel.style.display = 'block';

        if (panel === 'comp')  this.refreshComparaison();
        if (panel === 'regle') this.refreshRegle503020();
    },

    toggleRegle503020() { this.toggleTriPanel('regle'); },
    toggleRecurrences() { this.toggleTriPanel('recurrences'); },
    toggleComparaison() { this.toggleTriPanel('comp'); },

    toggleImportBancaire() { this.openBsImport(); },

    openBsImport() {
        const preview = document.getElementById('import-preview');
        if (preview) preview.style.display = 'none';
        const dz = document.getElementById('import-drop-zone');
        if (dz) { dz.style.borderColor = 'var(--border-color)'; dz.style.background = 'var(--bg-secondary)'; }
        // Peupler le select compte
        const compteSelect = document.getElementById('import-compte-select');
        if (compteSelect) {
            const comptes = this.data.comptesPointage || [];
            compteSelect.innerHTML = '<option value="">💳 Compte — (optionnel)</option>' +
                comptes.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
        }
        document.getElementById('bs-import-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeBsImport() {
        this._vpBsClose('bs-import-overlay');
        document.body.style.overflow = '';
    },

    toggleCatBreakdown() {
        const body = document.getElementById('cat-breakdown-body');
        const arrow = document.getElementById('cat-breakdown-arrow');
        const isOpen = body.style.display === 'none';
        body.style.display = isOpen ? 'block' : 'none';
        arrow.style.transform = isOpen ? 'rotate(90deg)' : '';
    },

    toggleBudgetsPanel() {
        this.updateBudgetsUI();
        document.getElementById('budgetsModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    closeBudgetsModal() {
        this._closeModal('budgetsModal');
    },

    toggleComptesPanel() {
        this.updateComptesUI();
        document.getElementById('comptesModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    closeComptesModal() {
        document.getElementById('comptesModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    },

    openBsDepenses() {
        this._bsDepRows = [];
        this._bsDepRowId = 0;
        const overlay = document.getElementById('bs-dep-overlay');
        const body = document.getElementById('bs-dep-rows');
        body.innerHTML = '';
        this._bsAddDepRow();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeBsDepenses() {
        this._vpBsClose('bs-dep-overlay');
        document.body.style.overflow = '';
    },

    _bsAddDepRow() {
        const id = ++this._bsDepRowId;
        const cats = Object.keys(this.data.budgets).sort();
        const today = new Date().toISOString().slice(0,10);
        const row = document.createElement('div');
        row.className = 'bs-dep-row';
        row.id = 'bs-dep-row-' + id;
        const hasComptes = (this.data.comptesPointage || []).length > 0;
        const comptesSingle = (this.data.comptesPointage || []).length === 1;
        const mostUsedCompteId = this._getMostUsedCompteId();
        const comptesOpts = (this.data.comptesPointage || []).map(c => `<option value="${c.id}" ${String(c.id) === mostUsedCompteId ? 'selected' : ''}>${c.nom}</option>`).join('');
        const compteSelectHtml = hasComptes
            ? `<div style="margin-top:.35rem"><select class="bs-input" id="bs-dep-compte-${id}" style="width:100%;font-size:.75rem">${comptesSingle ? '' : '<option value="">— Aucun compte —</option>'}${comptesOpts}</select></div>`
            : '';
        row.innerHTML = `
            <div class="bs-dep-row-label"># ${id}</div>
            ${id > 1 ? `<button class="bs-remove-btn" onclick="app._bsRemoveDepRow(${id})">✕</button>` : ''}
            <div class="bs-dep-grid">
                <select class="bs-input" id="bs-dep-cat-${id}">
                    ${cats.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <input type="number" class="bs-input bs-input-amount" id="bs-dep-montant-${id}" placeholder="0,00" step="0.01">
            </div>
            <div class="bs-dep-grid2">
                <input type="text" class="bs-input" id="bs-dep-note-${id}" placeholder="Note…">
                <input type="date" class="bs-input" id="bs-dep-date-${id}" value="${today}" style="width:140px">
            </div>
            ${compteSelectHtml}
        `;
        const body = document.getElementById('bs-dep-rows');

        const addBtn = document.getElementById('bs-dep-add-btn');
        if (addBtn) body.insertBefore(row, addBtn);
        else body.appendChild(row);

        if (!document.getElementById('bs-dep-add-btn')) {
            const btn = document.createElement('button');
            btn.className = 'bs-add-row-btn';
            btn.id = 'bs-dep-add-btn';
            btn.textContent = '+ Ajouter une ligne';
            btn.onclick = () => this._bsAddDepRow();
            body.appendChild(btn);
        }

        this._bsUpdateDepSaveLabel();
    },

    _bsRemoveDepRow(id) {
        const row = document.getElementById('bs-dep-row-' + id);
        if (row) row.remove();
        this._bsUpdateDepSaveLabel();
    },

    _bsUpdateDepSaveLabel() {
        const rows = document.querySelectorAll('#bs-dep-rows .bs-dep-row');
        const btn = document.getElementById('bs-dep-save-btn');
        if (btn) btn.textContent = rows.length > 1 ? `Enregistrer (${rows.length})` : 'Enregistrer';
    },

    saveBsDepenses() {
        const rows = document.querySelectorAll('#bs-dep-rows .bs-dep-row');
        let added = 0;
        rows.forEach(row => {
            const id = row.id.replace('bs-dep-row-', '');
            const cat = document.getElementById('bs-dep-cat-' + id)?.value || '';
            const montant = parseFloat(document.getElementById('bs-dep-montant-' + id)?.value);
            const date = document.getElementById('bs-dep-date-' + id)?.value;
            const note = document.getElementById('bs-dep-note-' + id)?.value || '';
            const compteId = document.getElementById('bs-dep-compte-' + id)?.value || null;
            if (!montant || montant <= 0) return;
            this.data.depenses.push({ id: crypto.randomUUID(), categorie: cat, montant, date, note, compteId: compteId || null });
            added++;
        });
        if (added === 0) { this.notify('Aucun montant saisi', 'error'); return; }
        this.save();
        this.afficherDepenses();
        this.refreshStatsDepenses();
        this.analyseDepenses();
        this.refreshCharts();
        this.refreshPointage();
        this.closeBsDepenses();
        this.notify(`${added} dépense${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}`, 'success');
        if (this._obOverlay && this._obOverlay.style.display === 'none') setTimeout(() => this._obAutoResume(true), 300);
    },

    openBsPatrimoine() {
        const overlay = document.getElementById('bs-pat-overlay');
        const comptesDiv = document.getElementById('bs-pat-comptes');
        const dateInput = document.getElementById('bs-pat-date');
        const today = new Date().toISOString().slice(0,10);
        dateInput.value = today;

        // Tri par date (les IDs sont des UUIDs, pas des nombres)
        const last = this.data.patrimoine.length > 0
            ? [...this.data.patrimoine].sort((a,b) => new Date(b.date || b.mois) - new Date(a.date || a.mois))[0]
            : null;

        comptesDiv.innerHTML = this.data.comptes.map(compte => {
            const prev = last ? (last[compte] ?? 0) : 0;
            return `
            <div class="bs-compte-row">
                <span class="bs-compte-icon">💼</span>
                <div class="bs-compte-info">
                    <div class="bs-compte-name">${compte}</div>
                    <div class="bs-compte-prev">Dernière valeur : ${prev.toLocaleString('fr-FR')} €</div>
                </div>
                <div class="bs-compte-input-wrap">
                    <input type="number" class="bs-compte-input"
                        id="bs-pat-${compte.replace(/\s/g,'_')}"
                        value="${prev}"
                        placeholder="0.00" step="0.01"
                        oninput="app._bsPatUpdateTotal()">
                    <span class="bs-euro">€</span>
                </div>
            </div>`;
        }).join('');

        this._bsPatUpdateTotal();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    _bsPatUpdateTotal() {
        let total = 0;
        this.data.comptes.forEach(compte => {
            const el = document.getElementById('bs-pat-' + compte.replace(/\s/g,'_'));
            if (el) total += parseFloat(el.value) || 0;
        });
        const el = document.getElementById('bs-pat-total');
        if (el) el.textContent = total.toLocaleString('fr-FR', {minimumFractionDigits:2}) + ' €';
    },

    closeBsPatrimoine() {
        this._vpBsClose('bs-pat-overlay');
        document.body.style.overflow = '';
    },

    saveBsPatrimoine() {
        const dateVal = document.getElementById('bs-pat-date').value;
        if (!dateVal) { this.notify('Date manquante', 'error'); return; }
        const mois = dateVal.substring(0,7);
        const values = {};
        let total = 0;
        this.data.comptes.forEach(compte => {
            const el = document.getElementById('bs-pat-' + compte.replace(/\s/g,'_'));
            const val = parseFloat(el?.value) || 0;
            values[compte] = val;
            total += val;
        });

        const oldDate = document.getElementById('pat-mois');
        if (oldDate) oldDate.value = dateVal;
        this.data.comptes.forEach(compte => {
            const oldEl = document.getElementById('pat-' + compte.replace(/\s/g,''));
            if (oldEl) oldEl.value = values[compte];
        });
        // Remplacer uniquement une entrée ayant exactement la même date (même jour)
        this.data.patrimoine = this.data.patrimoine.filter(p => (p.date || p.mois) !== dateVal);
        this.data.patrimoine.push({ id: crypto.randomUUID(), date: dateVal, mois, ...values, total });
        this.save();
        this.afficherPatrimoine();
        this.refreshStatsPatrimoine();
        this.refreshCharts();
        this.refreshDashboard();
        this.closeBsPatrimoine();
        this.notify('Patrimoine mis à jour', 'success');
    },

    openBsPEA() {
        const today = new Date().toISOString().slice(0,10);
        document.getElementById('bs-pea-date').value = today;
        document.getElementById('bs-pea-val').value = '';
        document.getElementById('bs-pea-inv').value = '';
        document.getElementById('bs-pea-note').value = '';

        // Valeur totale : vide (à saisir)
        // Montant investi : dernier investi enregistré
        if (this.data.suiviPEA && this.data.suiviPEA.length > 0) {
            const last = [...this.data.suiviPEA].sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            document.getElementById('bs-pea-inv').value = last.investi || '';
            // bs-pea-val reste vide
        }
        this._bsPEAUpdateGain();
        document.getElementById('bs-pea-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeBsPEA() {
        this._vpBsClose('bs-pea-overlay');
        document.body.style.overflow = '';
    },

    _bsPEAUpdateGain() {
        const val = parseFloat(document.getElementById('bs-pea-val')?.value) || 0;
        const inv = parseFloat(document.getElementById('bs-pea-inv')?.value) || 0;
        const gain = val - inv;
        const fmt = n => n.toLocaleString('fr-FR', {minimumFractionDigits:2}) + ' €';
        const dispVal  = document.getElementById('bs-pea-disp-val');
        const dispInv  = document.getElementById('bs-pea-disp-inv');
        const dispGain = document.getElementById('bs-pea-disp-gain');
        if (dispVal)  dispVal.textContent  = val  ? fmt(val)  : '— €';
        if (dispInv)  dispInv.textContent  = inv  ? fmt(inv)  : '— €';
        if (dispGain) {
            if (!val && !inv) { dispGain.textContent = '—'; dispGain.style.color = 'var(--text-tertiary)'; }
            else {
                const perf = inv ? ((gain/inv)*100).toFixed(1) : '0';
                dispGain.textContent = (gain >= 0 ? '+' : '') + fmt(gain) + ' (' + (gain >= 0 ? '+' : '') + perf + '%)';
                dispGain.style.color = gain >= 0 ? 'var(--success)' : 'var(--danger)';
            }
        }
    },

    saveBsPEA() {
        const date   = document.getElementById('bs-pea-date').value;
        const valeur = parseFloat(document.getElementById('bs-pea-val').value);
        const investi = parseFloat(document.getElementById('bs-pea-inv').value);
        const note   = document.getElementById('bs-pea-note').value;
        if (!valeur || !investi) { this.notify('Remplir Valeur et Investi', 'error'); return; }
        const gain = valeur - investi;
        const perf = ((gain / investi) * 100).toFixed(2);
        this.data.suiviPEA.push({ id: crypto.randomUUID(), date, valeur, investi, gainPerte: gain, performance: perf, note });

        document.getElementById('pea-date').value = date;
        document.getElementById('pea-val').value  = valeur;
        document.getElementById('pea-inv').value  = investi;
        document.getElementById('pea-note').value = note;
        this.save();
        this.afficherPEA();
        this.refreshStatsPEA();
        this.refreshCharts();
        this.closeBsPEA();
        this.notify('PEA enregistré', 'success');
    },

    _bsPEAImport(event) {

        const orig = document.getElementById('pea-file');
        if (orig && event.target.files[0]) {
            const dt = new DataTransfer();
            dt.items.add(event.target.files[0]);
            orig.files = dt.files;
            orig.dispatchEvent(new Event('change'));
        }
        this.closeBsPEA();
    },

    showModal(title, message, callback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmBody').textContent = message;
        document.getElementById('confirmModal').classList.add('active');
        const vpO = document.getElementById('vp-global-overlay');
        if (vpO) { vpO.classList.add('vp-active'); requestAnimationFrame(() => vpO.classList.add('vp-visible')); }
        this.confirmCallback = callback;
    },

    closeModal() {
        document.getElementById('confirmModal').classList.remove('active');
        if (!document.querySelector('.modal.active')) {
            const vpO = document.getElementById('vp-global-overlay');
            if (vpO) { vpO.classList.remove('vp-visible'); setTimeout(() => vpO.classList.remove('vp-active'), 260); }
        }
        this.confirmCallback = null;
    },

    confirmAction() {
        if (this.confirmCallback) {
            this.confirmCallback();
            this.confirmCallback = null;
        }
        this.closeModal();
    },

    showInputModal(title, label1, label2, callback) {
        document.getElementById('inputTitle').textContent = title;
        document.getElementById('inputLabel').textContent = label1;
        document.getElementById('inputField').value = '';
        document.getElementById('inputField').placeholder = '';

        if (label2) {
            document.getElementById('inputField2Container').style.display = 'block';
            document.getElementById('inputLabel2').textContent = label2;
            document.getElementById('inputField2').value = '';
        } else {
            document.getElementById('inputField2Container').style.display = 'none';
        }

        document.getElementById('inputModal').classList.add('active');
        const vpO = document.getElementById('vp-global-overlay');
        if (vpO) { vpO.classList.add('vp-active'); requestAnimationFrame(() => vpO.classList.add('vp-visible')); }
        this.inputCallback = callback;

        setTimeout(() => document.getElementById('inputField').focus(), 100);
    },

    closeInputModal() {
        document.getElementById('inputModal').classList.remove('active');
        if (!document.querySelector('.modal.active')) {
            const vpO = document.getElementById('vp-global-overlay');
            if (vpO) { vpO.classList.remove('vp-visible'); setTimeout(() => vpO.classList.remove('vp-active'), 260); }
        }
        this.inputCallback = null;
    },

    submitInput() {
        const val1 = document.getElementById('inputField').value.trim();
        const val2 = document.getElementById('inputField2').value.trim();

        if (this.inputCallback) {
            this.inputCallback(val1, val2);
        }
        this.closeInputModal();
    },

    openAddCategoryModal() {
        this.showInputModal(
            'Nouvelle catégorie',
            'Nom de la catégorie',
            'Budget mensuel (€)',
            (nom, budget) => {
                if (!nom || nom === '') return;
                const nomUpper = nom.toUpperCase();
                if (this.data.budgets[nomUpper]) {
                    this.notify('Cette catégorie existe déjà', 'error');
                    return;
                }
                const budgetNum = parseFloat(budget);
                if (isNaN(budgetNum) || budgetNum < 0) return;

                this.data.budgets[nomUpper] = budgetNum;
                this.save();
                this.updateBudgetsUI();
                this.updateCategoriesSelects();

                this.refreshStatsDepenses();
                this.refreshDashboard();
                this.notify('Catégorie ajoutée', 'success');
            }
        );
    },

    openAddCompteModal() {
        this.showInputModal(
            'Nouveau compte',
            'Nom du compte',
            null,
            (nom) => {
                if (!nom || nom === '') return;
                if (this.data.comptes.includes(nom)) {
                    this.notify('Ce compte existe déjà', 'error');
                    return;
                }
                this.data.comptes.push(nom);
                this.save();
                this.updateComptesUI();
                this.notify('Compte ajouté', 'success');
            }
        );
    },

    changeTheme() {
        this.data.parametres.theme = document.getElementById('set-theme').value;
        this.applyTheme();
        this.save();
    },

    setZoom(level) {
        const scales = { 80: 0.80, 90: 0.90, 100: 1.00, 110: 1.10 };
        const scale = scales[level] || 1;
        const wrapper = document.getElementById('zoom-wrapper');
        if (wrapper) {

            wrapper.style.transform = '';
            wrapper.style.transformOrigin = '';
            wrapper.style.width = '';
            document.body.style.overflowX = '';

            if (this._zoomRAF) cancelAnimationFrame(this._zoomRAF);
            if (!this._zoomCurrent) this._zoomCurrent = parseFloat(wrapper.style.zoom) || 1;
            if (!this._zoomVelocity) this._zoomVelocity = 0;
            this._zoomTarget = scale;

            const stiffness = 0.038;
            const damping = 0.72;
            let lastTime = null;
            const animate = (timestamp) => {
                if (!lastTime) lastTime = timestamp;
                const dt = Math.min((timestamp - lastTime) / (1000 / 60), 4);
                lastTime = timestamp;
                for (let i = 0; i < dt * 2; i++) {
                    const force = (this._zoomTarget - this._zoomCurrent) * stiffness;
                    this._zoomVelocity = (this._zoomVelocity + force) * damping + force * 0.3;
                    this._zoomCurrent += this._zoomVelocity;
                }
                wrapper.style.zoom = this._zoomCurrent;
                const settled = Math.abs(this._zoomTarget - this._zoomCurrent) < 0.0003 && Math.abs(this._zoomVelocity) < 0.0001;
                if (settled) {
                    this._zoomCurrent = this._zoomTarget;
                    this._zoomVelocity = 0;
                    wrapper.style.zoom = this._zoomTarget;
                    this._zoomRAF = null;
                    return;
                }
                this._zoomRAF = requestAnimationFrame(animate);
            };
            this._zoomRAF = requestAnimationFrame(animate);
        }
        this.data.parametres.zoom = level;
        this.save();
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.style.background = '';
            btn.style.color = '';
        });
        const activeBtn = document.getElementById('zoom-' + level);
        if (activeBtn) {
            activeBtn.style.background = 'linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end))';
            activeBtn.style.color = 'white';
        }
    },

    applyTheme() {
        const darkThemes = [];
        const theme = this.data.parametres.theme || 'light';
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.body.setAttribute('data-theme', theme);
        }

        const sel = document.getElementById('set-theme');
        if (sel && sel.value !== theme) sel.value = theme;
        setTimeout(() => { this.refreshCharts(); this._refreshAllChartColorBtns(); this.applyAllTabCards(); }, 150);
    },

    /* ── Emoji helper centralisé ─────────────────────────────────────────── */
    _getCatEmoji(cat) {
        if (!cat) return '📦';
        // 1. Emoji défini manuellement par l'utilisateur
        if (this.data.catEmojis?.[cat]) return this.data.catEmojis[cat];
        // 2. Emoji en préfixe du nom de catégorie
        const match = cat.match(/^\p{Emoji}/u);
        if (match) return match[0];
        // 3. Map par correspondance de mot-clé
        const MAP = {
            'ALIMENTATION':'🛒','COURSES':'🛒','MANGER':'🛒','RESTAURANT':'🍽️','RESTAURANTS':'🍽️',
            'LOGEMENT':'🏠','LOYER':'🏠','LOYERS':'🏠','TRANSPORT':'🚗','CARBU':'⛽','CARBURANT':'⛽',
            'LOISIR':'🎮','LOISIRS':'🎮','SANTÉ':'💊','SANTE':'💊','ÉPARGNE':'💎','EPARGNE':'💎',
            'INVESTISSEMENT':'📈','HABILLEMENT':'👔','VETEMENT':'👗','VÊTEMENT':'👗',
            'VOYAGES':'✈️','VOYAGE':'✈️','SPORT':'🏋️','EDUCATION':'📚','HIGH-TECH':'💻',
            'ABONNEMENT':'📱','ABONNEMENTS':'📱','BAR':'🍺','CIGARETTE':'🚬','TABAC':'🚬',
            'AUTRE':'📦','AUTRES':'📦','DIVERS':'📦','SHOPPING':'🛍️','FACTURE':'📄',
        };
        const up = cat.toUpperCase();
        for (const k of Object.keys(MAP)) if (up.includes(k)) return MAP[k];
        return '📦';
    },

    setCatEmoji(cat, emoji) {
        if (!this.data.catEmojis) this.data.catEmojis = {};
        if (emoji) this.data.catEmojis[cat] = emoji;
        else delete this.data.catEmojis[cat];
        this.save();
        this.updateBudgetsUI();
        this._refreshBudgetHeroAndCats();
    },

    openAllCatsModal() {
        this._renderAllCatsModal();
        document.getElementById('modal-all-cats')?.classList.add('open');
        document.getElementById('budget-modal-overlay')?.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeAllCatsModal() {
        document.getElementById('modal-all-cats')?.classList.remove('open');
        const anyOpen = ['modal-budget-comp','modal-budget-regle','modal-budget-rec','modal-budget-cashflow','modal-budget-analyse','budget-hist-complet-wrap','modal-all-cats','pea-panel']
            .some(mid => document.getElementById(mid)?.classList.contains('open'));
        if (!anyOpen) {
            document.getElementById('budget-modal-overlay')?.classList.remove('open');
            document.body.style.overflow = '';
        }
    },

    _renderAllCatsModal() {
        const container = document.getElementById('all-cats-grid');
        const subtitle  = document.getElementById('all-cats-subtitle');
        if (!container) return;
        const d = this._budgetMonthDate();
        const y = d.getFullYear(), m = d.getMonth();
        const depMois = this.data.depenses.filter(dep => {
            const dt = new Date(dep.date);
            return dt.getFullYear() === y && dt.getMonth() === m;
        });
        const bycat = {};
        depMois.forEach(dep => { bycat[dep.categorie] = (bycat[dep.categorie] || 0) + dep.montant; });
        const allCats = new Set([...Object.keys(this.data.budgets), ...Object.keys(bycat)]);
        const catData = Array.from(allCats)
            .map(cat => ({ cat, spent: bycat[cat] || 0, budget: this.data.budgets[cat] || 0 }))
            .filter(c => c.cat in this.data.budgets || c.spent > 0)
            .sort((a, b) => b.spent - a.spent);
        const totalSpent = catData.reduce((s, c) => s + c.spent, 0);
        if (subtitle) subtitle.textContent = catData.length + ' catégorie' + (catData.length > 1 ? 's' : '') + ' · ' + this.formatCurrency(totalSpent) + ' dépensés';
        if (catData.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><div>Aucune catégorie active</div></div>';
            return;
        }
        const getBar = pct => pct >= 100 ? 'linear-gradient(90deg,#f44336,#e57373)' : pct >= 80 ? 'linear-gradient(90deg,#ff9800,#ffb74d)' : 'linear-gradient(90deg,var(--accent-gradient-start),var(--accent-gradient-end))';
        const getBadge = pct => pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
        container.innerHTML = catData.map(({ cat, spent, budget }) => {
            const pct = budget > 0 ? Math.round(spent / budget * 100) : (spent > 0 ? 100 : 0);
            const fillPct = budget > 0 ? Math.min(spent / budget * 100, 100) : (spent > 0 ? 100 : 0);
            const emoji = this._getCatEmoji(cat);
            const catName = cat.replace(/^\p{Emoji}\s*/u, '') || cat;
            return `<div class="budget-cat-card">
                <div class="budget-cat-top">
                    <div class="budget-cat-left">
                        <div class="budget-cat-icon">${emoji}</div>
                        <div><div class="budget-cat-name">${catName}</div><div class="budget-cat-amounts">${this.formatCurrency(spent)} / ${this.formatCurrency(budget)}</div></div>
                    </div>
                    <span class="cat-pct-badge ${getBadge(pct)}">${pct}%</span>
                </div>
                <div class="budget-cat-progress"><div class="budget-cat-progress-fill" style="width:${fillPct}%;background:${getBar(pct)}"></div></div>
            </div>`;
        }).join('');
    },

    updateBudgetsUI() {
        const container = document.getElementById('budgets-container');
        const catEp = this.data.categoriesEpargne || ['ÉPARGNE'];
        container.innerHTML = Object.keys(this.data.budgets).map(cat => {
            const isEp  = catEp.some(e => cat.toUpperCase().includes(e.toUpperCase()));
            const emoji = this.data.catEmojis?.[cat] || this._getCatEmoji(cat);
            const catEsc = cat.replace(/'/g, "\\'");
            return `
            <div class="budget-item" style="align-items:center;gap:.5rem;flex-wrap:nowrap">
                <button class="cat-emoji-btn" data-cat="${cat}"
                        title="Changer l'emoji"
                        onclick="app.openEmojiPickerForCat('${catEsc}', this)">${emoji}</button>
                <input type="text" class="form-input" value="${cat}"
                       onblur="app.renommerCategorie('${catEsc}', this.value)"
                       onkeydown="if(event.key==='Enter') this.blur()"
                       title="Cliquer pour renommer" style="cursor:text;flex:1;min-width:0">
                ${isEp
                    ? `<span title="Catégorie épargne" style="font-size:.7rem;background:rgba(0,200,83,.15);color:var(--success);padding:.2rem .5rem;border-radius:20px;font-weight:700;white-space:nowrap;flex-shrink:0">💰 Épargne</span>`
                    : `<input type="number" class="form-input" value="${this.data.budgets[cat]}" step="10" onchange="app.updateBudget('${catEsc}', this.value)" style="width:80px;flex-shrink:0;text-align:right">`
                }
                <label title="Marquer comme épargne" style="display:flex;align-items:center;gap:.2rem;cursor:pointer;flex-shrink:0;font-size:.68rem;color:var(--text-tertiary);white-space:nowrap;user-select:none">
                    <input type="checkbox" ${isEp ? 'checked' : ''} onchange="app.toggleCategorieEpargne('${catEsc}', this.checked)" style="accent-color:var(--success);width:13px;height:13px;cursor:pointer">
                </label>
                <button class="btn btn-small btn-secondary" onclick="app.supprimerCategorieBudget('${catEsc}')" style="flex-shrink:0">✕</button>
            </div>`;
        }).join('') +
        `<div style="margin-top:.75rem;padding:.6rem .75rem;background:var(--bg-secondary);border-radius:10px;font-size:.68rem;color:var(--text-tertiary);line-height:1.5">
            Cliquez sur l'emoji pour le changer · 💰 = catégorie <strong>épargne</strong>
         </div>`;
        this.updateBudgetTotal();
    },

    toggleCategorieEpargne(cat, checked) {
        if (!this.data.categoriesEpargne) this.data.categoriesEpargne = [];
        if (checked) {
            if (!this.data.categoriesEpargne.some(e => cat.toUpperCase().includes(e.toUpperCase())))
                this.data.categoriesEpargne.push(cat);

            this.data.budgets[cat] = 0;
        } else {
            this.data.categoriesEpargne = this.data.categoriesEpargne.filter(e => !cat.toUpperCase().includes(e.toUpperCase()));
        }
        this.save();
        this.updateBudgetsUI();
        this.refreshStatsDepenses();
        this.notify(checked ? `"${cat}" marquée comme épargne ✓` : `"${cat}" retirée de l'épargne`, 'success');
    },

    updateBudget(cat, value) {
        this.data.budgets[cat] = parseFloat(value) || 0;
        this.save();
        this.updateBudgetTotal();
        this.refreshStatsDepenses();
    },

    renommerCategorie(ancien, nouveau) {
        nouveau = nouveau.trim();
        if (!nouveau || nouveau === ancien) return;
        if (this.data.budgets[nouveau] !== undefined) {
            this.notify('Cette catégorie existe déjà !', 'error');
            this.updateBudgetsUI();
            return;
        }

        // Reconstruire l'objet en remplaçant la clé à sa position d'origine
        const nouvelObjet = {};
        Object.keys(this.data.budgets).forEach(k => {
            nouvelObjet[k === ancien ? nouveau : k] = this.data.budgets[k];
        });
        this.data.budgets = nouvelObjet;

        this.data.depenses.forEach(d => {
            if (d.categorie === ancien) d.categorie = nouveau;
        });
        this.save();
        this.updateBudgetsUI();
        this.updateCategoriesSelects();
        this.afficherDepenses();
        this.notify('Catégorie renommée en "' + nouveau + '"', 'success');
    },

    updateBudgetTotal() {
        const total = Object.values(this.data.budgets).reduce((sum, v) => sum + v, 0);
        document.getElementById('budget-total-alloue').textContent = this.formatCurrency(total);
    },

    supprimerCategorieBudget(cat) {
        this.showModal(
            'Supprimer la catégorie',
            'Voulez-vous vraiment supprimer la catégorie "' + cat + '" ? Les dépenses existantes de cette catégorie seront conservées.',
            () => {
                delete this.data.budgets[cat];
                this.save();
                this.updateBudgetsUI();
                this.updateCategoriesSelects();
                this.notify('Catégorie supprimée', 'success');
            }
        );
    },

    updateCategoriesSelects() {
        const cats = Object.keys(this.data.budgets).sort();
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        const catsHorsEpargne = cats.filter(c => !exclus.some(e => c.toUpperCase().includes(e.toUpperCase())));
        const depCat = document.getElementById('dep-cat');
        const analyseCat = document.getElementById('analyse-categorie');

        if (depCat) depCat.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
        if (analyseCat) analyseCat.innerHTML = '<option value="toutes">Toutes</option>' +
            catsHorsEpargne.map(c => `<option value="${c}">${c}</option>`).join('');

        const pillsContainer = document.getElementById('dep-pills');
        if (pillsContainer && cats.length > 0) {
            const currentVal = depCat ? depCat.value : cats[0];
            pillsContainer.innerHTML = cats.map(c => `
                <button type="button" class="dep-pill${c === currentVal ? ' active' : ''}" onclick="app._selectDepCat('${c.replace(/'/g,"\\'")}', this)">
                    ${c}
                </button>`).join('');
        }

        const histCat = document.getElementById('hist-filter-cat');
        if (histCat) {
            const current = histCat.value;
            histCat.innerHTML = '<option value="">Toutes</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
            if (cats.includes(current)) histCat.value = current;
        }

        const importPreview = document.getElementById('import-preview');
        if (importPreview && importPreview.style.display !== 'none') {
            const opts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
            importPreview.querySelectorAll('select[data-import-cat]').forEach(sel => {
                const current = sel.value;
                sel.innerHTML = opts;

                if (cats.includes(current)) sel.value = current;
            });
        }
    },

    updateComptesUI() {
        const container = document.getElementById('comptes-patrimoine-container');
        const liquides = this.data.comptesLiquides || [];
        container.innerHTML = this.data.comptes.map(compte => {
            const isLiquide = liquides.includes(compte);
            return `
            <div class="budget-item" style="align-items:center;gap:.75rem">
                <input type="text" class="form-input" value="${compte}"
                       onchange="app.renommerCompte('${compte}', this.value)"
                       style="flex:1;min-width:0">
                <label title="Compter comme épargne liquide (fonds d'urgence)" style="display:flex;align-items:center;gap:.35rem;cursor:pointer;flex-shrink:0;font-size:.72rem;color:var(--text-secondary);white-space:nowrap;user-select:none">
                    <input type="checkbox" ${isLiquide ? 'checked' : ''} onchange="app.toggleCompteLiquide('${compte}', this.checked)" style="accent-color:var(--accent-primary);width:15px;height:15px;cursor:pointer">
                    🛡️
                </label>
                <button class="btn btn-small btn-secondary" onclick="app.supprimerCompte('${compte}')">✕</button>
            </div>`;
        }).join('') +
        `<div style="margin-top:.75rem;padding:.6rem .75rem;background:var(--bg-secondary);border-radius:10px;font-size:.7rem;color:var(--text-tertiary);line-height:1.5">
            🛡️ = comptes inclus dans le calcul du <strong>fonds d'urgence</strong><br>
            <span style="color:var(--accent-primary);font-weight:600">${liquides.length > 0 ? liquides.join(', ') : 'Aucun sélectionné'}</span>
         </div>`;
        this.updatePatInputs();
        this.updatePatTableHeaders();
    },

    toggleCompteLiquide(compte, checked) {
        if (!this.data.comptesLiquides) this.data.comptesLiquides = [];
        if (checked) {
            if (!this.data.comptesLiquides.includes(compte))
                this.data.comptesLiquides.push(compte);
        } else {
            this.data.comptesLiquides = this.data.comptesLiquides.filter(c => c !== compte);
        }
        this.save();
        this.updateComptesUI();
        this.refreshStatsPatrimoine();
        this.refreshAlertes();
    },

    renommerCompte(ancien, nouveau) {
        if (!nouveau || nouveau.trim() === '') return;
        const index = this.data.comptes.indexOf(ancien);
        if (index === -1) return;
        this.data.comptes[index] = nouveau;
        this.data.patrimoine.forEach(p => {
            if (p[ancien] !== undefined) {
                p[nouveau] = p[ancien];
                delete p[ancien];
            }
        });
        this.save();
        this.updateComptesUI();
        this.afficherPatrimoine();
    },

    supprimerCompte(compte) {
        this.showModal(
            'Supprimer le compte',
            'Voulez-vous vraiment supprimer le compte "' + compte + '" ?',
            () => {
                this.data.comptes = this.data.comptes.filter(c => c !== compte);
                this.data.patrimoine.forEach(p => delete p[compte]);
                this.save();
                this.updateComptesUI();
                this.afficherPatrimoine();
                this.notify('Compte supprimé', 'success');
            }
        );
    },

    // ─── POINTAGE BANCAIRE ──────────────────────────────────────────────────

    openAddComptePointage(id) {
        const overlay = document.getElementById('bs-pointage-overlay');
        const title   = document.getElementById('bs-pointage-title');
        const editId  = document.getElementById('bs-pointage-edit-id');
        const nom     = document.getElementById('bs-pointage-nom');
        const type    = document.getElementById('bs-pointage-type');
        const solde   = document.getElementById('bs-pointage-solde');
        const date    = document.getElementById('bs-pointage-date');
        if (id) {
            const c = (this.data.comptesPointage || []).find(c => c.id === id);
            if (!c) return;
            title.textContent = 'Modifier le compte';
            editId.value  = c.id;
            nom.value     = c.nom;
            type.value    = c.type || 'courant';
            solde.value   = c.soldeInitial;
            date.value    = c.dateSoldeInitial;
        } else {
            title.textContent = 'Ajouter un compte';
            editId.value  = '';
            nom.value     = '';
            type.value    = 'courant';
            solde.value   = '';
            date.value    = new Date().toISOString().slice(0, 10);
        }
        overlay.classList.add('open');
    },

    closeAddComptePointage() {
        this._vpBsClose('bs-pointage-overlay');
    },

    saveComptePointage() {
        const nom   = document.getElementById('bs-pointage-nom').value.trim();
        const type  = document.getElementById('bs-pointage-type').value;
        const solde = parseFloat(document.getElementById('bs-pointage-solde').value);
        const date  = document.getElementById('bs-pointage-date').value;
        const editId = document.getElementById('bs-pointage-edit-id').value;
        if (!nom)           { this.notify('Nom requis', 'error'); return; }
        if (isNaN(solde))   { this.notify('Solde initial requis', 'error'); return; }
        if (!date)          { this.notify('Date requise', 'error'); return; }
        if (!this.data.comptesPointage) this.data.comptesPointage = [];
        if (editId) {
            const c = this.data.comptesPointage.find(c => c.id === editId);
            if (c) { c.nom = nom; c.type = type; c.soldeInitial = solde; c.dateSoldeInitial = date; }
        } else {
            this.data.comptesPointage.push({
                id: 'cp_' + crypto.randomUUID(),
                nom, type,
                soldeInitial: solde,
                dateSoldeInitial: date
            });
        }
        this.save();
        this.refreshPointage();
        this.closeAddComptePointage();
        this.notify(editId ? 'Compte modifié' : 'Compte ajouté', 'success');
        if (this._obOverlay && this._obOverlay.style.display === 'none') setTimeout(() => this._obAutoResume(true), 300);
    },

    supprimerComptePointage(id) {
        this.showModal('Supprimer ce compte', 'Toutes les liaisons de transactions seront perdues.', () => {
            this.data.comptesPointage = (this.data.comptesPointage || []).filter(c => String(c.id) !== String(id));
            this.data.depenses.forEach(d => { if (d.compteId && String(d.compteId) === String(id)) d.compteId = null; });
            this.data.revenus.forEach(r => { if (r.compteId && String(r.compteId) === String(id)) r.compteId = null; });
            this.save();
            this.refreshPointage();
            this.notify('Compte supprimé', 'success');
        });
    },

    _getMostUsedCompteId() {
        const comptes = this.data.comptesPointage || [];
        if (comptes.length === 0) return null;
        if (comptes.length === 1) return String(comptes[0].id);
        const counts = {};
        (this.data.depenses || []).forEach(d => { if (d.compteId) counts[String(d.compteId)] = (counts[String(d.compteId)] || 0) + 1; });
        (this.data.revenus  || []).forEach(r => { if (r.compteId) counts[String(r.compteId)] = (counts[String(r.compteId)] || 0) + 1; });
        let best = String(comptes[0].id), max = 0;
        comptes.forEach(c => { const n = counts[String(c.id)] || 0; if (n > max) { max = n; best = String(c.id); } });
        return best;
    },

    _calcSoldeCompte(compte) {
        const ref = new Date(compte.dateSoldeInitial + 'T00:00:00');
        const cid = String(compte.id);
        const deps = (this.data.depenses || [])
            .filter(d => d.compteId && String(d.compteId) === cid && new Date(d.date + 'T00:00:00') >= ref)
            .reduce((s, d) => s + d.montant, 0);
        const revs = (this.data.revenus || [])
            .filter(r => r.compteId && String(r.compteId) === cid && new Date(r.date + 'T00:00:00') >= ref)
            .reduce((s, r) => s + r.montant, 0);
        return compte.soldeInitial - deps + revs;
    },

    saisirSoldeReel(id) {
        const c = (this.data.comptesPointage || []).find(c => c.id === id);
        if (!c) return;
        const input = document.getElementById('pointage-solde-reel-' + id);
        const val = parseFloat(input?.value);
        if (isNaN(val)) { this.notify('Montant invalide', 'error'); return; }
        c.soldeReel = val;
        c.dateSoldeReel = new Date().toISOString().slice(0, 10);
        this.save();
        this.refreshPointage();
        this.notify('Solde réel mis à jour', 'success');
    },

    refreshPointage() {
        const container = document.getElementById('pointage-container');
        const emptyEl   = document.getElementById('pointage-empty');
        const detail    = document.getElementById('vault-solde-detail');
        if (!container) return;
        const comptes = this.data.comptesPointage || [];

        // Afficher/masquer le total
        const totalWrap = document.getElementById('vault-solde-total-wrap');
        const totalEl   = document.getElementById('vault-solde-total');

        if (comptes.length === 0) {
            container.innerHTML = '';
            if (emptyEl) emptyEl.innerHTML = '<div style="text-align:center;padding:.65rem 0;color:var(--text-tertiary);font-size:.78rem;font-family:DM Mono,monospace">Aucun compte — cliquez sur "+ Compte"</div>';
            if (totalWrap) totalWrap.style.display = 'none';
            if (detail) detail.style.display = 'none';
            return;
        }
        if (emptyEl) emptyEl.innerHTML = '';

        // Calcul total
        const total = comptes.reduce((s, c) => s + this._calcSoldeCompte(c), 0);
        if (totalWrap) totalWrap.style.display = '';
        if (totalEl)   totalEl.textContent = total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const typeIcon = { courant: '💳', épargne: '🏦', autre: '📁' };
        const chips = comptes.map(c => {
            const solde = this._calcSoldeCompte(c);
            const cid   = String(c.id);
            const nbTx  = (this.data.depenses || []).filter(d => d.compteId && String(d.compteId) === cid).length
                        + (this.data.revenus  || []).filter(r => r.compteId && String(r.compteId) === cid).length;
            const isNeg = solde < 0;
            return '<div class="vault-account-chip' + (isNeg ? ' vault-account-chip--neg' : '') + '">'
                 +   '<div class="vault-account-chip-name">'
                 +     '<span style="font-size:.85rem">' + (typeIcon[c.type] || '💳') + '</span>'
                 +     '<span>' + this._esc(c.nom) + '</span>'
                 +   '</div>'
                 +   '<div class="vault-account-chip-actions">'
                 +     '<button onclick="app.openAddComptePointage(\'' + c.id + '\')" class="vault-account-chip-btn" title="Modifier">✏️</button>'
                 +     '<button onclick="app.supprimerComptePointage(\'' + c.id + '\')" class="vault-account-chip-btn" title="Supprimer">✕</button>'
                 +   '</div>'
                 +   '<div class="vault-account-chip-amount">' + this.formatCurrency(solde) + '</div>'
                 +   '<div class="vault-account-chip-tx">' + nbTx + ' transaction' + (nbTx > 1 ? 's' : '') + '</div>'
                 + '</div>';
        }).join('');
        container.innerHTML = '<div class="vault-accounts-row">' + chips + '</div>';
    },


    toggleSoldeDetail() {
        const detail = document.getElementById('vault-solde-detail');
        const btn    = document.getElementById('vault-solde-toggle');
        if (!detail) return;
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : '';
        if (btn) btn.classList.toggle('open', !isOpen);
    },

    updatePatInputs() {
        const container = document.getElementById('pat-inputs');
        container.innerHTML = this.data.comptes.map(compte => `
            <div class="form-group">
                <label class="form-label">${compte} (€)</label>
                <input type="number" class="form-input" id="pat-${compte.replace(/\s/g,'')}"
                       placeholder="0.00" step="0.01">
            </div>
        `).join('');
    },

    updatePatTableHeaders() {
        const th = document.getElementById('pat-table-headers');
        if (!th) return; // timeline remplace le tableau, cet élément n'existe plus
        th.outerHTML = this.data.comptes.map(c => `<th>${c}</th>`).join('') + '<th id="pat-table-headers" style="display:none"></th>';
    },

    _selectDepCat(cat, btn) {
        const depCat = document.getElementById('dep-cat');
        if (depCat) depCat.value = cat;
        document.querySelectorAll('#dep-pills .dep-pill').forEach(p => p.classList.remove('active'));
        if (btn) btn.classList.add('active');
    },
    _depMontantInput(input) {
        const underline = document.getElementById('dep-amount-underline');
        if (underline) underline.classList.toggle('active', input.value.length > 0);
    },
    ajouterDepense() {
        const cat = document.getElementById('dep-cat').value;
        const montant = parseFloat(document.getElementById('dep-montant').value);
        const date = document.getElementById('dep-date').value;
        const note = document.getElementById('dep-note').value;

        if (!montant || montant <= 0) {
            this.notify('Montant invalide', 'error');
            return;
        }

        this.data.depenses.push({
            id: crypto.randomUUID(),
            categorie: cat,
            montant: montant,
            date: date,
            note: note
        });

        this.save();
        this.afficherDepenses();
        this.refreshStatsDepenses();
        this.analyseDepenses();
        this.refreshCharts();
        this.refreshPointage();

        document.getElementById('dep-montant').value = '';
        const ul = document.getElementById('dep-amount-underline');
        if (ul) ul.classList.remove('active');
        document.getElementById('dep-note').value = '';
        this.notify('Dépense ajoutée', 'success');
    },

    setHistType(type) {
        this._histType = type;
        ['all','dep','rev'].forEach(t => {
            document.getElementById('hist-type-' + t)?.classList.toggle('active', t === type);
        });
        // Cacher filtre catégorie sur vue revenus
        const catWrap = document.getElementById('hist-filter-cat-wrap');
        if (catWrap) catWrap.style.display = type === 'rev' ? 'none' : '';
        this.afficherDepenses();
    },

    afficherDepenses() {
        const mobileContainer = document.getElementById('mobile-depenses-cards');
        const tableWrapper    = document.getElementById('depenses-table-wrapper');
        const btnShowMore     = document.getElementById('show-more-depenses');
        const filterCount     = document.getElementById('hist-filter-count');
        const subtitle        = document.getElementById('hist-subtitle');
        const type            = this._histType || 'all';

        // Peupler select catégories (dépenses seulement)
        const selCat = document.getElementById('hist-filter-cat');
        if (selCat && selCat.options.length <= 1) {
            const cats = [...new Set(this.data.depenses.map(d => d.categorie))].sort();
            cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; selCat.appendChild(o); });
        }

        const filterMois = (document.getElementById('hist-filter-mois')?.value || '').trim();
        const filterCat  = (selCat?.value || '').trim();
        const filterNote = (document.getElementById('hist-filter-note')?.value || '').trim().toLowerCase();
        const sortAsc    = this._histSortAsc || false;

        // Construire liste unifiée
        const MONTHS_ABBR = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
        let items = [];

        if (type !== 'rev') {
            this.data.depenses.forEach(d => items.push({
                id: d.id, date: d.date, label: d.note || '—',
                meta: d.categorie, montant: -d.montant, kind: 'dep',
                emoji: this._getCatEmoji(d.categorie),
                metaClean: d.categorie.replace(/^\p{Emoji}\s*/u, '') || d.categorie
            }));
        }
        if (type !== 'dep') {
            this.data.revenus.forEach(r => {
                const date = r.date || (r.mois ? r.mois + '-01' : null);
                if (!date) return;
                items.push({
                    id: r.id, date, label: r.note || r.type || 'Revenu',
                    meta: r.type || 'Revenu', montant: r.montant, kind: 'rev',
                    emoji: '💰', metaClean: r.type || 'Revenu'
                });
            });
        }

        // Trier
        items.sort((a, b) => sortAsc
            ? (a.date > b.date ? 1 : a.date < b.date ? -1 : 0)
            : (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)
        );

        const totalAvant = items.length;

        // Filtres
        if (filterMois) items = items.filter(i => i.date?.startsWith(filterMois));
        if (filterCat && type !== 'rev')  items = items.filter(i => i.kind === 'rev' || i.meta === filterCat);
        if (filterNote) items = items.filter(i => i.label.toLowerCase().includes(filterNote) || i.meta.toLowerCase().includes(filterNote));

        const totalApres = items.length;
        const filtersActive = filterMois || filterCat || filterNote;

        if (filterCount) filterCount.textContent = filtersActive
            ? totalApres + ' résultat' + (totalApres > 1 ? 's' : '') + ' sur ' + totalAvant : '';

        // Subtitle
        const totalDep = items.filter(i => i.kind === 'dep').reduce((s, i) => s + Math.abs(i.montant), 0);
        const totalRev = items.filter(i => i.kind === 'rev').reduce((s, i) => s + i.montant, 0);
        if (subtitle) {
            if (type === 'dep') subtitle.textContent = totalApres + ' dépense' + (totalApres > 1 ? 's' : '') + ' · ' + this.formatCurrency(totalDep);
            else if (type === 'rev') subtitle.textContent = totalApres + ' revenu' + (totalApres > 1 ? 's' : '') + ' · ' + this.formatCurrency(totalRev);
            else subtitle.textContent = totalApres + ' transaction' + (totalApres > 1 ? 's' : '') + ' · solde ' + this.formatCurrency(totalRev - totalDep);
        }

        if (tableWrapper) tableWrapper.style.display = 'none';
        if (mobileContainer) mobileContainer.style.display = 'block';

        const limit   = this.showMoreState.depenses ? items.length : 20;
        const toShow  = items.slice(0, limit);

        if (items.length === 0) {
            const msg = filtersActive ? 'Aucun résultat' : type === 'rev' ? 'Aucun revenu enregistré' : 'Aucune dépense enregistrée';
            if (mobileContainer) mobileContainer.innerHTML = `<div class="v-empty"><div class="v-empty-title">${msg}</div></div>`;
            if (btnShowMore) btnShowMore.style.display = 'none';
            return;
        }

        // Grouper par date
        const groups = {};
        toShow.forEach(i => { if (!groups[i.date]) groups[i.date] = []; groups[i.date].push(i); });

        const fmt = dateStr => {
            if (!dateStr) return '—';
            const dt = new Date(dateStr + 'T00:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
            if (dt.getTime() === today.getTime()) return "Aujourd'hui";
            if (dt.getTime() === yesterday.getTime()) return 'Hier';
            return dt.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'});
        };

        if (mobileContainer) {
            mobileContainer.innerHTML = Object.entries(groups).map(([dateKey, grpItems]) => {
                const dt = new Date(dateKey + 'T00:00:00');
                const dateShort = dt.getDate() + ' ' + MONTHS_ABBR[dt.getMonth()];
                return `<div class="hist-date-group">
                    <div class="hist-date-label">
                        <span class="hist-date-text">${fmt(dateKey)}</span>
                        <div class="hist-date-line"></div>
                    </div>
                    ${grpItems.map(i => {
                        const isRev  = i.kind === 'rev';
                        const amtStr = (isRev ? '+' : '−') + this.formatCurrency(Math.abs(i.montant));
                        const amtCls = 'budget-tx-amount' + (isRev ? ' pos' : '');
                        const iconBg = isRev ? 'rgba(0,200,83,.12)' : 'var(--bg-secondary)';
                        const actions = isRev
                            ? `<button class="budget-tx-action-btn" onclick="app.supprimerRevenu('${i.id}')" title="Supprimer">✕</button>`
                            : `<button class="budget-tx-action-btn" onclick="app.modifierNote('depense','${i.id}')" title="Modifier">✏️</button>
                               <button class="budget-tx-action-btn" onclick="app.supprimerDepense('${i.id}')" title="Supprimer">✕</button>`;
                        return `<div class="budget-tx-card budget-tx-card--actions">
                            <div class="budget-tx-icon" style="background:${iconBg}">${i.emoji}</div>
                            <div class="budget-tx-info">
                                <div class="budget-tx-name">${i.label}</div>
                                <div class="budget-tx-meta">${i.metaClean}</div>
                            </div>
                            <div class="budget-tx-date">${dateShort}</div>
                            <div class="${amtCls}">${amtStr}</div>
                            <div class="budget-tx-actions">${actions}</div>
                        </div>`;
                    }).join('')}
                </div>`;
            }).join('');
        }

        if (btnShowMore) {
            if (items.length > 20) {
                btnShowMore.style.display = 'block';
                btnShowMore.textContent = this.showMoreState.depenses ? 'Afficher moins' : 'Afficher plus (' + (items.length - 20) + ' autres)';
            } else {
                btnShowMore.style.display = 'none';
            }
        }
    },

    toggleHistSort() {
        this._histSortAsc = !this._histSortAsc;
        const btn = document.getElementById('hist-sort-btn');
        if (btn) btn.textContent = this._histSortAsc ? '🕐 Ancien' : '🕐 Récent';
        this.afficherDepenses();
    },

    resetHistFilters() {
        const m = document.getElementById('hist-filter-mois');
        const c = document.getElementById('hist-filter-cat');
        const n = document.getElementById('hist-filter-note');
        if (m) m.value = '';
        if (c) c.value = '';
        if (n) n.value = '';
        this._histSortAsc = false;
        this._histType = 'all';
        ['all','dep','rev'].forEach(t => document.getElementById('hist-type-' + t)?.classList.toggle('active', t === 'all'));
        const catWrap = document.getElementById('hist-filter-cat-wrap');
        if (catWrap) catWrap.style.display = '';
        const btn = document.getElementById('hist-sort-btn');
        if (btn) btn.textContent = '🕐 Récent';
        this.afficherDepenses();
    },

    ouvrirEditDepense(id) {
        const dep = this.data.depenses.find(d => d.id === id);
        if (!dep) return;

        // Nettoyer une éventuelle modale précédente
        document.getElementById('edit-dep-modal')?.remove();

        const cats = Object.keys(this.data.budgets).sort();
        const catsOpts = cats.map(c => `<option value="${c}" ${c === dep.categorie ? 'selected' : ''}>${c}</option>`).join('');
        const hasComptes = (this.data.comptesPointage || []).length > 0;
        const comptesOpts = (this.data.comptesPointage || []).map(c =>
            `<option value="${c.id}" ${String(c.id) === String(dep.compteId) ? 'selected' : ''}>${c.nom}</option>`
        ).join('');
        const compteHtml = hasComptes
            ? `<div class="form-group">
                <label class="form-label">Compte</label>
                <select class="form-select" id="edit-dep-compte">
                  <option value="">— Aucun —</option>${comptesOpts}
                </select>
               </div>`
            : '';

        const modal = document.createElement('div');
        modal.id = 'edit-dep-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-header">
              <h2 class="modal-title">✏️ Modifier la dépense</h2>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Catégorie</label>
                <select class="form-select" id="edit-dep-cat">${catsOpts}</select>
              </div>
              <div class="form-group">
                <label class="form-label">Montant (€)</label>
                <input type="number" class="form-input" id="edit-dep-montant" value="${dep.montant}" step="0.01" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-input" id="edit-dep-date" value="${dep.date}">
              </div>
              <div class="form-group">
                <label class="form-label">Note</label>
                <input type="text" class="form-input" id="edit-dep-note" value="${this._esc(dep.note || '')}">
              </div>
              ${compteHtml}
            </div>
            <div class="modal-footer">
              <button class="vp-btn-cancel" onclick="app._fermerEditDepense()">Annuler</button>
              <button class="vp-btn-save" onclick="app._sauvegarderEditDepense('${id}')">Enregistrer</button>
            </div>`;
        document.body.appendChild(modal);
        modal.classList.add('active');

        // Utiliser vp-global-overlay (overlay réel du système VP)
        const vpOverlay = document.getElementById('vp-global-overlay');
        if (vpOverlay) {
            vpOverlay.classList.add('vp-active');
            requestAnimationFrame(() => vpOverlay.classList.add('vp-visible'));
            vpOverlay._editDepHandler = () => {
                if (_vpMouseDownInsideModal) return;
                this._fermerEditDepense();
            };
            vpOverlay.addEventListener('click', vpOverlay._editDepHandler);
        }
    },

    _fermerEditDepense() {
        const modal = document.getElementById('edit-dep-modal');
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 210);
        }
        const vpOverlay = document.getElementById('vp-global-overlay');
        if (vpOverlay && vpOverlay._editDepHandler) {
            vpOverlay.removeEventListener('click', vpOverlay._editDepHandler);
            delete vpOverlay._editDepHandler;
        }
        if (!document.querySelector('.modal.active')) {
            const o = document.getElementById('vp-global-overlay');
            if (o) { o.classList.remove('vp-visible'); setTimeout(() => o.classList.remove('vp-active'), 260); }
        }
    },

    _sauvegarderEditDepense(id) {
        const dep = this.data.depenses.find(d => d.id === id);
        if (!dep) return;
        const cat     = document.getElementById('edit-dep-cat')?.value;
        const montant = parseFloat(document.getElementById('edit-dep-montant')?.value);
        const date    = document.getElementById('edit-dep-date')?.value;
        const note    = document.getElementById('edit-dep-note')?.value || '';
        const compteEl = document.getElementById('edit-dep-compte');
        if (!cat || isNaN(montant) || !date) { this.notify('Champs invalides', 'error'); return; }
        dep.categorie = cat;
        dep.montant   = montant;
        dep.date      = date;
        dep.note      = note;
        if (compteEl) dep.compteId = compteEl.value || null;
        this._fermerEditDepense();
        this.save();
        this.afficherDepenses();
        this.refreshStatsDepenses();
        this.analyseDepenses();
        this.updateBudgetsUI();
        this.refreshCharts();
        this.refreshPointage();
        this.notify('Dépense modifiée', 'success');
    },

    supprimerDepense(id) {
        this.showModal(
            'Supprimer la dépense',
            'Voulez-vous vraiment supprimer cette dépense ?',
            () => {
                this.data.depenses = this.data.depenses.filter(d => String(d.id) !== String(id));
                this.save();
                this.afficherDepenses();
                this.refreshStatsDepenses();
                this.analyseDepenses();
                this.refreshCharts();
                this.refreshPointage();
                this.notify('Dépense supprimée', 'success');
            }
        );
    },

    getRevenusMois(year, month) {
        const mois = year + '-' + String(month + 1).padStart(2, '0');
        const fromRevenus = this.data.revenus
            .filter(r => r.mois === mois)
            .reduce((s, r) => s + r.montant, 0);

        if (fromRevenus > 0) return { total: fromRevenus, source: 'reel' };
        const salaire = this.data.parametres.salaire || 0;
        return { total: salaire, source: salaire > 0 ? 'salaire' : 'inconnu' };
    },

    getDepEffectives(year, month) {
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        return this.data.depenses.filter(d => {
            const date = new Date(d.date);
            if (date.getMonth() !== month || date.getFullYear() !== year) return false;
            return !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase()));
        }).reduce((s, d) => s + d.montant, 0);
    },

    toggleRevenusPanel() { this.openBsRevenus(); },

    openBsRevenus() {
        // Réinitialiser les champs
        const montant = document.getElementById('rev-montant');
        const note = document.getElementById('rev-note');
        const date = document.getElementById('rev-date');
        if (montant) montant.value = '';
        if (note) note.value = '';
        if (date) {
            const now = new Date();
            date.value = now.toISOString().split('T')[0];
        }
        // Peupler le select compte
        const compteGroup = document.getElementById('rev-compte-group');
        const compteSelect = document.getElementById('rev-compte');
        const comptes = this.data.comptesPointage || [];
        if (compteGroup && compteSelect) {
            if (comptes.length > 0) {
                const mostUsed = this._getMostUsedCompteId();
                const emptyOpt = comptes.length === 1 ? '' : '<option value="">— Aucun compte —</option>';
                compteSelect.innerHTML = emptyOpt +
                    comptes.map(c => `<option value="${c.id}" ${String(c.id) === mostUsed ? 'selected' : ''}>${c.nom}</option>`).join('');
                compteGroup.style.display = '';
            } else {
                compteGroup.style.display = 'none';
            }
        }
        // Afficher l'historique récent
        this.refreshHistoriqueRevenus();
        // Ouvrir le bottom sheet
        const overlay = document.getElementById('bs-rev-overlay');
        if (overlay) overlay.classList.add('open');
    },

    closeBsRevenus() {
        this._vpBsClose('bs-rev-overlay');
    },

    ajouterRevenu() {
        const montant = parseFloat(document.getElementById('rev-montant').value);
        const type    = document.getElementById('rev-type').value;
        const date    = document.getElementById('rev-date').value;
        const note    = document.getElementById('rev-note').value;
        const compteId = document.getElementById('rev-compte')?.value || null;
        if (!montant || montant <= 0) { this.notify('Montant invalide', 'error'); return; }
        if (!date) { this.notify('Date requise', 'error'); return; }
        const mois = date.substring(0, 7);
        this.data.revenus.push({ id: crypto.randomUUID(), date, mois, type, montant, note, compteId: compteId || null });
        this.save();
        this.refreshRevenus();
        this.refreshHistoriqueRevenus();
        this.refreshDashboard();
        this.refreshPointage();
        document.getElementById('rev-montant').value = '';
        document.getElementById('rev-note').value = '';
        this.notify('Revenu enregistré', 'success');
        this.closeBsRevenus();
        if (this._obOverlay && this._obOverlay.style.display === 'none') setTimeout(() => this._obAutoResume(true), 300);
    },

    supprimerRevenu(id) {
        this.showModal('Supprimer ce revenu', 'Voulez-vous supprimer cette entrée ?', () => {
            this.data.revenus = this.data.revenus.filter(r => r.id !== id);
            this.save();
            this.refreshRevenus();
            this.refreshHistoriqueRevenus();
            this.refreshDashboard();
            this.refreshPointage();
            this.notify('Revenu supprimé', 'success');
        });
    },

    refreshRevenus() {
        const now   = new Date();
        const year  = now.getFullYear();
        const month = now.getMonth();
        const mois  = year + '-' + String(month + 1).padStart(2, '0');

        const { total: revenus, source } = this.getRevenusMois(year, month);
        const depEffectives = this.getDepEffectives(year, month);
        const cashflow  = revenus > 0 ? revenus - depEffectives : null;
        const tauxEp    = revenus > 0 ? ((revenus - depEffectives) / revenus) * 100 : null;

        const elTotal    = document.getElementById('rev-total');
        const elDep      = document.getElementById('rev-depenses');
        const elCash     = document.getElementById('rev-cashflow');
        const elTaux     = document.getElementById('rev-taux');
        if (elTotal) {
            elTotal.textContent = revenus > 0 ? this.formatCurrency(revenus) : '—';
            elTotal.style.color = source === 'reel' ? 'var(--success)' : 'var(--text-tertiary)';
        }
        if (elDep)  elDep.textContent  = this.formatCurrency(depEffectives);
        if (elCash) {
            elCash.textContent  = cashflow !== null ? (cashflow >= 0 ? '+' : '') + this.formatCurrency(cashflow) : '—';
            elCash.style.color  = cashflow === null ? 'var(--text-tertiary)' : cashflow >= 0 ? 'var(--success)' : 'var(--danger)';
        }
        if (elTaux) {
            elTaux.textContent  = tauxEp !== null ? tauxEp.toFixed(0) + ' %' : '—';
            elTaux.style.color  = tauxEp === null ? 'var(--text-tertiary)' : tauxEp >= 20 ? 'var(--success)' : tauxEp >= 10 ? 'var(--warning)' : 'var(--danger)';
        }

        const elDTaux = document.getElementById('d-taux-epargne');
        const elDTauxSub = document.getElementById('d-taux-epargne-sub');
        const taux12 = this.getTauxEpargne12Mois();
        if (elDTaux) {
            if (taux12) {
                elDTaux.textContent = taux12.taux.toFixed(0) + ' %';
                elDTaux.style.color = taux12.taux >= 20 ? '#4ade80' : taux12.taux >= 10 ? '#fbbf24' : '#f87171';
                if (elDTauxSub) elDTauxSub.textContent = 'moy. ' + taux12.nbMois + ' mois complets';
            } else {
                elDTaux.textContent = '—';
                elDTaux.style.color = 'rgba(255,255,255,.65)';
                if (elDTauxSub) elDTauxSub.textContent = 'saisir des revenus ou le salaire';
            }
        }

        const hist = document.getElementById('revenus-history');
        if (!hist) return;
        const revenus_mois = this.data.revenus
            .filter(r => r.mois === mois)
            .sort((a, b) => b.id - a.id);
        if (revenus_mois.length === 0) {
            hist.innerHTML = '';
            return;
        }
        hist.innerHTML = `<div style="margin-top:.5rem;font-family:DM Mono,monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);margin-bottom:.5rem">Ce mois</div>` +
            revenus_mois.map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .75rem;background:var(--bg-secondary);border-radius:10px;margin-bottom:.35rem">
                <div>
                    <span style="font-size:.7rem;background:rgba(0,200,83,.12);color:var(--success);padding:.15rem .5rem;border-radius:20px;font-weight:600;margin-right:.5rem">${r.type}</span>
                    <span style="font-size:.78rem;color:var(--text-secondary)">${r.note || ''}</span>
                </div>
                <div style="display:flex;align-items:center;gap:.75rem">
                    <span style="font-family:'Outfit',sans-serif;font-size:.95rem;font-weight:700;color:var(--success)">+${this.formatCurrency(r.montant)}</span>
                    <button onclick="app.supprimerRevenu(${r.id})" style="border:none;background:transparent;color:var(--text-tertiary);cursor:pointer;font-size:.75rem;padding:.1rem .3rem">✕</button>
                </div>
            </div>`).join('');
    },

    refreshStatsDepenses() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];

        const depensesMois = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const totalDepenses = depensesMois
            .filter(d => !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())))
            .reduce((sum, d) => sum + d.montant, 0);

        const budgetTotal = Object.entries(this.data.budgets)
            .filter(([cat]) => !exclus.some(e => cat.toUpperCase().includes(e.toUpperCase())))
            .reduce((sum, [, v]) => sum + v, 0);
        const restant = budgetTotal - totalDepenses;
        const percent = budgetTotal > 0 ? (totalDepenses / budgetTotal) * 100 : 0;

        document.getElementById('s-depenses-mois').textContent = this.formatCurrency(totalDepenses);
        document.getElementById('s-budget-restant').textContent = this.formatCurrency(restant);
        document.getElementById('s-budget-total').textContent = this.formatCurrency(budgetTotal);

        const elDepDelta = document.getElementById('s-depenses-delta');
        const elBudDelta = document.getElementById('s-budget-delta');
        if (elDepDelta && budgetTotal > 0) {
            const pct = Math.round((totalDepenses / budgetTotal) * 100);
            const isOver = pct > 100;
            elDepDelta.className = 'stat-delta-pill ' + (isOver ? 'negative' : pct >= 80 ? 'negative' : 'positive');
            elDepDelta.textContent = (isOver ? '⚠ ' : '✓ ') + pct + '% du budget';
        }
        const catActives = Object.keys(this.data.budgets).filter(c => (this.data.budgets[c] || 0) > 0).length;
        if (elBudDelta) {
            elBudDelta.className = 'stat-delta-pill neutral';
            elBudDelta.textContent = catActives + ' catégorie' + (catActives > 1 ? 's' : '') + ' active' + (catActives > 1 ? 's' : '');
        }

        const progressBar = document.getElementById('s-progress-global');
        progressBar.style.width = Math.min(percent, 100) + '%';
        progressBar.className = 'progress-fill';
        if (percent >= 100) progressBar.classList.add('danger');
        else if (percent >= 80) progressBar.classList.add('warning');

        const depensesParCat = {};
        Object.keys(this.data.budgets).forEach(cat => {
            depensesParCat[cat] = depensesMois.filter(d => d.categorie === cat)
                .reduce((sum, d) => sum + d.montant, 0);
        });

        const container = document.getElementById('stats-categories');
        container.innerHTML = Object.keys(this.data.budgets).map(cat => {
            const depense = depensesParCat[cat] || 0;
            const budget = this.data.budgets[cat];
            const percent = budget > 0 ? (depense / budget) * 100 : 0;
            const classe = percent >= 100 ? 'danger' : '';
            const progressClasse = percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : '';

            return `
                <div class="stat-card ${classe}">
                    <div class="stat-label">${cat}</div>
                    <div class="stat-value">${this.formatCurrency(depense)}</div>
                    <div style="font-size:0.875rem;color:var(--text-tertiary);margin-top:0.25rem">
                        Budget: ${this.formatCurrency(budget)}
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClasse}" style="width:${Math.min(percent,100)}%"></div>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:0.25rem">
                        ${percent.toFixed(0)}% utilisé
                    </div>
                </div>
            `;
        }).join('');
        // Mise à jour du nouveau hero + cats budget
        this._refreshBudgetHeroAndCats();
    },

    toggleAnalyseFilters() {
        const periode = document.getElementById('analyse-periode').value;
        document.getElementById('filter-mois-choisi').style.display = periode === 'mois-choisi' ? 'block' : 'none';
        document.getElementById('filter-annee-choisie').style.display = periode === 'annee-choisie' ? 'block' : 'none';
        document.getElementById('filter-plage-debut').style.display = periode === 'plage' ? 'block' : 'none';
        document.getElementById('filter-plage-fin').style.display = periode === 'plage' ? 'block' : 'none';
        this.analyseDepenses();
    },

    analyseDepenses() {
        const periode = document.getElementById('analyse-periode').value;
        const categorie = document.getElementById('analyse-categorie').value;

        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        let depensesFiltrees = this.data.depenses.filter(
            d => !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase()))
        );
        const now = new Date();

        if (periode === 'mois') {
            depensesFiltrees = depensesFiltrees.filter(d => {
                const date = new Date(d.date);
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            });
        } else if (periode === 'mois-choisi') {
            const mois = document.getElementById('analyse-mois').value;
            if (mois) {
                const [year, month] = mois.split('-');
                depensesFiltrees = depensesFiltrees.filter(d => {
                    const date = new Date(d.date);
                    return date.getMonth() === parseInt(month) - 1 && date.getFullYear() === parseInt(year);
                });
            }
        } else if (periode === 'annee') {
            depensesFiltrees = depensesFiltrees.filter(d => {
                const date = new Date(d.date);
                return date.getFullYear() === now.getFullYear();
            });
        } else if (periode === 'annee-choisie') {
            const annee = parseInt(document.getElementById('analyse-annee').value);
            if (annee) {
                depensesFiltrees = depensesFiltrees.filter(d => {
                    const date = new Date(d.date);
                    return date.getFullYear() === annee;
                });
            }
        } else if (periode === 'plage') {
            const debut = document.getElementById('analyse-debut').value;
            const fin = document.getElementById('analyse-fin').value;
            if (debut && fin) {
                depensesFiltrees = depensesFiltrees.filter(d => d.date >= debut && d.date <= fin);
            }
        }

        if (categorie !== 'toutes') {
            // Double sécurité : si la catégorie choisie est épargne, on vide
            const estEpargne = exclus.some(e => categorie.toUpperCase().includes(e.toUpperCase()));
            if (estEpargne) {
                depensesFiltrees = [];
            } else {
                depensesFiltrees = depensesFiltrees.filter(d => d.categorie === categorie);
            }
        }

        const total = depensesFiltrees.reduce((sum, d) => sum + d.montant, 0);
        const parCat = {};
        depensesFiltrees.forEach(d => {
            parCat[d.categorie] = (parCat[d.categorie] || 0) + d.montant;
        });

        let html = `<div style="margin-top:1.5rem">`;
        html += `<h3 style="margin-bottom:1rem">Résultats de l'analyse</h3>`;

        if (periode === 'annee' || periode === 'annee-choisie' || periode === 'plage') {

            let nbMois = 12;
            if (periode === 'plage') {
                const debut = document.getElementById('analyse-debut').value;
                const fin = document.getElementById('analyse-fin').value;
                if (debut && fin) {
                    const d1 = new Date(debut), d2 = new Date(fin);
                    nbMois = Math.max(1, (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1);
                }
            }

            html += `<div class="grid grid-2">`;
            html += `<div class="stat-card"><div class="stat-label">Total dépensé</div><div class="stat-value">${this.formatCurrency(total)}</div></div>`;
            html += `<div class="stat-card"><div class="stat-label">Moyenne / mois</div><div class="stat-value accent">${this.formatCurrency(total / nbMois)}</div></div>`;
            html += `</div>`;

            html += `<h4 style="margin-top:1.5rem;margin-bottom:1rem">Détail par catégorie</h4>`;
            html += `<div class="table-container"><table class="table"><thead><tr><th>Catégorie</th><th>Total</th><th>Moy./mois</th><th>% du total</th></tr></thead><tbody>`;
            Object.keys(parCat).sort((a,b) => parCat[b]-parCat[a]).forEach(cat => {
                const pct = total > 0 ? (parCat[cat]/total*100).toFixed(1) : 0;
                html += `<tr>
                    <td>${cat}</td>
                    <td>${this.formatCurrency(parCat[cat])}</td>
                    <td style="font-weight:700;color:var(--accent-primary)">${this.formatCurrency(parCat[cat] / nbMois)}</td>
                    <td><div style="display:flex;align-items:center;gap:0.5rem">
                        <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:3px;min-width:60px">
                            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent-gradient-start),var(--accent-gradient-end));border-radius:3px"></div>
                        </div>
                        <span style="font-family:DM Mono,monospace;font-size:0.75rem;min-width:38px">${pct}%</span>
                    </div></td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        } else {
            html += `<div class="grid grid-2">`;
            html += `<div class="stat-card"><div class="stat-label">Total dépensé</div><div class="stat-value">${this.formatCurrency(total)}</div></div>`;
            html += `<div class="stat-card"><div class="stat-label">Nombre de dépenses</div><div class="stat-value">${depensesFiltrees.length}</div></div>`;
            html += `</div>`;

            if (categorie !== 'toutes') {

                const sorted = [...depensesFiltrees].sort((a, b) => new Date(b.date) - new Date(a.date));
                html += `
                <div style="margin-top:1.5rem">
                    <h4 style="margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">
                        📋 Transactions <span class="category-tag">${categorie}</span>
                        <span style="font-size:0.85rem;font-weight:400;color:var(--text-tertiary);margin-left:auto">${sorted.length} transaction${sorted.length > 1 ? 's' : ''}</span>
                    </h4>
                    <div class="table-container">
                        <table class="table">
                            <thead><tr><th>Date</th><th>Montant</th><th>Note</th><th></th></tr></thead>
                            <tbody>
                                ${sorted.map(d => `
                                <tr>
                                    <td>${new Date(d.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'})}</td>
                                    <td style="font-weight:700;background:linear-gradient(135deg,var(--accent-gradient-start),var(--accent-gradient-end));-webkit-background-clip:text;-webkit-text-fill-color:transparent">
                                        ${this.formatCurrency(d.montant)}
                                    </td>
                                    <td style="color:var(--text-secondary)">${d.note || '—'}</td>
                                    <td><button class="btn btn-small btn-secondary" onclick="app.supprimerDepense('${d.id}')">✕</button></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top:1rem;padding:1rem;background:var(--bg-secondary);border-radius:12px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border-color)">
                        <span style="font-weight:600;color:var(--text-secondary)">TOTAL ${categorie.toUpperCase()}</span>
                        <span style="font-size:1.5rem;font-weight:700;background:linear-gradient(135deg,var(--accent-gradient-start),var(--accent-gradient-end));-webkit-background-clip:text;-webkit-text-fill-color:transparent">
                            ${this.formatCurrency(total)}
                        </span>
                    </div>
                </div>`;
            } else {
                html += `<h4 style="margin-top:1.5rem;margin-bottom:0.75rem;font-size:0.9rem;color:var(--text-secondary)">Détail par catégorie <span style="font-size:0.7rem;font-family:DM Mono,monospace;opacity:0.6">— clique sur une ligne pour voir les transactions</span></h4>`;
                const catsSorted = Object.keys(parCat).sort((a,b) => parCat[b] - parCat[a]);
                html += `<div id="cat-accordion" style="display:flex;flex-direction:column;gap:0.5rem">`;
                catsSorted.forEach(cat => {
                    const montant = parCat[cat];
                    const pct = total > 0 ? (montant / total * 100).toFixed(1) : 0;
                    const txCat = depensesFiltrees.filter(d => d.categorie === cat).sort((a,b) => new Date(b.date) - new Date(a.date));
                    const txRows = txCat.map(d => `
                        <div style="display:flex;align-items:center;gap:1rem;padding:0.5rem 0.75rem;border-radius:8px;background:var(--bg-secondary);margin-bottom:4px">
                            <span style="font-family:DM Mono,monospace;font-size:0.7rem;color:var(--text-tertiary);min-width:80px">${new Date(d.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</span>
                            <span style="font-size:0.82rem;flex:1;color:var(--text-secondary)">${d.note || '—'}</span>
                            <span style="font-family:DM Mono,monospace;font-size:0.82rem;font-weight:600;color:var(--text-primary)">${this.formatCurrency(d.montant)}</span>
                            <button onclick="app.modifierNote('depense', '${d.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:0.82rem;padding:0 0.25rem" title="Modifier">✏️</button>
                            <button onclick="app.supprimerDepense('${d.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:0.75rem;padding:0 0.25rem" title="Supprimer">✕</button>
                        </div>`).join('');
                    html += `
                    <div class="cat-row" style="border-radius:14px;background:var(--bg-card);border:1px solid var(--border-color);overflow:hidden;box-shadow:4px 4px 8px var(--shadow-light),-4px -4px 8px var(--shadow-dark)">
                        <div onclick="app._toggleCatDetail(this)" style="display:flex;align-items:center;gap:1rem;padding:0.85rem 1rem;cursor:pointer;user-select:none">
                            <span class="category-tag" style="min-width:fit-content">${cat}</span>
                            <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:100px;overflow:hidden;box-shadow:inset 2px 2px 4px var(--shadow-light)">
                                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent-gradient-start),var(--accent-gradient-end));border-radius:100px;transition:width 0.4s ease"></div>
                            </div>
                            <span style="font-family:DM Mono,monospace;font-size:0.82rem;font-weight:600;color:var(--text-primary);min-width:70px;text-align:right">${this.formatCurrency(montant)}</span>
                            <span style="font-family:DM Mono,monospace;font-size:0.72rem;color:var(--text-tertiary);min-width:36px;text-align:right">${pct}%</span>
                            <span class="cat-chevron" style="font-size:0.75rem;color:var(--text-tertiary);transition:transform 0.25s;margin-left:0.25rem">▶</span>
                        </div>
                        <div class="cat-detail" style="display:none;padding:0 1rem 0.75rem">
                            ${txRows}
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0.75rem;margin-top:4px;border-top:1px solid var(--border-color)">
                                <span style="font-family:DM Mono,monospace;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary)">${txCat.length} transaction${txCat.length > 1 ? 's' : ''}</span>
                                <span style="font-family:'Outfit',sans-serif;font-size:1rem;font-weight:700;background:linear-gradient(135deg,var(--accent-gradient-start),var(--accent-gradient-end));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${this.formatCurrency(montant)}</span>
                            </div>
                        </div>
                    </div>`;
                });
                html += `</div>`;
            }
        }

        html += `</div>`;
        document.getElementById('analyse-results').innerHTML = html;
    },

    _toggleCatDetail(headerEl) {
        const row = headerEl.closest('.cat-row');
        const detail = row.querySelector('.cat-detail');
        const chevron = row.querySelector('.cat-chevron');
        const isOpen = detail.style.display !== 'none';

        document.querySelectorAll('.cat-detail').forEach(d => { d.style.display = 'none'; });
        document.querySelectorAll('.cat-chevron').forEach(c => { c.style.transform = ''; });
        if (!isOpen) {
            detail.style.display = 'block';
            chevron.style.transform = 'rotate(90deg)';
        }
    },

    switchPEAMode(mode) {
        document.querySelectorAll('.card-tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById('pea-manuel').style.display = mode === 'manuel' ? 'block' : 'none';
        document.getElementById('pea-import').style.display = mode === 'import' ? 'block' : 'none';
    },

    ajouterPEA() {
        const date = document.getElementById('pea-date').value;
        const valeur = parseFloat(document.getElementById('pea-val').value);
        const investi = parseFloat(document.getElementById('pea-inv').value);
        const note = document.getElementById('pea-note').value;

        if (!valeur || !investi) {
            this.notify('Remplir tous les champs', 'error');
            return;
        }

        const gain = valeur - investi;
        const perf = ((gain / investi) * 100).toFixed(2);

        this.data.suiviPEA.push({
            id: crypto.randomUUID(),
            date: date,
            valeur: valeur,
            investi: investi,
            gainPerte: gain,
            performance: perf,
            note: note
        });

        this.save();
        this.afficherPEA();
        this.refreshStatsPEA();
        this.refreshCharts();

        document.getElementById('pea-val').value = '';
        document.getElementById('pea-inv').value = '';
        document.getElementById('pea-note').value = '';
        this.notify('PEA enregistré', 'success');
    },

    afficherPEA() {
        const isMobile = window.innerWidth <= 768;
        const tbody = document.getElementById('table-pea');
        const mobileContainer = document.getElementById('mobile-pea-cards');
        const tableWrapper = document.getElementById('pea-table-wrapper');
        const btnShowMore = document.getElementById('show-more-pea');
        const historique = [...this.data.suiviPEA].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (isMobile) {
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (mobileContainer) mobileContainer.style.display = 'flex';
        } else {
            if (tableWrapper) tableWrapper.style.display = '';
            if (mobileContainer) mobileContainer.style.display = 'none';
        }

        if (historique.length === 0) {
            const _illuPea = (this._emptyIllus||{}).pea||'';
        const emptyHtml = `<div class="v-empty">${_illuPea}<div class="v-empty-title">Aucune entrée PEA</div><p class="v-empty-desc">Commence par renseigner la valeur et le montant investi dans ton PEA.</p></div>`;
            if (isMobile && mobileContainer) mobileContainer.innerHTML = emptyHtml;
            else if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:0"><div class="v-empty" style="padding:2rem 1rem">${(this._emptyIllus||{}).pea||''}<div class="v-empty-title">Aucune entrée PEA</div><p class="v-empty-desc">Commence par renseigner la valeur et le montant investi.</p></div></td></tr>`;
            if (btnShowMore) btnShowMore.style.display = 'none';
            return;
        }

        const limit = this.showMoreState.pea ? historique.length : 15;
        const toShow = historique.slice(0, limit);

        if (isMobile && mobileContainer) {
            mobileContainer.innerHTML = toShow.map(s => `
                <div class="mobile-dep-card" style="border-color:${s.gainPerte >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    <div class="mdc-top">
                        <span class="mdc-cat">📈 PEA</span>
                        <span class="mdc-amount">${this.formatCurrency(s.valeur)}</span>
                    </div>
                    <div class="mdc-note" style="color:${s.gainPerte >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600">
                        ${s.gainPerte >= 0 ? '+' : ''}${this.formatCurrency(s.gainPerte)} (${s.performance}%) · Investi : ${this.formatCurrency(s.investi)}
                    </div>
                    ${s.note ? `<div class="mdc-note">${s.note}</div>` : ''}
                    <div class="mdc-bottom">
                        <span class="mdc-date">${new Date(s.date).toLocaleDateString('fr-FR')}</span>
                        <div class="mdc-actions">
                            <button class="mdc-btn mdc-btn-edit" onclick="app.modifierNote('pea', '${s.id}')">✏️ Note</button>
                            <button class="mdc-btn mdc-btn-del" onclick="app.supprimerPEA('${s.id}')">🗑 Suppr.</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else if (tbody) {
            tbody.innerHTML = toShow.map(s => `
                <tr>
                    <td>${new Date(s.date).toLocaleDateString('fr-FR')}</td>
                    <td>${this.formatCurrency(s.valeur)}</td>
                    <td>${this.formatCurrency(s.investi)}</td>
                    <td class="${s.gainPerte >= 0 ? 'stat-change positive' : 'stat-change negative'}">
                        ${s.gainPerte >= 0 ? '+' : ''}${this.formatCurrency(s.gainPerte)} (${s.performance}%)
                    </td>
                    <td>
                        ${s.note || '—'}
                        <button class="btn btn-small btn-secondary" onclick="app.modifierNote('pea', '${s.id}')" style="margin-left:0.5rem" title="Modifier la note">✏️</button>
                    </td>
                    <td><button class="btn btn-small btn-secondary" onclick="app.supprimerPEA('${s.id}')">✕</button></td>
                </tr>
            `).join('');
        }

        if (btnShowMore) {
            if (historique.length > 15) {
                btnShowMore.style.display = 'block';
                btnShowMore.textContent = this.showMoreState.pea ? 'Afficher moins' : 'Afficher plus (' + (historique.length - 15) + ' autres)';
            } else {
                btnShowMore.style.display = 'none';
            }
        }
    },

    supprimerPEA(id) {
        this.showModal(
            'Supprimer l\'entrée PEA',
            'Voulez-vous vraiment supprimer cette entrée PEA ?',
            () => {
                this.data.suiviPEA = this.data.suiviPEA.filter(s => String(s.id) !== String(id));
                this.save();
                this.afficherPEA();
                this.refreshStatsPEA();
                this.refreshCharts();
                this.notify('Entrée supprimée', 'success');
            }
        );
    },

    refreshStatsPEA() {
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        if (this.data.suiviPEA.length === 0) {
            setEl('pea-valeur', this.formatCurrency(0));
            setEl('pea-investi', this.formatCurrency(0));
            const gainEl0 = document.getElementById('pea-gain');
            if (gainEl0) { gainEl0.textContent = this.formatCurrency(0); gainEl0.className = 'pea-hs-val'; }
            const perfEl0 = document.getElementById('pea-perf');
            if (perfEl0) { perfEl0.textContent = '0 %'; perfEl0.className = 'pea-hs-val'; }
            const badge0 = document.getElementById('pea-perf-badge');
            if (badge0) { badge0.textContent = '0 %'; badge0.className = 'pea-hero-badge'; }
            setEl('pea-plafond', '—');
            setEl('pea-hero-sync-label', '—');
            return;
        }

        const sorted = [...this.data.suiviPEA].sort((a, b) => new Date(b.date) - new Date(a.date));
        const dernier = sorted[0];
        const perf = parseFloat(dernier.performance) || 0;
        const gain = dernier.gainPerte || 0;

        setEl('pea-valeur', this.formatCurrency(dernier.valeur));
        setEl('pea-investi', this.formatCurrency(dernier.investi));

        const gainEl = document.getElementById('pea-gain');
        if (gainEl) {
            gainEl.textContent = (gain >= 0 ? '+' : '') + this.formatCurrency(gain);
            gainEl.className = 'pea-hs-val ' + (gain >= 0 ? 'pos' : 'neg');
        }

        const perfEl = document.getElementById('pea-perf');
        if (perfEl) {
            perfEl.textContent = (perf >= 0 ? '+' : '') + perf.toFixed(2) + ' %';
            perfEl.className = 'pea-hs-val ' + (perf >= 0 ? 'pos' : 'neg');
        }

        const badge = document.getElementById('pea-perf-badge');
        if (badge) {
            badge.textContent = (perf >= 0 ? '▲ +' : '▼ ') + Math.abs(perf).toFixed(2) + ' %';
            badge.className = 'pea-hero-badge ' + (perf >= 0 ? 'pos' : 'neg');
        }

        const plafondPct = dernier.investi ? ((dernier.investi / 150000) * 100).toFixed(1) + ' %' : '—';
        setEl('pea-plafond', plafondPct);
        setEl('pea-hero-sync-label', 'Mise à jour · ' + new Date(dernier.date).toLocaleDateString('fr-FR'));
    },

    /* ── Dropdown outils PEA (budget-style) ── */
    togglePeaOutilsMenu() {
        const menu = document.getElementById('pea-outils-menu');
        const btn  = document.getElementById('pea-outils-btn');
        if (!menu || !btn) return;
        const open = menu.classList.toggle('open');
        btn.classList.toggle('open-state', open);
        if (open) {
            const close = (e) => {
                if (!document.getElementById('pea-outils-wrap')?.contains(e.target)) {
                    menu.classList.remove('open');
                    btn.classList.remove('open-state');
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 10);
        }
    },

    /* ── Ouvre le panel slide-in sur un onglet donné ── */
    openPeaPanel(tab) {
        document.getElementById('pea-outils-menu')?.classList.remove('open');
        document.getElementById('pea-outils-btn')?.classList.remove('open-state');
        const overlay = document.getElementById('pea-panel-overlay');
        const panel   = document.getElementById('pea-panel');
        if (!panel || !overlay) return;
        overlay.classList.add('open');
        panel.classList.add('open');
        document.body.style.overflow = 'hidden';
        this.switchPeaPanelTab(tab, document.getElementById('pea-ptab-' + tab));
    },

    closePeaPanel() {
        document.getElementById('pea-panel-overlay')?.classList.remove('open');
        document.getElementById('pea-panel')?.classList.remove('open');
        document.body.style.overflow = '';
    },

    switchPeaPanelTab(name, el) {
        ['previsions', 'calculateur', 'retraite', 'simulateur'].forEach(t => {
            const p = document.getElementById('pea-panel-' + t);
            if (p) p.style.display = t === name ? 'block' : 'none';
        });
        document.querySelectorAll('.pea-panel-tab').forEach(b => b.classList.toggle('active', b === el));
        const titles = { previsions: '📊 Prévisions', calculateur: '🧮 Calculateur d\'ordre', retraite: '👴 Projection retraite', simulateur: '🎲 Simulateur « Et si… »' };
        const titleEl = document.getElementById('pea-panel-title');
        if (titleEl) titleEl.textContent = titles[name] || '🧮 Outils PEA';
        if (name === 'calculateur') this.genererLignes();
        if (name === 'previsions' && this.data.suiviPEA.length > 0) {
            const sorted = [...this.data.suiviPEA].sort((a,b) => new Date(b.date)-new Date(a.date));
            const el2 = document.getElementById('prev-pea-actuel');
            if (el2 && !el2.value) el2.value = sorted[0].valeur;
        }
    },

    /* ── Toggle affichage carte portefeuille ── */
    togglePeaPfCard() {
        const card = document.getElementById('pea-col-lignes');
        const btn  = document.getElementById('pea-toggle-pf-btn');
        const icon = document.getElementById('pea-toggle-pf-icon');
        if (!card) return;
        const hidden = card.style.display === 'none';
        if (hidden) {
            card.style.display = '';
            if (btn)  btn.classList.remove('pf-masque');
            if (icon) icon.textContent = '👁';
        } else {
            card.style.display = 'none';
            if (btn)  btn.classList.add('pf-masque');
            if (icon) icon.textContent = '🙈';
        }
    },

    /* ── Filtre de période sur le graphique PEA ── */
    switchPeaChartPeriod(el, period) {
        document.querySelectorAll('#tab-pea .period-btn').forEach(b => {
            b.className = b === el ? 'btn btn-small period-btn active' : 'btn btn-small btn-secondary period-btn';
        });
        this._peaChartPeriod = period;
        this.chartPEA();
    },

    importPEA(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n').filter(l => l.trim());
                const startIndex = lines[0].toLowerCase().includes('date') ? 1 : 0;

                let count = 0;
                for (let i = startIndex; i < lines.length; i++) {
                    const [date, valeur, investi] = lines[i].split(/[,;]/);
                    if (date && valeur && investi) {
                        const val = parseFloat(valeur.trim());
                        const inv = parseFloat(investi.trim());
                        const gain = val - inv;

                        this.data.suiviPEA.push({
                            id: crypto.randomUUID(),
                            date: date.trim(),
                            valeur: val,
                            investi: inv,
                            gainPerte: gain,
                            performance: ((gain / inv) * 100).toFixed(2),
                            note: 'Import CSV'
                        });
                        count++;
                    }
                }

                this.save();
                this.afficherPEA();
                this.refreshStatsPEA();
                this.refreshCharts();
                this.notify(count + ' entrée(s) importée(s)', 'success');
            } catch (err) {
                this.notify('Erreur import CSV', 'error');
            }
        };
        reader.readAsText(file);
    },

    ajouterPatrimoine() {
        const dateVal = document.getElementById('pat-mois').value;
        const mois = dateVal.substring(0, 7);
        const values = {};
        let total = 0;

        this.data.comptes.forEach(compte => {
            const id = 'pat-' + compte.replace(/\s/g,'');
            const val = parseFloat(document.getElementById(id).value) || 0;
            values[compte] = val;
            total += val;
        });

        // Remplacer uniquement une entrée ayant exactement la même date (même jour)
        this.data.patrimoine = this.data.patrimoine.filter(p => (p.date || p.mois) !== dateVal);
        this.data.patrimoine.push({
            id: crypto.randomUUID(),
            date: dateVal,
            mois: mois,
            ...values,
            total: total
        });

        this.save();
        this.afficherPatrimoine();
        this.refreshStatsPatrimoine();
        this.refreshCharts();
        this.notify('Patrimoine enregistré', 'success');
    },

    afficherPatrimoine() {
        /* Auto-expand la section historique */
        const histBody    = document.getElementById('hist-pat-body');
        const histArrow   = document.getElementById('hist-pat-arrow');
        const histTrigger = document.getElementById('hist-pat-trigger');
        if (histBody && histBody.style.display === 'none') {
            histBody.style.display = 'block';
            if (histArrow)   histArrow.style.transform = 'rotate(90deg)';
            if (histTrigger) histTrigger.style.borderBottomColor = 'var(--border-color)';
        }

        const container = document.getElementById('pat-timeline');
        const btnShowMore = document.getElementById('show-more-patrimoine');
        const historique = [...this.data.patrimoine].sort((a, b) => {
            const da = (a.date || a.mois || '');
            const db = (b.date || b.mois || '');
            return db.localeCompare(da);
        });

        if (!container) return;

        if (historique.length === 0) {
            const _illuPat = (this._emptyIllus||{}).patrimoine||'';
            container.innerHTML = `<div class="v-empty">${_illuPat}<div class="v-empty-title">Aucune entrée patrimoine</div><p class="v-empty-desc">Saisis ton premier point de patrimoine pour démarrer le suivi.</p></div>`;
            if (btnShowMore) btnShowMore.style.display = 'none';
            return;
        }

        const limit = this.showMoreState.patrimoine ? historique.length : 15;
        const toShow = historique.slice(0, limit);

        container.innerHTML = toShow.map((p, i) => {
            const prev = historique[i + 1];
            const delta = prev ? (p.total - prev.total) : null;
            const deltaHtml = delta !== null
                ? `<span class="pat-tl-delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '▲' : '▼'} ${this.formatCurrency(Math.abs(delta))}</span>`
                : `<span class="pat-tl-delta neu">—</span>`;
            const dotClass = i === 0 ? 'pat-tl-dot pat-tl-dot--first' : 'pat-tl-dot';
            const dateLabel = new Date(p.date || p.mois).toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});
            const chips = this.data.comptes
                .filter(c => p[c] > 0)
                .map(c => `<span class="pat-tl-chip">${c} · ${this.formatCurrency(p[c])}</span>`)
                .join('');
            return `
            <div class="pat-tl-item">
                <div class="${dotClass}"></div>
                <div class="pat-tl-card">
                    <div class="pat-tl-left">
                        <div class="pat-tl-date">${dateLabel}</div>
                        <div class="pat-tl-chips">${chips}</div>
                    </div>
                    <div class="pat-tl-right">
                        <div class="pat-tl-total">${this.formatCurrency(p.total)}</div>
                        ${deltaHtml}
                        <button class="pat-tl-del" onclick="app.supprimerPatrimoine('${p.id}')">✕ supprimer</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        if (btnShowMore) {
            if (historique.length > 15) {
                btnShowMore.style.display = 'block';
                btnShowMore.textContent = this.showMoreState.patrimoine ? 'Afficher moins' : 'Afficher plus (' + (historique.length - 15) + ' autres)';
            } else {
                btnShowMore.style.display = 'none';
            }
        }
    },

    supprimerPatrimoine(id) {
        this.showModal(
            'Supprimer l\'entrée',
            'Voulez-vous vraiment supprimer cette entrée de patrimoine ?',
            () => {
                this.data.patrimoine = this.data.patrimoine.filter(p => String(p.id) !== String(id));
                this.save();
                this.afficherPatrimoine();
                this.refreshStatsPatrimoine();
                this.refreshCharts();
                this.notify('Entrée supprimée', 'success');
            }
        );
    },

    refreshStatsPatrimoine() {
        const bar = document.getElementById('pat-repartition-bar');
        if (this.data.patrimoine.length === 0) {
            document.getElementById('pat-total').textContent = this.formatCurrency(0);
            document.getElementById('pat-securise').textContent = this.formatCurrency(0);
            document.getElementById('pat-invest').textContent = this.formatCurrency(0);
            if (bar) bar.style.display = 'none';
            return;
        }

        const sorted = [...this.data.patrimoine].sort((a, b) => { const mc = b.mois.localeCompare(a.mois); return mc !== 0 ? mc : (b.date||b.mois).localeCompare(a.date||a.mois); });
        const dernier = sorted[0];

        let securise = 0;
        let invest = 0;
        const liquides = this.data.comptesLiquides || [];
        this.data.comptes.forEach(compte => {
            const val = dernier[compte] || 0;
            if (liquides.includes(compte)) {
                securise += val;
            } else {
                invest += val;
            }
        });

        const total = dernier.total || (securise + invest) || 1;
        const pctSecurise = total > 0 ? (securise / total * 100) : 0;
        const pctInvest   = total > 0 ? (invest   / total * 100) : 0;

        document.getElementById('pat-total').textContent = this.formatCurrency(dernier.total);
        document.getElementById('pat-securise').textContent = this.formatCurrency(securise);
        document.getElementById('pat-invest').textContent = this.formatCurrency(invest);

        const elSecPct = document.getElementById('pat-securise-pct');
        const elInvPct = document.getElementById('pat-invest-pct');
        if (elSecPct) elSecPct.textContent = total > 0 ? pctSecurise.toFixed(1) + '% du total' : '';
        if (elInvPct) elInvPct.textContent = total > 0 ? pctInvest.toFixed(1)   + '% du total' : '';

        const bSec = document.getElementById('pat-bar-securise');
        const bInv = document.getElementById('pat-bar-invest');
        const lSec = document.getElementById('pat-lbl-securise');
        const lInv = document.getElementById('pat-lbl-invest');
        if (bSec) bSec.style.width = pctSecurise.toFixed(1) + '%';
        if (bInv) bInv.style.width = pctInvest.toFixed(1)   + '%';
        if (lSec) lSec.textContent = this.formatCurrency(securise) + ' · ' + pctSecurise.toFixed(1) + '%';
        if (lInv) lInv.textContent = this.formatCurrency(invest)   + ' · ' + pctInvest.toFixed(1)   + '%';
        if (bar) bar.style.display = total > 0 ? 'block' : 'none';

        /* ── Éléments glass ── */
        const glDate  = document.getElementById('pat-gl-date');
        const glDelta = document.getElementById('pat-gl-delta');
        const elSecPct2 = document.getElementById('pat-securise-pct');
        const elInvPct2 = document.getElementById('pat-invest-pct');
        if (elSecPct2) elSecPct2.textContent = total > 0 ? pctSecurise.toFixed(1) + '%' : '';
        if (elInvPct2) elInvPct2.textContent = total > 0 ? pctInvest.toFixed(1)   + '%' : '';
        if (glDate) {
            try {
                const d = new Date(dernier.date || dernier.mois);
                glDate.textContent = d.toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});
            } catch(e) {}
        }
        if (glDelta) {
            const sortedAll = [...this.data.patrimoine].sort((a,b) => { const mc=b.mois.localeCompare(a.mois); return mc!==0?mc:(b.date||b.mois).localeCompare(a.date||a.mois); });
            if (sortedAll.length > 1) {
                const prev = sortedAll[1];
                const diff = dernier.total - prev.total;
                const pct  = prev.total > 0 ? ((diff / prev.total) * 100).toFixed(2) : '0.00';
                glDelta.textContent = (diff >= 0 ? '▲ +' : '▼ ') + this.formatCurrency(Math.abs(diff)) + ' · ' + (diff >= 0 ? '+' : '') + pct + '% vs. saisie précédente';
                glDelta.style.color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
            } else {
                glDelta.textContent = '— première saisie';
                glDelta.style.color = 'var(--text-tertiary)';
            }
        }
        /* Liste des comptes dynamique */
        const glList = document.getElementById('pat-gl-comptes-list');
        if (glList) {
            const liquides2 = this.data.comptesLiquides || [];
            const ICONS = {'livret':'🏦','ldds':'💰','cel':'🏦','pea':'📈','cto':'🌍','assurance':'🔐','vie':'🔐','immo':'🏠','crypto':'₿'};
            const getIcon = name => { const n = name.toLowerCase(); for (const [k,v] of Object.entries(ICONS)) if (n.includes(k)) return v; return '💼'; };
            glList.innerHTML = this.data.comptes.filter(c => (dernier[c]||0) > 0).map(c => {
                const val  = dernier[c] || 0;
                const pctC = total > 0 ? (val/total*100).toFixed(0) : 0;
                const type = liquides2.includes(c) ? 'Liquidités' : 'Investissement';
                return '<div class="pat-gl-acc-item"><div class="pat-gl-acc-icon">' + getIcon(c) + '</div><div class="pat-gl-acc-body"><div class="pat-gl-acc-name">' + c + '</div><div class="pat-gl-acc-type">' + type + ' · ' + pctC + '%</div></div><div class="pat-gl-acc-val">' + this.formatCurrency(val) + '</div></div>';
            }).join('');
        }
    },

    calculerPrevisionsPEA() {
        const actuel = parseFloat(document.getElementById('prev-pea-actuel').value) || 0;
        const mensuel = parseFloat(document.getElementById('prev-pea-mensuel').value) || 0;
        const taux = parseFloat(document.getElementById('prev-pea-taux').value) / 100 || 0;
        const annees = parseInt(document.getElementById('prev-pea-annees').value) || 10;

        const tauxMensuel = taux / 12;
        const mois = annees * 12;

        let valeur = actuel;
        const historiquePrev = [{periode: 0, valeur: actuel, investi: 0}];
        let totalVerse = 0;

        for (let i = 1; i <= mois; i++) {
            totalVerse += mensuel;
            valeur = (valeur + mensuel) * (1 + tauxMensuel);
            historiquePrev.push({
                periode: i,
                valeur: valeur,
                investi: actuel + totalVerse
            });
        }

        const gains = valeur - (actuel + totalVerse);

        document.getElementById('prev-pea-final').textContent = this.formatCurrency(valeur);
        document.getElementById('prev-pea-verse').textContent = this.formatCurrency(actuel + totalVerse);
        document.getElementById('prev-pea-gains').textContent = this.formatCurrency(gains);
        document.getElementById('prev-pea-results').style.display = 'block';

        this.calculerProjectionRealiste(historiquePrev, annees);
        this.chartPrevCompare(historiquePrev, annees);
    },

    calculerPrevisionsPatrimoine() {
        const actuel = parseFloat(document.getElementById('prev-pat-actuel').value) || 0;
        const mensuel = parseFloat(document.getElementById('prev-pat-mensuel').value) || 0;
        const taux = parseFloat(document.getElementById('prev-pat-taux').value) / 100 || 0;
        const annees = parseInt(document.getElementById('prev-pat-annees').value) || 10;

        const tauxMensuel = taux / 12;
        const mois = annees * 12;

        let valeur = actuel;
        const historique = [{mois: 0, valeur: actuel}];
        let totalEpargne = 0;

        for (let i = 1; i <= mois; i++) {
            totalEpargne += mensuel;
            valeur = (valeur + mensuel) * (1 + tauxMensuel);
            historique.push({mois: i, valeur: valeur});
        }

        const interets = valeur - (actuel + totalEpargne);

        document.getElementById('prev-pat-final').textContent = this.formatCurrency(valeur);
        document.getElementById('prev-pat-epargne').textContent = this.formatCurrency(actuel + totalEpargne);
        document.getElementById('prev-pat-interets').textContent = this.formatCurrency(interets);
        document.getElementById('prev-pat-results').style.display = 'block';

        this.chartPrevPat(historique, annees);
        this.chartCompare();
    },

    genererLignes() {
        const n = parseInt(document.getElementById('calc-lignes').value) || 3;
        const tbody = document.getElementById('calc-body');

        tbody.innerHTML = Array.from({length: n}, (_, i) => `
            <tr>
                <td><input type="text" class="table-input" id="cn-${i}" placeholder="Action"></td>
                <td><input type="number" class="table-input" id="ca-${i}" value="${i === 0 ? 40 : 30}" min="0" max="100" onchange="app.calculer()"></td>
                <td id="cb-${i}">0 €</td>
                <td><input type="number" class="table-input" id="cc-${i}" placeholder="0.00" step="0.01" onchange="app.calculer()"></td>
                <td id="cq-${i}">0</td>
                <td id="ci-${i}">0 €</td>
                <td id="cr-${i}">0 €</td>
            </tr>
        `).join('');
    },

    calculer() {
        const budget = parseFloat(document.getElementById('calc-budget').value) || 0;
        const n = parseInt(document.getElementById('calc-lignes').value) || 3;

        let totalInvesti = 0;

        for (let i = 0; i < n; i++) {
            const alloc = parseFloat(document.getElementById('ca-' + i).value) || 0;
            const cours = parseFloat(document.getElementById('cc-' + i).value) || 0;

            const budgetLigne = (budget * alloc) / 100;
            const quantite = cours > 0 ? Math.floor(budgetLigne / cours) : 0;
            const investi = quantite * cours;
            const reste = budgetLigne - investi;

            document.getElementById('cb-' + i).textContent = this.formatCurrency(budgetLigne);
            document.getElementById('cq-' + i).textContent = quantite;
            document.getElementById('ci-' + i).textContent = this.formatCurrency(investi);
            document.getElementById('cr-' + i).textContent = this.formatCurrency(reste);

            totalInvesti += investi;
        }

        document.getElementById('calc-total').textContent = this.formatCurrency(budget);
        document.getElementById('calc-investi').textContent = this.formatCurrency(totalInvesti);
        document.getElementById('calc-reste').textContent = this.formatCurrency(budget - totalInvesti);
    },

    allocation(type) {
        const allocations = {
            conservateur: [60, 30, 10],
            equilibre: [50, 30, 20],
            dynamique: [40, 40, 20],
            agressif: [30, 30, 40]
        };

        const alloc = allocations[type];
        document.getElementById('calc-lignes').value = alloc.length;
        this.genererLignes();

        alloc.forEach((val, i) => {
            document.getElementById('ca-' + i).value = val;
        });

        this.calculer();
        this.notify('Allocation ' + type + ' appliquée', 'success');
    },

    animateValue(el, target, isCurrency = true, duration = 700) {
        if (!el) return;
        el.classList.add('animating');
        const start = 0;
        const startTime = performance.now();
        const update = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - start) * eased);
            el.textContent = isCurrency ? this.formatCurrency(current) : current + (el.dataset.suffix || '');
            if (progress < 1) requestAnimationFrame(update);
            else { el.textContent = isCurrency ? this.formatCurrency(target) : target + (el.dataset.suffix || ''); el.classList.remove('animating'); }
        };
        requestAnimationFrame(update);
    },

    refreshDashboard() {
        const patrimoineTotal = this.data.patrimoine.length > 0 ?
            [...this.data.patrimoine].sort((a, b) => { const mc = b.mois.localeCompare(a.mois); return mc !== 0 ? mc : (b.date||b.mois).localeCompare(a.date||a.mois); })[0].total : 0;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const depensesMois = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === month && date.getFullYear() === year;
        }).reduce((sum, d) => sum + d.montant, 0);

        const prevMonth = new Date(year, month - 1, 1);
        const depensesPrev = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear();
        }).reduce((sum, d) => sum + d.montant, 0);

        const peaActuel = this.data.suiviPEA.length > 0 ?
            [...this.data.suiviPEA].sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;

        this.animateValue(document.getElementById('d-patrimoine'), patrimoineTotal);
        document.getElementById('d-depenses').textContent = this.formatCurrency(depensesMois);
        document.getElementById('d-pea').textContent = peaActuel ? peaActuel.performance + '%' : '0%';

        if (peaActuel) {
            const elem = document.getElementById('d-pea-gain');
            elem.textContent = (peaActuel.gainPerte >= 0 ? '+' : '') + this.formatCurrency(peaActuel.gainPerte);
            elem.className = 'stat-change ' + (peaActuel.gainPerte >= 0 ? 'positive' : 'negative');
        }

        if (this.data.patrimoine.length > 1) {
            const sorted = [...this.data.patrimoine].sort((a, b) => { const mc = b.mois.localeCompare(a.mois); return mc !== 0 ? mc : (b.date||b.mois).localeCompare(a.date||a.mois); });
            const precedent = sorted[1];
            const diff = patrimoineTotal - precedent.total;
            const pct = ((diff / precedent.total) * 100).toFixed(2);
            const elem = document.getElementById('d-patrimoine-ch');
            elem.textContent = (diff >= 0 ? '+' : '') + this.formatCurrency(diff) + ' (' + pct + '%)';
            elem.className = 'stat-change ' + (diff >= 0 ? 'positive' : 'negative');
        }

        this.refreshRevenus();

        const wDep = document.getElementById('widget-dep-mois');
        const wPrev = document.getElementById('widget-dep-prev');
        const wDelta = document.getElementById('widget-dep-delta');
        const wArrow = document.getElementById('widget-dep-arrow');
        if (wDep) wDep.textContent = this.formatCurrency(depensesMois);
        if (wPrev) wPrev.textContent = this.formatCurrency(depensesPrev);
        if (wDelta && depensesPrev > 0) {
            const delta = depensesMois - depensesPrev;
            const pct = ((delta / depensesPrev) * 100).toFixed(1);
            const sign = delta >= 0 ? '+' : '';
            wDelta.textContent = `${sign}${pct}%`;
            wDelta.style.background = delta > 0 ? 'rgba(244,67,54,.1)' : 'rgba(0,200,83,.1)';
            wDelta.style.color = delta > 0 ? 'var(--danger)' : 'var(--success)';
            if (wArrow) { wArrow.textContent = delta > 0 ? '↑' : '↓'; wArrow.style.color = delta > 0 ? 'var(--danger)' : 'var(--success)'; }
        }
        const wPea = document.getElementById('widget-pea');
        const wPeaGain = document.getElementById('widget-pea-gain');
        if (wPea && peaActuel) { wPea.textContent = peaActuel.performance + '%'; wPea.style.color = peaActuel.performance >= 0 ? 'var(--success)' : 'var(--danger)'; }
        if (wPeaGain && peaActuel) { wPeaGain.textContent = (peaActuel.gainPerte >= 0 ? '+' : '') + this.formatCurrency(peaActuel.gainPerte); wPeaGain.style.color = peaActuel.gainPerte >= 0 ? 'var(--success)' : 'var(--danger)'; }

        this.refreshCharts();
        this.refreshVueRapide();
        this.refreshAlertes();
    },

    isDarkMode() {
        const t = document.body.getAttribute('data-theme');
        return ['dark','abyss','obsidian','arctic'].includes(t);
    },

    _tabCardsConfig: {
        'dashboard': [
            { id: 'dash-hero',          label: 'Patrimoine Net',          sub: 'Hero — Total & taux épargne' },
            { id: 'dash-widget',        label: 'Ce mois vs mois dernier', sub: 'Widget comparatif rapide' },
            { id: 'dash-recap-semaine', label: 'Récap de la semaine',     sub: 'Résumé hebdomadaire' },
            { id: 'dash-acces',         label: '⚡ Accès Rapide',         sub: 'Boutons de navigation' },
            { id: 'dash-alertes',       label: '🔔 Alertes Intelligentes',sub: 'Anomalies & dépassements' },
            { id: 'dash-evol',          label: 'Évolution Patrimoine',    sub: 'Graphique patrimoine' },
            { id: 'dash-repart',        label: 'Répartition',             sub: 'Donut des actifs' },
            { id: 'dash-dep-budget',    label: 'Dépenses vs Budget',      sub: 'Graphique barres' },
            { id: 'dash-heatmap',       label: '🌡 Heatmap annuelle',     sub: 'Intensité des dépenses' },
        ],
        'depenses': [
            { id: 'dep-pointage',    label: '💳 Soldes bancaires',        sub: 'Pointage de vos comptes' },
            { id: 'dep-revenus',     label: '💰 Revenu',                   sub: 'Saisie & stats du mois' },
            { id: 'dep-saisie',      label: '➕ Ajouter une dépense',     sub: 'Formulaire de saisie' },
            { id: 'dep-etat-cat',    label: 'État des catégories',        sub: 'Budget par catégorie' },
            { id: 'dep-comparaison', label: '📊 Comparaison mois à mois', sub: 'Comparaison entre deux mois' },
            { id: 'dep-regle5030',   label: '⚖️ Règle 50 / 30 / 20',     sub: 'Analyse budgétaire' },
            { id: 'dep-recurrentes', label: '🔄 Dépenses Récurrentes',    sub: 'Charges fixes & abonnements' },
            { id: 'dep-analyse',     label: '🔍 Analyse des dépenses',    sub: 'Graphique par période' },
            { id: 'dep-historique',  label: '📋 Historique',              sub: 'Toutes les transactions' },
            { id: 'dep-hist-revenus',label: '📊 Historique Revenus',      sub: 'Cashflow mensuel' },
        ],
        'pea': [
            { id: 'pea-stats',      label: 'Stats PEA',                    sub: 'Valeur, investi, gain' },
            { id: 'pea-saisie',     label: 'Mise à jour PEA',              sub: 'Saisie valeur & investi' },
            { id: 'pea-lignes',     label: '📋 Lignes du Portefeuille',    sub: 'Actions & plus-values' },
            { id: 'pea-graphique',  label: 'Évolution PEA',                sub: 'Graphique valeur vs investi' },
            { id: 'pea-retraite',   label: '👴 Projection Retraite',       sub: 'Simulateur retraite' },
            { id: 'pea-simulateur', label: '🎲 Simulateur "Et si…"',       sub: 'Simulation de scénarios' },
            { id: 'pea-historique', label: '📋 Historique PEA',            sub: 'Entrées historiques' },
        ],
        'patrimoine': [
            { id: 'pat-stats',      label: 'Vue Patrimoine',           sub: 'Total, comptes, graphique' },
            { id: 'pat-barre',      label: 'Répartition du patrimoine',sub: 'Liquidités vs investissements' },
            { id: 'pat-saisie',     label: 'Mise à jour',              sub: 'Saisie mensuelle' },
            { id: 'pat-evol',       label: 'Évolution du Patrimoine',  sub: 'Graphique par compte' },
            { id: 'pat-historique', label: 'Historique Patrimoine',    sub: 'Tableau historique' },
        ],
        'bilan': [
            { id: 'bilan-annuel',     label: '🏅 Bilan annuel',       sub: 'Résumé par année' },
            { id: 'bilan-rapport',    label: '📄 Rapport mensuel',    sub: 'Analyse du mois' },
            { id: 'bilan-objectifs',  label: '🎯 Objectifs',          sub: 'Suivi des objectifs' },
            { id: 'bilan-notes',      label: '📝 Notes Mensuelles',   sub: 'Journal financier' },
            { id: 'bilan-hist-notes', label: 'Historique des notes',  sub: 'Toutes les notes' },
        ],
    },

    /* ── Layout par défaut (référence pour reset) ───────────────────────── */
    _defaultLayout: {
        'dashboard':  [['dash-hero'],['dash-widget'],['dash-recap-semaine'],['dash-acces'],['dash-alertes'],['dash-evol','dash-repart'],['dash-dep-budget'],['dash-heatmap']],
        'depenses':   [['dep-pointage'],['dep-revenus','dep-saisie'],['dep-etat-cat'],['dep-comparaison','dep-regle5030','dep-recurrentes'],['dep-analyse'],['dep-historique'],['dep-hist-revenus']],
        'pea':        [['pea-stats'],['pea-saisie'],['pea-graphique'],['pea-historique']],
        'patrimoine': [['pat-stats'],['pat-historique']],
        'bilan':      [['bilan-annuel'],['bilan-rapport'],['bilan-objectifs'],['bilan-notes'],['bilan-hist-notes']],
    },

    /* ══════════════════════════════════════════════════════════════════════
       VAULT LAYOUT EDITOR — éditeur de mise en page visuel
       Remplace l'ancien système toggle + ordre linéaire
       ══════════════════════════════════════════════════════════════════════ */

    openTabCustomizer(tabId) {
        const config  = this._tabCardsConfig[tabId];
        if (!config) return;
        const cardMap = {};
        config.forEach(c => cardMap[c.id] = c);

        const currentLayout = JSON.parse(JSON.stringify(
            this.data.cardLayout?.[tabId] || this._defaultLayout[tabId] || config.map(c => [c.id])
        ));
        const hiddenSet = new Set(Object.keys(this.data.hiddenCards?.[tabId] || {}));
        const tabNames  = { dashboard:'Dashboard', depenses:'Budget', pea:'PEA', patrimoine:'Patrimoine', bilan:'Bilan' };

        let modal = document.getElementById('vleModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'vleModal';
            modal.className = 'modal';
            modal.style.cssText = 'z-index:2000;max-width:580px;width:95%;max-height:92vh;';
            document.body.appendChild(modal);
        }

        const rowsHTML = currentLayout.map(row => {
            const chips = row.filter(id => !hiddenSet.has(id) && cardMap[id]).map(id =>
                `<div class="vle-chip" draggable="true" data-card-id="${id}">
                    <span class="vle-handle">⠿</span>
                    <span class="vle-chip-label">${cardMap[id].label}</span>
                    <span class="vle-chip-rm">✕</span>
                </div>`
            ).join('');
            return chips
                ? `<div class="vle-row">${chips}</div>`
                : `<div class="vle-row vle-row-empty"><span class="vle-empty-hint">Glisse une carte ici</span></div>`;
        }).join('');

        const poolHTML = [...hiddenSet].filter(id => cardMap[id]).map(id =>
            `<div class="vle-pool-chip" data-card-id="${id}">${cardMap[id].label}</div>`
        ).join('');

        modal.innerHTML = `
          <div class="modal-header" style="padding:1.5rem 1.75rem 1rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">
            <div>
              <div style="font-size:.58rem;font-family:DM Mono,monospace;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.12em;margin-bottom:.3rem">Mise en page · ${tabNames[tabId]||tabId}</div>
              <h2 class="modal-title" style="font-size:1rem;font-family:'Outfit',sans-serif;font-weight:700">Éditeur de disposition</h2>
            </div>
            <div style="font-size:.72rem;color:var(--text-secondary);line-height:1.55;text-align:right;max-width:210px">
              <strong>⠿</strong> glisser · même ligne = côté à côté · <strong>✕</strong> masquer
            </div>
          </div>
          <div class="modal-body" style="padding:.75rem 1.25rem 1rem;overflow-y:auto">
            <div id="vle-canvas" style="display:flex;flex-direction:column;gap:.4rem">
              ${rowsHTML}
              <div class="vle-new-row-zone" id="vle-new-row-zone">＋ Nouvelle ligne — dépose ici</div>
            </div>
            <div id="vle-pool-wrap" style="${hiddenSet.size > 0 ? '' : 'display:none'}">
              <div style="font-size:.58rem;font-family:DM Mono,monospace;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.12em;margin:.85rem 0 .5rem">Masquées — clique pour remettre</div>
              <div id="vle-pool" style="display:flex;flex-wrap:wrap;gap:.4rem">${poolHTML}</div>
            </div>
          </div>
          <div class="modal-footer" style="padding:.85rem 1.25rem 1.25rem;display:flex;gap:.6rem;align-items:center">
            <button class="vp-btn-cancel" onclick="app._vleReset('${tabId}')" style="margin-right:auto;font-size:.72rem">🔄 Réinitialiser</button>
            <button class="vp-btn-cancel" onclick="app._vleClose()">Annuler</button>
            <button class="vp-btn-save"   onclick="app._vleSave('${tabId}')">✅ Appliquer</button>
          </div>`;

        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
        document.getElementById('overlay').onclick = () => app._vleClose();
        this._vleInitDnd(modal, cardMap);
    },

    /* ── Drag & Drop interne du layout editor ──────────────────────────── */
    _vleInitDnd(modal, cardMap) {
        let src = null;
        const canvas = modal.querySelector('#vle-canvas');

        const attachChip = (chip) => {
            chip.addEventListener('dragstart', e => {
                src = chip; chip.classList.add('vle-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            chip.addEventListener('dragend', () => {
                src = null; chip.classList.remove('vle-dragging');
                canvas.querySelectorAll('.vle-drop-on').forEach(r => r.classList.remove('vle-drop-on'));
                this._vleClean(canvas);
            });
            chip.querySelector('.vle-chip-rm').addEventListener('click', () => {
                const id    = chip.dataset.cardId;
                const label = chip.querySelector('.vle-chip-label').textContent;
                chip.remove();
                this._vleClean(canvas);
                this._vleToPool(modal, id, label, cardMap, canvas, attachChip, attachRow);
            });
        };

        const attachRow = (row) => {
            row.addEventListener('dragover', e => {
                if (!src) return;
                e.preventDefault();
                canvas.querySelectorAll('.vle-drop-on').forEach(r => r.classList.remove('vle-drop-on'));
                row.classList.add('vle-drop-on');
                // Insertion positionnelle dans la ligne
                const chips = [...row.querySelectorAll('.vle-chip')].filter(c => c !== src);
                const after = chips.find(c => e.clientX < c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2);
                row.querySelector('.vle-empty-hint')?.remove();
                row.classList.remove('vle-row-empty');
                if (after) row.insertBefore(src, after);
                else        row.appendChild(src);
            });
            row.addEventListener('dragleave', e => {
                if (!row.contains(e.relatedTarget)) row.classList.remove('vle-drop-on');
            });
            row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('vle-drop-on'); });
        };

        // Zone "nouvelle ligne"
        const newZone = modal.querySelector('#vle-new-row-zone');
        newZone.addEventListener('dragover', e => { if (src) { e.preventDefault(); newZone.classList.add('vle-drop-on'); } });
        newZone.addEventListener('dragleave', () => newZone.classList.remove('vle-drop-on'));
        newZone.addEventListener('drop', e => {
            e.preventDefault(); newZone.classList.remove('vle-drop-on');
            if (!src) return;
            const row = document.createElement('div'); row.className = 'vle-row';
            row.appendChild(src); canvas.insertBefore(row, newZone); attachRow(row);
            this._vleClean(canvas);
        });

        canvas.querySelectorAll('.vle-row').forEach(attachRow);
        canvas.querySelectorAll('.vle-chip').forEach(attachChip);
        modal._attachChip = attachChip; modal._attachRow = attachRow;

        // Pool — clique pour remettre
        modal.querySelectorAll('.vle-pool-chip').forEach(pc => this._vlePoolClick(pc, modal, cardMap, canvas, attachChip, attachRow));
    },

    _vleToPool(modal, id, label, cardMap, canvas, attachChip, attachRow) {
        const wrap = modal.querySelector('#vle-pool-wrap');
        const pool = modal.querySelector('#vle-pool');
        if (wrap) wrap.style.display = '';
        const pc = document.createElement('div');
        pc.className = 'vle-pool-chip'; pc.dataset.cardId = id; pc.textContent = label;
        this._vlePoolClick(pc, modal, cardMap, canvas, attachChip, attachRow);
        if (pool) pool.appendChild(pc);
    },

    _vlePoolClick(pc, modal, cardMap, canvas, attachChip, attachRow) {
        pc.addEventListener('click', () => {
            const id    = pc.dataset.cardId;
            const label = cardMap[id]?.label || id;
            const chip  = document.createElement('div');
            chip.className = 'vle-chip'; chip.draggable = true; chip.dataset.cardId = id;
            chip.innerHTML = `<span class="vle-handle">⠿</span><span class="vle-chip-label">${label}</span><span class="vle-chip-rm">✕</span>`;
            const row = document.createElement('div'); row.className = 'vle-row';
            row.appendChild(chip);
            const zone = canvas.querySelector('#vle-new-row-zone');
            canvas.insertBefore(row, zone);
            attachRow(row); attachChip(chip);
            pc.remove();
            const pool = modal.querySelector('#vle-pool');
            if (pool && !pool.children.length) { const w = modal.querySelector('#vle-pool-wrap'); if (w) w.style.display = 'none'; }
        });
    },

    _vleClean(canvas) {
        canvas.querySelectorAll('.vle-row').forEach(row => {
            if (!row.querySelector('.vle-chip')) {
                row.classList.add('vle-row-empty');
                if (!row.querySelector('.vle-empty-hint')) {
                    row.innerHTML = '<span class="vle-empty-hint">Ligne vide — sera supprimée</span>';
                }
            } else {
                row.classList.remove('vle-row-empty');
            }
        });
    },

    _vleClose() {
        const m = document.getElementById('vleModal');
        if (m) m.classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        document.getElementById('overlay').onclick = null;
    },

    _vleSave(tabId) {
        const canvas = document.getElementById('vle-canvas');
        if (!canvas) return;
        const newLayout = [];
        canvas.querySelectorAll('.vle-row').forEach(row => {
            const ids = [...row.querySelectorAll('.vle-chip')].map(c => c.dataset.cardId);
            if (ids.length) newLayout.push(ids);
        });
        if (!newLayout.length) { this.notify('⚠️ La mise en page ne peut pas être vide !', 'warning'); return; }
        const newHidden = {};
        const pool = document.getElementById('vle-pool');
        pool?.querySelectorAll('.vle-pool-chip').forEach(c => { newHidden[c.dataset.cardId] = true; });
        if (!this.data.cardLayout)  this.data.cardLayout  = {};
        if (!this.data.hiddenCards) this.data.hiddenCards = {};
        this.data.cardLayout[tabId]  = newLayout;
        this.data.hiddenCards[tabId] = newHidden;
        this.save();
        this.applyLayout(tabId);
        this._vleClose();
        const total = this._tabCardsConfig[tabId]?.length || 0;
        this.notify(`✅ Mise en page appliquée — ${newLayout.length} ligne${newLayout.length > 1 ? 's' : ''}, ${total - Object.keys(newHidden).length}/${total} visibles`, 'success');
    },

    _vleReset(tabId) {
        if (!this.data.cardLayout)  this.data.cardLayout  = {};
        if (!this.data.hiddenCards) this.data.hiddenCards = {};
        this.data.cardLayout[tabId]  = JSON.parse(JSON.stringify(this._defaultLayout[tabId] || []));
        this.data.hiddenCards[tabId] = {};
        this.save();
        this.applyLayout(tabId);
        this._vleClose();
        this.notify('Mise en page réinitialisée', 'success');
    },

    /* ── applyLayout — applique cardLayout au DOM ───────────────────────── */
    applyLayout(tabId) {
        const tab = document.getElementById('tab-' + tabId);
        if (!tab) return;
        const layout = this.data.cardLayout?.[tabId] || this._defaultLayout[tabId] || [];
        const hidden = this.data.hiddenCards?.[tabId] || {};

        // 1. Collecter les cartes DIRECTES de cet onglet (top-level ou dans un vault-layout-row)
        //    On cherche uniquement les enfants directs du tab, ou enfants directs d'un vault-layout-row enfant du tab
        const cardEls = {};
        const collectCards = (parent) => {
            [...parent.children].forEach(el => {
                if (el.dataset && el.dataset.cardId) {
                    cardEls[el.dataset.cardId] = el;
                } else if (el.classList && el.classList.contains('vault-layout-row')) {
                    collectCards(el); // descend dans les rows existantes
                }
            });
        };
        collectCards(tab);

        // 2. Sortir toutes les cartes de leurs vault-layout-row et les stocker hors DOM
        const fragment = document.createDocumentFragment();
        Object.values(cardEls).forEach(el => fragment.appendChild(el));
        tab.querySelectorAll('.vault-layout-row').forEach(row => row.remove());

        // 3. Appliquer les classes hidden/visible
        const config = this._tabCardsConfig[tabId] || [];
        config.forEach(card => {
            const el = cardEls[card.id];
            if (!el) return;
            if (hidden[card.id]) el.classList.add('tab-card-hidden');
            else                  el.classList.remove('tab-card-hidden');
        });

        // 4. Réinsérer dans l'ordre du layout
        //    On place APRÈS le tab-customize-bar s'il existe, sinon à la fin
        const anchor = tab.querySelector('.tab-customize-bar');
        layout.forEach(rowIds => {
            const vis = rowIds.filter(id => !hidden[id] && cardEls[id]);
            if (!vis.length) {
                // Ligne entièrement cachée : on insère quand même les cartes (cachées)
                rowIds.filter(id => cardEls[id]).forEach(id => {
                    anchor ? anchor.after(cardEls[id]) : tab.appendChild(cardEls[id]);
                });
                return;
            }
            if (vis.length === 1 && rowIds.length === 1) {
                // Carte seule sur sa ligne
                anchor ? tab.insertBefore(cardEls[vis[0]], null) : tab.appendChild(cardEls[vis[0]]);
                tab.appendChild(cardEls[vis[0]]);
            } else {
                // Plusieurs cartes côte à côte
                const row = document.createElement('div');
                row.className = 'vault-layout-row';
                // Ajouter TOUTES les cartes de la ligne (visibles + cachées) dans la row
                rowIds.filter(id => cardEls[id]).forEach(id => row.appendChild(cardEls[id]));
                tab.appendChild(row);
            }
        });

        // 5. Cartes absentes du layout (nouvelles cartes ajoutées plus tard) → fin du tab
        config.forEach(card => {
            if (cardEls[card.id] && !cardEls[card.id].parentElement) {
                tab.appendChild(cardEls[card.id]);
            }
        });

        // 6. Masquer les vault-layout-row entièrement cachés
        tab.querySelectorAll('.vault-layout-row').forEach(row => {
            const allHidden = [...row.querySelectorAll('[data-card-id]')].every(el => el.classList.contains('tab-card-hidden'));
            row.style.display = allHidden ? 'none' : '';
        });
    },

    applyAllLayouts() {
        Object.keys(this._tabCardsConfig).forEach(tabId => this.applyLayout(tabId));
    },

    /* ── Shims de compatibilité ─────────────────────────────────────────── */
    applyTabCards(tabId)  { this.applyLayout(tabId); },
    applyAllTabCards()    { this.applyAllLayouts(); },
    applyCardOrder(tabId) { /* géré par applyLayout */ },
    applyAllCardOrder()   { this.applyAllLayouts(); },
    closeTabCustomizer()  { this._vleClose(); },

    _chartSeriesConfig: {
        'chart-patrimoine':    [{label:'Patrimoine'}],
        'chart-depenses-budget':[{label:'Barres — couleur début'},{label:'Barres — couleur fin'}],
        'chart-pea':           [{label:'Valeur PEA'},{label:'Investi'}],
        'chart-benchmark':     [{label:'Mon PEA'},{label:'MSCI World'},{label:'S&P 500'}],
        'chart-prev-compare':  [{label:'Objectif (prévisionnel)'},{label:'PEA Réel'}],
        'chart-proj-realiste': [{label:'Projection réelle'},{label:'Objectif'},{label:'Optimiste'}],
        'chart-heatmap':       [{label:'Couleur de la heatmap'}],
    },

    _chartNames: {
        'chart-patrimoine':    'Évolution Patrimoine',
        'chart-depenses-budget':'Dépenses vs Budget',
        'chart-pea':           'Évolution PEA',
        'chart-benchmark':     'Benchmark vs Indices',
        'chart-prev-compare':  'Comparaison PEA',
        'chart-proj-realiste': 'Projection réaliste',
        'chart-pat-evol':      'Évolution par compte',
        'chart-heatmap':       '🌡 Heatmap annuelle',
    },

    getChartCustomColors(chartId) {
        const theme = this.data.parametres.theme || 'light';
        return this.data.chartColors?.[theme]?.[chartId] || null;
    },

    setChartCustomColors(chartId, colors) {
        const theme = this.data.parametres.theme || 'light';
        if (!this.data.chartColors) this.data.chartColors = {};
        if (!this.data.chartColors[theme]) this.data.chartColors[theme] = {};
        this.data.chartColors[theme][chartId] = colors;
        this.save();
    },

    _refreshSingleChart(chartId) {
        const map = {
            'chart-patrimoine':      () => this.chartPatrimoine(),
            'chart-repartition':     () => this.chartRepartition(),
            'chart-depenses-budget': () => this.chartDepensesBudget(),
            'chart-pea':             () => this.chartPEA(),
            'chart-pat-evol':        () => this.chartPatEv(),
            'chart-benchmark':       () => this.refreshBenchmark(),
            'chart-prev-compare':    () => { this.calculerPrevisionsPEA && this.calculerPrevisionsPEA(); },
            'chart-proj-realiste':   () => { this.calculerPrevisionsPEA && this.calculerPrevisionsPEA(); },
            'chart-heatmap':         () => this.applyHeatmapColor(),
        };
        const fn = map[chartId];
        if (fn) fn(); else this.refreshCharts();
    },

    _updateChartColorBtn(chartId) {
        const btn = document.getElementById('ccbtn-' + chartId);
        if (!btn) return;
        const custom = this.getChartCustomColors(chartId);
        btn.classList.toggle('has-custom', !!(custom && custom.length));
    },

    _currentPickerChartId: null,

    // Convertit n'importe quel format couleur (hex, rgb, rgba, css var) en hex 6 chiffres valide pour input[type=color]
    _toHexColor(color) {
        if (!color) return '#3f51b5';
        const c = color.trim();
        // Déjà un hex court ou long
        if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
        if (/^#[0-9a-fA-F]{3}$/.test(c)) {
            return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
        }
        // rgb() ou rgba() — on ignore le canal alpha
        const m = c.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) {
            return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
        }
        // CSS variable ou autre format non supporté → on lit la valeur calculée via un élément temporaire
        try {
            const tmp = document.createElement('div');
            tmp.style.display = 'none';
            tmp.style.color = c;
            document.body.appendChild(tmp);
            const computed = getComputedStyle(tmp).color;
            document.body.removeChild(tmp);
            const m2 = computed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (m2) return '#' + [m2[1],m2[2],m2[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
        } catch(e) {}
        return '#3f51b5'; // fallback indigo
    },

    openChartColorPicker(chartId) {
        this._currentPickerChartId = chartId;
        const seriesConfig = chartId === 'chart-pat-evol'
            ? (this.data.comptes || []).map(c => ({label: c}))
            : (this._chartSeriesConfig[chartId] || [{label:'Couleur'}]);
        const custom   = this.getChartCustomColors(chartId);
        const fallback = this._getChartFallbackColors(chartId, seriesConfig.length);
        // Toutes les couleurs de la palette converties en hex valide pour input[type=color]
        const rawPalette = this.getThemePalette().concat([
            '#f472b6','#fb923c','#34d399','#818cf8','#f87171',
            '#00ffff','#ffff00','#00ff88','#ff6600','#c084fc','#e879f9',
            '#38bdf8','#4ade80','#fbbf24','#f43f5e','#a78bfa','#2dd4bf'
        ]);
        const palette = rawPalette.map(c => this._toHexColor(c));

        let modal = document.getElementById('chartColorModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'chartColorModal';
            modal.className = 'modal';
            modal.style.cssText = 'z-index:2000;border-radius:20px;max-width:520px;';
            document.body.appendChild(modal);
        }

        const titleName = this._chartNames[chartId] || chartId;

        modal.innerHTML = `
            <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">
                <h2 class="modal-title" style="font-family:'Outfit',sans-serif">🎨 ${titleName}</h2>
                <button onclick="app.resetChartColors()" style="font-size:.72rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);background:none;border:none;cursor:pointer;padding:.3rem .6rem;border-radius:8px" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-tertiary)'">↩ Réinitialiser</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom:1.25rem;color:var(--text-secondary);font-size:.9rem">
                    Clique sur une pastille pour choisir parmi la palette ou utilise le sélecteur personnalisé.
                </p>
                ${seriesConfig.map((s, i) => {
                    const currentColor = this._toHexColor(custom?.[i] || fallback[i] || palette[i % palette.length]);
                    return `
                    <div style="margin-bottom:1.25rem;padding:1rem;background:var(--bg-primary);border-radius:14px;border:1px solid var(--border-color)">
                        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
                            <div id="cc-preview-${i}" style="width:28px;height:28px;border-radius:50%;background:${currentColor};border:2px solid var(--border-color);flex-shrink:0"></div>
                            <span style="font-weight:700;font-size:1rem">${s.label}</span>
                            <input type="color" id="cc-input-${i}" value="${currentColor}"
                                style="margin-left:auto;width:40px;height:32px;border:none;border-radius:8px;cursor:pointer;background:none;padding:2px"
                                oninput="document.getElementById('cc-preview-${i}').style.background=this.value;document.getElementById('cc-hex-${i}').textContent=this.value">
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem">
                            ${palette.map(color => `
                                <div onclick="
                                    document.getElementById('cc-input-${i}').value='${color}';
                                    document.getElementById('cc-preview-${i}').style.background='${color}';
                                    document.getElementById('cc-hex-${i}').textContent='${color}'
                                " style="width:24px;height:24px;border-radius:6px;background:${color};cursor:pointer;border:2px solid transparent;transition:transform .15s;flex-shrink:0"
                                   onmouseover="this.style.transform='scale(1.2)';this.style.border='2px solid white'"
                                   onmouseout="this.style.transform='scale(1)';this.style.border='2px solid transparent'"
                                   title="${color}"></div>
                            `).join('')}
                        </div>
                        <div style="font-size:.75rem;color:var(--text-tertiary)" id="cc-hex-${i}">${currentColor}</div>
                    </div>`;
                }).join('')}
            </div>
            <div class="modal-footer">
                <button class="vp-btn-cancel" onclick="app.closeChartColorPicker()">Annuler</button>
                <button class="vp-btn-save" onclick="app.saveChartColorPicker()">✅ Appliquer</button>
            </div>
        `;

        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
        document.getElementById('overlay').onclick = () => app.closeChartColorPicker();
    },

    closeChartColorPicker() {
        const modal = document.getElementById('chartColorModal');
        if (modal) modal.classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        document.getElementById('overlay').onclick = null;
    },

    saveChartColorPicker() {
        const chartId = this._currentPickerChartId;
        if (!chartId) return;
        const seriesConfig = chartId === 'chart-pat-evol'
            ? (this.data.comptes || [])
            : (this._chartSeriesConfig[chartId] || [{}]);
        const colors = seriesConfig.map((_, i) => {
            const el = document.getElementById('cc-input-' + i);
            return el ? el.value : '#3f51b5';
        });
        this.setChartCustomColors(chartId, colors);
        this._updateChartColorBtn(chartId);
        this.closeChartColorPicker();
        this._refreshSingleChart(chartId);
        this.notify('Couleurs enregistrées ✓', 'success');
    },

    resetChartColors() {
        const chartId = this._currentPickerChartId;
        if (!chartId) return;
        const theme = this.data.parametres.theme || 'light';
        if (this.data.chartColors?.[theme]?.[chartId]) {
            delete this.data.chartColors[theme][chartId];
            this.save();
        }
        this._updateChartColorBtn(chartId);
        this.closeChartColorPicker();
        this._refreshSingleChart(chartId);
        this.notify('Couleurs réinitialisées', 'info');
    },

    _getChartFallbackColors(chartId, n) {
        const c = this.getChartColors();
        const map = {
            'chart-patrimoine':    [c.primary],
            'chart-depenses-budget':[c.primary, c.secondary],
            'chart-pea':           [c.primary, c.secondary],
            'chart-benchmark':     [c.primary, c.secondary, c.tertiary],
            'chart-prev-compare':  [c.primary, c.success],
            'chart-proj-realiste': [c.warning, c.primary, c.success],
            'chart-heatmap':       ['#3f51b5'],
        };
        if (map[chartId]) return map[chartId];

        return this.getThemePalette().slice(0, n);
    },

    _refreshAllChartColorBtns() {
        const ids = ['chart-patrimoine','chart-depenses-budget','chart-pea','chart-benchmark',
                     'chart-pat-evol','chart-prev-compare','chart-proj-realiste','chart-heatmap'];
        ids.forEach(id => this._updateChartColorBtn(id));
    },

    _toRgba(color, alpha) {
        const c = color.trim();
        if (c.startsWith('rgb')) {
            const nums = c.match(/[\d.]+/g);
            return `rgba(${nums[0]},${nums[1]},${nums[2]},${alpha})`;
        }
        const hex = c.replace('#','');
        if (hex.length === 3) {
            const r = parseInt(hex[0]+hex[0],16), g = parseInt(hex[1]+hex[1],16), b = parseInt(hex[2]+hex[2],16);
            return `rgba(${r},${g},${b},${alpha})`;
        }
        if (hex.length === 6) {
            const r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
            return `rgba(${r},${g},${b},${alpha})`;
        }
        return c;
    },

    getChartColors() {
        const style   = getComputedStyle(document.body);
        const get     = (v) => style.getPropertyValue(v).trim();
        const p1      = get('--accent-gradient-start') || get('--accent-primary') || '#3f51b5';
        const p2      = get('--accent-gradient-end')   || get('--accent-secondary') || '#7c4dff';
        const p3      = get('--accent-secondary')      || p1;
        const success = get('--success') || '#00c853';
        const warning = get('--warning') || '#ff9800';
        const dark    = this.isDarkMode();
        const self    = this;
        return {
            primary:     p1,
            secondary:   p2,
            tertiary:    p3,
            quaternary:  success,
            success,
            warning,
            info:        p2,
            gridColor:   dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            tickColor:   get('--text-tertiary')  || '#7891ab',
            legendColor: get('--text-primary')   || '#1e3a5f',
            bg1: (ctx) => {
                const g = ctx.chart.ctx.createLinearGradient(0,0,0,300);
                g.addColorStop(0, self._toRgba(p1, dark ? 0.35 : 0.28));
                g.addColorStop(1, self._toRgba(p1, 0));
                return g;
            },
            bg2: self._toRgba(p2, dark ? 0.18 : 0.12),
            bg3: (ctx) => {
                const g = ctx.chart.ctx.createLinearGradient(0,0,0,300);
                g.addColorStop(0, self._toRgba(p3, dark ? 0.30 : 0.22));
                g.addColorStop(1, self._toRgba(p3, 0));
                return g;
            },
            bgSuccess: (ctx) => {
                const g = ctx.chart.ctx.createLinearGradient(0,0,0,300);
                g.addColorStop(0, self._toRgba(success, 0.30));
                g.addColorStop(1, self._toRgba(success, 0));
                return g;
            },
            bgWarning: (ctx) => {
                const g = ctx.chart.ctx.createLinearGradient(0,0,0,300);
                g.addColorStop(0, self._toRgba(warning, 0.30));
                g.addColorStop(1, self._toRgba(warning, 0));
                return g;
            }
        };
    },

    getThemePalette() {
        const style = getComputedStyle(document.body);
        const get   = (v) => style.getPropertyValue(v).trim();
        const p1 = get('--accent-gradient-start') || '#3f51b5';
        const p2 = get('--accent-gradient-end')   || '#7c4dff';
        const p3 = get('--accent-secondary')      || '#5c6bc0';
        const suc  = get('--success')  || '#00c853';
        const warn = get('--warning')  || '#ff9800';
        const dang = get('--danger')   || '#f44336';
        return [p1, suc, warn, p2, dang, p3,
                this._toRgba(p1,0.85), this._toRgba(suc,0.85),
                this._toRgba(warn,0.85), this._toRgba(p2,0.85)];
    },

    getChartScaleOptions() {
        const c = this.getChartColors();
        return {
            x: { ticks: { color: c.tickColor }, grid: { color: c.gridColor } },
            y: { ticks: { color: c.tickColor }, grid: { color: c.gridColor } }
        };
    },

    getChartLegendOptions() {
        const c = this.getChartColors();
        return { position: 'top', labels: { color: c.legendColor, font: { family: 'Inter' } } };
    },
    refreshCharts() {
        this.chartPatrimoine();
        this.chartRepartition();
        this.chartDepensesBudget();
        this.chartPEA();
        this.chartPatEv();
    },

    chartPatrimoine() {
        const data = [...this.data.patrimoine].sort((a, b) => (a.date||a.mois).localeCompare(b.date||b.mois));
        const labels = data.map(p => new Date(p.date||p.mois).toLocaleDateString('fr-FR', {day:'numeric', month:'short', year:'2-digit'}));
        const values = data.map(p => p.total);
        const c = this.getChartColors();
        const _cc0 = this.getChartCustomColors('chart-patrimoine');
        const _p0 = _cc0?.[0] || c.primary;
        const _self0 = this;
        if (this.charts.pat) this.charts.pat.destroy();
        const ctx = document.getElementById('chart-patrimoine').getContext('2d');
        this.charts.pat = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Patrimoine',
                    data: values,
                    borderColor: _p0,
                    backgroundColor: (ctx2) => { const g=ctx2.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0,_self0._toRgba(_p0,0.30)); g.addColorStop(1,_self0._toRgba(_p0,0)); return g; },
                    fill: true, tension: 0.4, borderWidth: 3
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: this.getChartScaleOptions()
            }
        });
    },

    chartRepartition() {
        if (this.data.patrimoine.length === 0) return;
        const dernier = [...this.data.patrimoine].sort((a, b) => { const mc = b.mois.localeCompare(a.mois); return mc !== 0 ? mc : (b.date||b.mois).localeCompare(a.date||a.mois); })[0];
        const labels = [];
        const values = [];
        this.data.comptes.forEach(compte => {
            const val = dernier[compte] || 0;
            if (val > 0) { labels.push(compte); values.push(val); }
        });

        const defaultDarkColors = this.getThemePalette().concat(['#f472b6','#fb923c','#818cf8','#f87171']);
        const defaultLightColors = this.getThemePalette();
        const bgColors = labels.map((label, i) => {
            if (this.data.categorieColors && this.data.categorieColors[label]) {
                return this.data.categorieColors[label];
            }
            return this.isDarkMode() ? defaultDarkColors[i % defaultDarkColors.length] : defaultLightColors[i % defaultLightColors.length];
        });
        if (this.charts.rep) this.charts.rep.destroy();
        const ctx = document.getElementById('chart-repartition').getContext('2d');
        this.charts.rep = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: {
                    legend: this.getChartLegendOptions(),
                    tooltip: { callbacks: { label: function(ctx) {
                        const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
                        return ctx.label + ': ' + ((ctx.parsed/total)*100).toFixed(1) + '%';
                    }}}
                }
            }
        });
    },

    ouvrirCouleursCategoriesDonut() {
        if (!this.data.categorieColors) this.data.categorieColors = {};
        const dark = this.isDarkMode();

        const palette = this.getThemePalette().concat([
            '#f472b6','#fb923c','#34d399','#818cf8','#f87171',
            '#00ffff','#ffff00','#00ff88','#ff6600','#c084fc'
        ]);

        let colorModal = document.getElementById('colorModal');
        if (!colorModal) {
            colorModal = document.createElement('div');
            colorModal.id = 'colorModal';
            colorModal.className = 'modal';
            colorModal.style.cssText = 'z-index:2000;border-radius:20px;max-width:520px;';
            document.body.appendChild(colorModal);
        }

        colorModal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title" style="font-family:'Outfit',sans-serif">🎨 Couleurs des catégories</h2>
            </div>
            <div class="modal-body">
                <p style="margin-bottom:1.25rem;color:var(--text-secondary);font-size:0.9rem">
                    Clique sur une pastille pour choisir parmi la palette ou utilise le sélecteur personnalisé.
                </p>
                ${this.data.comptes.map((compte, i) => {
                    const currentColor = (this.data.categorieColors[compte]) || palette[i % palette.length];
                    return `
                    <div style="margin-bottom:1.25rem;padding:1rem;background:var(--bg-primary);border-radius:14px;border:1px solid var(--border-color)">
                        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
                            <div id="preview-${i}" style="width:28px;height:28px;border-radius:50%;background:${currentColor};border:2px solid var(--border-color);flex-shrink:0"></div>
                            <span style="font-weight:700;font-size:1rem">${compte}</span>
                            <input type="color" id="color-compte-${i}" value="${currentColor}"
                                style="margin-left:auto;width:40px;height:32px;border:none;border-radius:8px;cursor:pointer;background:none;padding:2px"
                                oninput="document.getElementById('preview-${i}').style.background=this.value;document.getElementById('hex-${i}').textContent=this.value">
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem">
                            ${palette.map(color => `
                                <div onclick="
                                    document.getElementById('color-compte-${i}').value='${color}';
                                    document.getElementById('preview-${i}').style.background='${color}';
                                    document.getElementById('hex-${i}').textContent='${color}'
                                " style="width:24px;height:24px;border-radius:6px;background:${color};cursor:pointer;border:2px solid transparent;transition:transform 0.15s;flex-shrink:0"
                                   onmouseover="this.style.transform='scale(1.2)';this.style.border='2px solid white'"
                                   onmouseout="this.style.transform='scale(1)';this.style.border='2px solid transparent'"
                                   title="${color}"></div>
                            `).join('')}
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-tertiary)" id="hex-${i}">${currentColor}</div>
                    </div>`;
                }).join('')}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="
                    document.getElementById('colorModal').classList.remove('active');
                    document.getElementById('overlay').classList.remove('active');
                ">Annuler</button>
                <button class="vp-btn-save" onclick="app.sauvegarderCouleursCategoriesDonut()">✅ Appliquer</button>
            </div>
        `;

        colorModal.classList.add('active');
        document.getElementById('overlay').classList.add('active');

        document.getElementById('overlay').onclick = () => {
            colorModal.classList.remove('active');
            document.getElementById('overlay').classList.remove('active');
            document.getElementById('overlay').onclick = null;
        };
    },

    sauvegarderCouleursCategoriesDonut() {
        if (!this.data.categorieColors) this.data.categorieColors = {};
        this.data.comptes.forEach((compte, i) => {
            const input = document.getElementById('color-compte-' + i);
            if (input) this.data.categorieColors[compte] = input.value;
        });
        this.save();

        const colorModal = document.getElementById('colorModal');
        if (colorModal) colorModal.classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        document.getElementById('overlay').onclick = null;
        this.chartRepartition();
        this.notify('Couleurs mises à jour !', 'success');
    },

    chartDepensesBudget() {
        const now = new Date();
        const depenses = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];

        const categories = Object.keys(this.data.budgets).filter(cat =>
            this.data.budgets[cat] > 0 &&
            !exclus.some(e => cat.toUpperCase().includes(e.toUpperCase()))
        );
        const reel = categories.map(cat => depenses.filter(d => d.categorie === cat).reduce((sum, d) => sum + d.montant, 0));
        const budget = categories.map(cat => this.data.budgets[cat]);
        if (this.charts.depBudget) this.charts.depBudget.destroy();
        const c = this.getChartColors();
        const _ccD = this.getChartCustomColors('chart-depenses-budget');
        const _dGS = _ccD?.[0] || c.primary;
        const _dGE = _ccD?.[1] || c.secondary;
        const ctx = document.getElementById('chart-depenses-budget').getContext('2d');
        this.charts.depBudget = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [
                    {
                        label: 'Dépensé',
                        data: reel,
                        backgroundColor: (context) => {
                            const g = context.chart.ctx.createLinearGradient(0,0,0,400);
                            g.addColorStop(0, _dGS);
                            g.addColorStop(1, _dGE);
                            return g;
                        },
                        borderRadius: 20, borderSkipped: false
                    },
                    {
                        label: 'Budget',
                        data: budget,
                        backgroundColor: c.gridColor,
                        borderRadius: 20, borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: this.getChartLegendOptions() },
                scales: this.getChartScaleOptions()
            }
        });
    },

    chartPEA() {
        let data = [...this.data.suiviPEA].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Filtre période
        const period = this._peaChartPeriod || 'all';
        if (period !== 'all' && data.length > 0) {
            const now = new Date();
            const cutoff = new Date(now);
            if (period === '6m') cutoff.setMonth(now.getMonth() - 6);
            else if (period === '1a') cutoff.setFullYear(now.getFullYear() - 1);
            data = data.filter(s => new Date(s.date) >= cutoff);
        }

        const labels  = data.map(s => new Date(s.date).toLocaleDateString('fr-FR', {month:'short', year:'2-digit'}));
        const valeurs = data.map(s => s.valeur);
        const investis = data.map(s => s.investi);

        // ── Mise à jour bande stats A2 ──
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const setClass = (id, cls) => { const el = document.getElementById(id); if (el) el.className = 'pea-a2-value ' + cls; };
        const setPillClass = (id, cls) => { const el = document.getElementById(id); if (el) el.className = 'pea-a2-pill ' + cls; };

        if (data.length > 0) {
            const dernier = data[data.length - 1];
            const premier = data[0];
            const gain = dernier.valeur - dernier.investi;
            const pct  = dernier.investi > 0 ? ((gain / dernier.investi) * 100).toFixed(1) : 0;
            const isPos = gain >= 0;
            const dateLabel = new Date(dernier.date).toLocaleDateString('fr-FR', {month:'long', year:'numeric'});

            // Perf annualisée
            const mois = data.length;
            const perfAnn = dernier.investi > 0 && mois > 0
                ? (((dernier.valeur / premier.investi) ** (12 / mois) - 1) * 100).toFixed(1)
                : '—';

            setEl('pea-strip-valeur', this.formatCurrency(dernier.valeur));
            setEl('pea-strip-date',   dateLabel);
            setEl('pea-strip-investi', this.formatCurrency(dernier.investi));
            setEl('pea-strip-gain',   (isPos ? '+' : '') + this.formatCurrency(gain));
            setEl('pea-strip-pct',    (isPos ? '▲ +' : '▼ ') + Math.abs(pct) + ' %');
            setEl('pea-strip-perf',   (perfAnn !== '—' ? (parseFloat(perfAnn) >= 0 ? '+' : '') + perfAnn + ' %' : '—'));
            setEl('pea-strip-recul',  mois > 1 ? 'Sur ' + mois + ' mois' : '—');

            setClass('pea-strip-gain', isPos ? 'pos' : 'neg');
            setClass('pea-strip-perf', parseFloat(perfAnn) >= 0 ? 'pos' : 'neg');
            setPillClass('pea-strip-pct', isPos ? 'pos' : 'neg');
        } else {
            ['pea-strip-valeur','pea-strip-date','pea-strip-investi','pea-strip-gain','pea-strip-pct','pea-strip-perf','pea-strip-recul']
                .forEach(id => setEl(id, '—'));
        }

        // ── Couleurs personnalisables ──
        const c    = this.getChartColors();
        const _cc  = this.getChartCustomColors('chart-pea');
        const col  = _cc?.[0] || c.primary;   // couleur courbe valeur
        const _self = this;

        if (this.charts.pea) this.charts.pea.destroy();
        const ctx = document.getElementById('chart-pea').getContext('2d');
        const minY = valeurs.length && investis.length
            ? Math.min(...investis) * 0.965
            : 0;

        this.charts.pea = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    // Zone verte : fill entre courbe valeur et ligne investi quand valeur > investi
                    {
                        label: '_zone_gain',
                        data: valeurs.map((v, i) => Math.max(v, investis[i] ?? v)),
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(0,200,83,.13)',
                        fill: '+1',
                        tension: 0.42, pointRadius: 0, borderWidth: 0,
                    },
                    // Ligne investi haute (référence fill vert)
                    {
                        label: '_inv_ref_high',
                        data: investis,
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        fill: false, tension: 0.42, pointRadius: 0, borderWidth: 0,
                    },
                    // Zone rouge : fill entre investi et courbe valeur quand valeur < investi
                    {
                        label: '_zone_perte',
                        data: valeurs.map((v, i) => Math.min(v, investis[i] ?? v)),
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(244,67,54,.1)',
                        fill: '+1',
                        tension: 0.42, pointRadius: 0, borderWidth: 0,
                    },
                    // Ligne investi basse (référence fill rouge)
                    {
                        label: '_inv_ref_low',
                        data: investis,
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        fill: false, tension: 0.42, pointRadius: 0, borderWidth: 0,
                    },
                    // Courbe valeur principale
                    {
                        label: 'Valeur PEA',
                        data: valeurs,
                        borderColor: col,
                        backgroundColor: (ctx2) => {
                            const { chart } = ctx2;
                            const { ctx: cx, chartArea: ca } = chart;
                            if (!ca) return _self._toRgba(col, 0.1);
                            const g = cx.createLinearGradient(0, ca.top, 0, ca.bottom);
                            g.addColorStop(0, _self._toRgba(col, 0.22));
                            g.addColorStop(1, _self._toRgba(col, 0));
                            return g;
                        },
                        borderWidth: 2.8,
                        fill: 'origin',
                        tension: 0.42,
                        pointRadius: valeurs.map((_, i) => i === valeurs.length - 1 ? 5 : 0),
                        pointBackgroundColor: col,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 1.5,
                        pointHoverRadius: 7,
                    },
                    // Courbe investi (pointillé)
                    {
                        label: 'Investi',
                        data: investis,
                        borderColor: 'rgba(120,145,171,.7)',
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderDash: [5, 4],
                        fill: false,
                        tension: 0.42,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(30,58,95,.95)',
                        titleFont: { family: 'DM Mono', size: 11 },
                        bodyFont: { family: 'Outfit', size: 13, weight: 'bold' },
                        footerFont: { family: 'DM Mono', size: 10 },
                        padding: 14,
                        borderColor: 'rgba(255,255,255,.15)',
                        borderWidth: 1,
                        filter: item => !item.dataset.label?.startsWith('_'),
                        callbacks: {
                            label: ctx2 => {
                                const lbl = ctx2.dataset.label;
                                if (!lbl || lbl.startsWith('_')) return null;
                                return '  ' + lbl + ' : ' + ctx2.parsed.y.toLocaleString('fr-FR') + ' €';
                            },
                            footer: items => {
                                const vItem = items.find(i => i.dataset.label === 'Valeur PEA');
                                const iItem = items.find(i => i.dataset.label === 'Investi');
                                if (!vItem || !iItem) return;
                                const pv  = vItem.parsed.y - iItem.parsed.y;
                                const pct = iItem.parsed.y > 0 ? ((pv / iItem.parsed.y) * 100).toFixed(1) : 0;
                                const s   = pv >= 0 ? '+' : '';
                                return '  Plus-value : ' + s + pv.toLocaleString('fr-FR') + ' € (' + s + pct + ' %)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#7891ab', font: { family: 'DM Mono', size: 10 } }
                    },
                    y: {
                        min: minY,
                        grid: { color: 'rgba(212,226,237,.45)' },
                        ticks: {
                            color: '#7891ab',
                            font: { family: 'DM Mono', size: 10 },
                            callback: v => (v / 1000).toFixed(0) + 'k €'
                        }
                    }
                }
            }
        });
    },

    chartPatEv() {
        const ctxEl = document.getElementById('chart-pat-evol');
        if (!ctxEl) return;
        const sorted = [...this.data.patrimoine].sort((a, b) => (a.date||a.mois).localeCompare(b.date||b.mois));
        if (!sorted.length) return;
        const labels  = sorted.map(p => new Date(p.date||p.mois).toLocaleDateString('fr-FR', {day:'numeric', month:'short', year:'2-digit'}));
        const liquides = this.data.comptesLiquides || [];
        const totals   = sorted.map(p => p.total || 0);
        const liquid   = sorted.map(p => this.data.comptes.filter(c => liquides.includes(c)).reduce((s,c) => s+(p[c]||0), 0));
        const invest   = sorted.map(p => this.data.comptes.filter(c => !liquides.includes(c)).reduce((s,c) => s+(p[c]||0), 0));
        const _ccEv = this.getChartCustomColors('chart-pat-evol');
        const colTotal = (_ccEv?.[0]) || '#3f51b5';
        const colLiq   = (_ccEv?.[1]) || '#43a047';
        const colInv   = (_ccEv?.[2]) || '#7c4dff';
        if (this.charts.patEv) this.charts.patEv.destroy();
        const ctx = ctxEl.getContext('2d');
        const gradTotal = ctx.createLinearGradient(0,0,0,200);
        gradTotal.addColorStop(0, colTotal+'38'); gradTotal.addColorStop(1, colTotal+'00');
        const gradInv = ctx.createLinearGradient(0,0,0,200);
        gradInv.addColorStop(0, colInv+'28'); gradInv.addColorStop(1, colInv+'00');
        this.charts.patEv = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Total',           data: totals, borderColor: colTotal, backgroundColor: gradTotal, fill: true,  tension: 0.45, borderWidth: 2.5, pointRadius: 3,   pointBackgroundColor: colTotal, pointBorderColor: '#fff', pointBorderWidth: 1.5 },
                    { label: 'Liquidités',       data: liquid, borderColor: colLiq,   backgroundColor: 'transparent',         fill: false, tension: 0.45, borderWidth: 1.8, borderDash: [4,3], pointRadius: 2.5, pointBackgroundColor: colLiq, pointBorderColor: '#fff', pointBorderWidth: 1 },
                    { label: 'Investissements',  data: invest, borderColor: colInv,   backgroundColor: gradInv,   fill: true,  tension: 0.45, borderWidth: 1.8, borderDash: [4,3], pointRadius: 2.5, pointBackgroundColor: colInv, pointBorderColor: '#fff', pointBorderWidth: 1 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(63,81,181,0.18)', borderWidth: 1,
                        titleColor: '#1a1f3a', bodyColor: '#5c6285',
                        titleFont: { family: 'DM Mono', size: 11 }, bodyFont: { family: 'DM Mono', size: 11 }, padding: 10,
                        callbacks: { label: c => ' ' + c.dataset.label + ' : ' + this.formatCurrency(c.parsed.y) }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(63,81,181,0.06)' }, ticks: { color: '#9fa8da', font: { family: 'DM Mono', size: 10 } }, border: { display: false } },
                    y: { grid: { color: 'rgba(63,81,181,0.06)' }, ticks: { color: '#9fa8da', font: { family: 'DM Mono', size: 10 }, callback: v => (v/1000).toFixed(0)+'k€' }, border: { display: false } }
                }
            }
        });
    },

    chartPrevPEA(historique, annees) {
        const labels = [];
        const valeurs = [];
        const investis = [];

        for (let i = 0; i <= annees * 12; i += 6) {
            const h = historique[i];
            labels.push('Mois ' + i);
            valeurs.push(h.valeur);
            investis.push(h.investi);
        }

        if (this.charts.prevPea) this.charts.prevPea.destroy();
        const c = this.getChartColors();
        const ctx = document.getElementById('chart-prev-pea').getContext('2d');
        this.charts.prevPea = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Valeur projetée',
                        data: valeurs,
                        borderColor: c.success,
                        backgroundColor: c.bgSuccess,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Total investi',
                        data: investis,
                        borderColor: c.warning,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } }
            }
        });
    },

    chartPrevPat(historique, annees) {
        const labels = [];
        const valeurs = [];

        for (let i = 0; i <= annees * 12; i += 6) {
            const h = historique[i];
            labels.push('Mois ' + i);
            valeurs.push(h.valeur);
        }

        if (this.charts.prevPat) this.charts.prevPat.destroy();
        const c = this.getChartColors();
        const ctx = document.getElementById('chart-prev-pat').getContext('2d');
        this.charts.prevPat = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Patrimoine projeté',
                    data: valeurs,
                    borderColor: c.primary,
                    backgroundColor: c.bg1,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    },

    chartCompare() {
        const patReel = [...this.data.patrimoine].sort((a, b) => (a.date||a.mois).localeCompare(b.date||b.mois));

        if (this.charts.compare) this.charts.compare.destroy();
        const c = this.getChartColors();
        const ctx = document.getElementById('chart-compare').getContext('2d');
        this.charts.compare = new Chart(ctx, {
            type: 'line',
            data: {
                labels: patReel.map(p => new Date(p.mois).toLocaleDateString('fr-FR', {month: 'short', year: '2-digit'})),
                datasets: [{
                    label: 'Patrimoine réel',
                    data: patReel.map(p => p.total),
                    borderColor: c.primary,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: {
                        display: true,
                        text: 'Comparaison avec les données réelles'
                    }
                }
            }
        });
    },

    refresh() {
        this.afficherDepenses();
        this.refreshStatsDepenses();
        this.refreshRevenus();
        this.afficherPEA();
        this.refreshStatsPEA();
        this.afficherPatrimoine();
        this.refreshStatsPatrimoine();
        this.analyseDepenses();
        this.refreshDashboard();
        this.refreshBilanAnnuel();
        this.refreshHeatmap();
        this.checkResumeHebdo();
        this.refreshPointage();
    },

    saveSettings() {
        const salaire = parseFloat(document.getElementById('set-salaire').value) || 0;
        this.data.parametres.salaire = salaire;
        const finnhubKey = (document.getElementById('set-finnhub-key')?.value || '').trim();
        if (finnhubKey) this.data.parametres.finnhubKey = finnhubKey;
        this.save();
        this._updateSalaireDisplay(salaire);
        this.refreshVueRapide();
        this.refreshAlertes();
        this.refreshRegle503020();
        this.toggleSettings();
        this.notify('Paramètres sauvegardés ✓', 'success');
    },

    _updateSalaireDisplay(salaire) {
        const el = document.getElementById('salaire-display');
        if (!el) return;
        if (salaire > 0) {
            el.style.display = 'block';
            el.style.background = 'rgba(0,200,83,.1)';
            el.style.color = 'var(--success)';
            el.textContent = '✓ Salaire enregistré : ' + this.formatCurrency(salaire) + ' / mois';
        } else {
            el.style.display = 'none';
        }
    },

    toggleShowMore(type) {
        this.showMoreState[type] = !this.showMoreState[type];
        if (type === 'depenses') this.afficherDepenses();
        if (type === 'pea') this.afficherPEA();
        if (type === 'patrimoine') this.afficherPatrimoine();
    },

    toggleBudgetsPanel() {
        this.updateBudgetsUI();
        document.getElementById('budgetsModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    toggleComptesPanel() {
        this.updateComptesUI();
        document.getElementById('comptesModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    modifierNote(type, id) {
        let item;
        if (type === 'depense') {
            item = this.data.depenses.find(d => String(d.id) === String(id));
        } else if (type === 'pea') {
            item = this.data.suiviPEA.find(p => String(p.id) === String(id));
        }

        if (!item) return;

        this.showInputModal(
            'Modifier la note',
            'Nouvelle note',
            null,
            (nouvelleNote) => {
                item.note = nouvelleNote;
                this.save();
                if (type === 'depense') {
                    this.afficherDepenses();
                    this._refreshBudgetRecentTxs();
                }
                if (type === 'pea') this.afficherPEA();
                this.notify('Note modifiée', 'success');
            }
        );

        setTimeout(() => {
            document.getElementById('inputField').value = item.note || '';
        }, 100);
    },

    vuePrevision: 'annee',

    chargerScenario() {
        const select = document.getElementById('select-scenario');
        const id = select.value;

        if (!id) {
            document.getElementById('prev-scenario-nom').value = '';
            document.getElementById('prev-pea-actuel').value = '';
            document.getElementById('prev-pea-mensuel').value = '';
            document.getElementById('prev-pea-taux').value = '';
            document.getElementById('prev-pea-annees').value = '';
            return;
        }

        const scenario = this.data.scenarios.find(s => s.id == id);
        if (!scenario) return;

        document.getElementById('prev-scenario-nom').value = scenario.nom;
        document.getElementById('prev-pea-actuel').value = scenario.actuel;
        document.getElementById('prev-pea-mensuel').value = scenario.mensuel;
        document.getElementById('prev-pea-taux').value = scenario.taux;
        document.getElementById('prev-pea-annees').value = scenario.annees;
    },

    sauvegarderScenario() {
        const nom = document.getElementById('prev-scenario-nom').value.trim();
        if (!nom) {
            this.notify('Nom du scénario requis', 'error');
            return;
        }

        const scenario = {
            id: crypto.randomUUID(),
            nom: nom,
            actuel: parseFloat(document.getElementById('prev-pea-actuel').value) || 0,
            mensuel: parseFloat(document.getElementById('prev-pea-mensuel').value) || 0,
            taux: parseFloat(document.getElementById('prev-pea-taux').value) || 0,
            annees: parseInt(document.getElementById('prev-pea-annees').value) || 10
        };

        const select = document.getElementById('select-scenario');
        const existingId = select.value;

        if (existingId) {
            const index = this.data.scenarios.findIndex(s => s.id == existingId);
            if (index !== -1) {
                scenario.id = parseInt(existingId);
                this.data.scenarios[index] = scenario;
            }
        } else {
            this.data.scenarios.push(scenario);
        }

        this.save();
        this.updateScenariosSelect();
        this.notify('Scénario sauvegardé', 'success');
    },

    supprimerScenario() {
        const select = document.getElementById('select-scenario');
        const id = select.value;

        if (!id) {
            this.notify('Aucun scénario sélectionné', 'error');
            return;
        }

        this.showModal(
            'Supprimer le scénario',
            'Voulez-vous vraiment supprimer ce scénario ?',
            () => {
                this.data.scenarios = this.data.scenarios.filter(s => s.id != id);
                this.save();
                this.updateScenariosSelect();
                this.chargerScenario();
                this.notify('Scénario supprimé', 'success');
            }
        );
    },

    updateScenariosSelect() {
        const select = document.getElementById('select-scenario');
        if (!select) return;
        select.innerHTML = '<option value="">-- Nouveau scénario --</option>' +
            this.data.scenarios.map(s => `<option value="${s.id}">${s.nom}</option>`).join('');
    },

    switchVuePrevision(vue) {
        this.vuePrevision = vue;
        document.getElementById('btn-vue-annee').className = vue === 'annee' ? 'btn btn-small' : 'btn btn-small btn-secondary';
        document.getElementById('btn-vue-mois').className = vue === 'mois' ? 'btn btn-small' : 'btn btn-small btn-secondary';
        this.calculerPrevisionsPEA();
    },

    calculerProjectionRealiste(historiquePrev, annees) {
        if (this.data.suiviPEA.length < 2) {
            document.getElementById('perf-moyenne').textContent = 'N/A';
            document.getElementById('proj-realiste').textContent = 'N/A';
            document.getElementById('ecart-objectif').textContent = 'N/A';
            return;
        }

        const sorted = [...this.data.suiviPEA].sort((a, b) => new Date(a.date) - new Date(b.date));
        let totalPerf = 0;
        let count = 0;

        for (let i = 1; i < sorted.length; i++) {
            const perf = ((sorted[i].valeur - sorted[i-1].valeur) / sorted[i-1].valeur) * 100;
            totalPerf += perf;
            count++;
        }

        const perfMoyenne = totalPerf / count;
        document.getElementById('perf-moyenne').textContent = perfMoyenne.toFixed(2) + '%';

        const actuel = parseFloat(document.getElementById('prev-pea-actuel').value) || 0;
        const mensuel = parseFloat(document.getElementById('prev-pea-mensuel').value) || 0;
        const tauxReel = (perfMoyenne / 100) / 12;
        const mois = annees * 12;

        let valeurReel = actuel;
        const historiqueReel = [{periode: 0, valeur: actuel}];

        for (let i = 1; i <= mois; i++) {
            valeurReel = (valeurReel + mensuel) * (1 + tauxReel);
            historiqueReel.push({periode: i, valeur: valeurReel});
        }

        document.getElementById('proj-realiste').textContent = this.formatCurrency(valeurReel);

        const objectif = historiquePrev[historiquePrev.length - 1].valeur;
        const ecart = valeurReel - objectif;
        const ecartElem = document.getElementById('ecart-objectif');
        ecartElem.textContent = (ecart >= 0 ? '+' : '') + this.formatCurrency(ecart);
        ecartElem.className = 'stat-value ' + (ecart >= 0 ? 'stat-change positive' : 'stat-change negative');

        this.chartProjRealiste(historiqueReel, historiquePrev, annees);
    },

    chartPrevCompare(historiquePrev, annees) {
        const peaReel = [...this.data.suiviPEA].sort((a, b) => new Date(a.date) - new Date(b.date));

        let labels, dataPrev, dataReel;

        if (this.vuePrevision === 'annee') {
            labels = [];
            dataPrev = [];
            dataReel = [];

            for (let i = 0; i <= annees; i++) {
                labels.push('Année ' + i);
                const idx = i * 12;
                dataPrev.push(historiquePrev[idx] ? historiquePrev[idx].valeur : null);

                if (peaReel.length > 0 && i === 0) {
                    dataReel.push(peaReel[peaReel.length - 1].valeur);
                } else {
                    dataReel.push(null);
                }
            }
        } else {
            labels = [];
            dataPrev = [];
            dataReel = [];

            const totalMois = annees * 12;
            for (let i = 0; i <= totalMois; i++) {
                labels.push('Mois ' + i);
                dataPrev.push(historiquePrev[i] ? historiquePrev[i].valeur : null);

                if (peaReel.length > 0 && i === 0) {
                    dataReel.push(peaReel[peaReel.length - 1].valeur);
                } else {
                    dataReel.push(null);
                }
            }
        }

        if (this.charts.prevCompare) this.charts.prevCompare.destroy();
        const c = this.getChartColors();
        const _ccPC = this.getChartCustomColors('chart-prev-compare');
        const _pc0 = _ccPC?.[0] || c.primary;
        const _pc1 = _ccPC?.[1] || c.success;
        const _selfPC = this;
        const ctx = document.getElementById('chart-prev-compare').getContext('2d');
        this.charts.prevCompare = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Objectif (Prévisionnel)',
                        data: dataPrev,
                        borderColor: _b0,
                        backgroundColor: (ctx2) => { const g=ctx2.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0,_selfB._toRgba(_b0,0.28)); g.addColorStop(1,_selfB._toRgba(_b0,0)); return g; },

                        tension: 0.4,
                        fill: true,
                        borderWidth: 3
                    },
                    {
                        label: 'PEA Réel',
                        data: dataReel,
                        borderColor: c.success,
                        backgroundColor: _selfPC._toRgba(c.success, 0.2),
                        tension: 0.4,
                        pointRadius: 6,
                        pointBackgroundColor: c.success,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: {
                        display: true,
                        text: 'Êtes-vous sur la bonne voie ?'
                    }
                }
            }
        });
    },

    chartProjRealiste(historiqueReel, historiquePrev, annees) {
        let labels, dataReel, dataPrev;

        if (this.vuePrevision === 'annee') {
            labels = [];
            dataReel = [];
            dataPrev = [];

            for (let i = 0; i <= annees; i++) {
                labels.push('Année ' + i);
                const idx = i * 12;
                dataReel.push(historiqueReel[idx] ? historiqueReel[idx].valeur : null);
                dataPrev.push(historiquePrev[idx] ? historiquePrev[idx].valeur : null);
            }
        } else {
            labels = [];
            dataReel = [];
            dataPrev = [];

            const totalMois = annees * 12;
            for (let i = 0; i <= totalMois; i++) {
                labels.push('Mois ' + i);
                dataReel.push(historiqueReel[i] ? historiqueReel[i].valeur : null);
                dataPrev.push(historiquePrev[i] ? historiquePrev[i].valeur : null);
            }
        }

        if (this.charts.projRealiste) this.charts.projRealiste.destroy();
        const c = this.getChartColors();
        const _ccPR = this.getChartCustomColors('chart-proj-realiste');
        const _pr0 = _ccPR?.[0] || c.warning;
        const _pr1 = _ccPR?.[1] || c.primary;
        const _pr2 = _ccPR?.[2] || c.success;
        const _selfPR = this;
        const ctx = document.getElementById('chart-proj-realiste').getContext('2d');
        this.charts.projRealiste = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Projection avec vos performances',
                        data: dataReel,
                        borderColor: '#ff9800',
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                            gradient.addColorStop(0, 'rgba(255, 152, 0, 0.3)');
                            gradient.addColorStop(1, 'rgba(255, 152, 0, 0)');
                            return gradient;
                        },
                        tension: 0.4,
                        fill: true,
                        borderWidth: 3
                    },
                    {
                        label: 'Objectif',
                        data: dataPrev,
                        borderColor: _pr1,
                        borderDash: [5, 5],
                        tension: 0.4,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: {
                        display: true,
                        text: 'Projection basée sur vos performances passées'
                    }
                }
            }
        });
    },

    chargerModele() {
        const select = document.getElementById('select-modele');
        const id = select.value;

        if (!id) {
            document.getElementById('calc-nom-modele').value = '';
            document.getElementById('calc-lignes').value = 3;
            this.genererLignes();
            return;
        }

        const modele = this.data.modeles.find(m => m.id == id);
        if (!modele) return;

        document.getElementById('calc-nom-modele').value = modele.nom;
        document.getElementById('calc-lignes').value = modele.lignes.length;

        this.genererLignes();

        setTimeout(() => {
            modele.lignes.forEach((ligne, i) => {
                document.getElementById('cn-' + i).value = ligne.nom;
                document.getElementById('ca-' + i).value = ligne.alloc;
                document.getElementById('cc-' + i).value = ligne.cours;
            });
            this.calculer();
        }, 100);
    },

    sauvegarderModele() {
        const nom = document.getElementById('calc-nom-modele').value.trim();
        if (!nom) {
            this.notify('Nom du modèle requis', 'error');
            return;
        }

        const n = parseInt(document.getElementById('calc-lignes').value) || 3;
        const lignes = [];

        for (let i = 0; i < n; i++) {
            lignes.push({
                nom: document.getElementById('cn-' + i).value || '',
                alloc: parseFloat(document.getElementById('ca-' + i).value) || 0,
                cours: parseFloat(document.getElementById('cc-' + i).value) || 0
            });
        }

        const modele = {
            id: crypto.randomUUID(),
            nom: nom,
            lignes: lignes
        };

        const select = document.getElementById('select-modele');
        const existingId = select.value;

        if (existingId) {
            const index = this.data.modeles.findIndex(m => m.id == existingId);
            if (index !== -1) {
                modele.id = parseInt(existingId);
                this.data.modeles[index] = modele;
            }
        } else {
            this.data.modeles.push(modele);
        }

        this.save();
        this.updateModelesSelect();
        this.notify('Modèle sauvegardé', 'success');
    },

    supprimerModele() {
        const select = document.getElementById('select-modele');
        const id = select.value;

        if (!id) {
            this.notify('Aucun modèle sélectionné', 'error');
            return;
        }

        this.showModal(
            'Supprimer le modèle',
            'Voulez-vous vraiment supprimer ce modèle ?',
            () => {
                this.data.modeles = this.data.modeles.filter(m => m.id != id);
                this.save();
                this.updateModelesSelect();
                this.chargerModele();
                this.notify('Modèle supprimé', 'success');
            }
        );
    },

    updateModelesSelect() {
        const select = document.getElementById('select-modele');
        if (!select) return;
        select.innerHTML = '<option value="">-- Nouveau modèle --</option>' +
            this.data.modeles.map(m => `<option value="${m.id}">${m.nom}</option>`).join('');
    },

    confirmReset() {
        this.showModal(
            'Réinitialiser toutes les données',
            'Êtes-vous sûr de vouloir réinitialiser TOUTES les données ? Cette action est irréversible.',
            () => {
                localStorage.clear();
                location.reload();
            }
        );
    },

    refreshScore() {
        const now = new Date();
        const depensesMois = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).reduce((sum, d) => sum + d.montant, 0);
        const budgetTotal = Object.values(this.data.budgets).reduce((s, v) => s + v, 0);
        const salaire = this.data.parametres.salaire || 0;
        const revenu = salaire > 0 ? salaire : (budgetTotal > 0 ? budgetTotal * 1.25 : 2000);
        const revenuLabel = salaire > 0 ? 'salaire réel' : 'estimation';
        const peaActuel = this.data.suiviPEA.length > 0 ?
            [...this.data.suiviPEA].sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;

        let score = 0;
        const items = [];

        const tauxEpargne = revenu > 0 ? ((revenu - depensesMois) / revenu) * 100 : 0;
        const scoreEpargne = Math.min(25, Math.max(0, tauxEpargne * 1.25));
        score += scoreEpargne;
        items.push({ label: `Taux d'épargne (${revenuLabel})`, val: tauxEpargne.toFixed(0) + '%', cls: tauxEpargne >= 20 ? 'positive' : tauxEpargne >= 10 ? 'warning' : 'negative' });

        const budgetPct = budgetTotal > 0 ? (depensesMois / budgetTotal) * 100 : 100;
        const scoreBudget = Math.min(25, Math.max(0, (100 - budgetPct) * 0.5));
        score += scoreBudget;
        items.push({ label: 'Budget respecté', val: budgetPct.toFixed(0) + '%', cls: budgetPct <= 80 ? 'positive' : budgetPct <= 100 ? 'warning' : 'negative' });

        if (peaActuel) {
            const scorePEA = Math.min(25, Math.max(0, peaActuel.valeur / 1000));
            score += scorePEA;
            items.push({ label: 'Investissement PEA', val: peaActuel.performance + '%', cls: parseFloat(peaActuel.performance) >= 0 ? 'positive' : 'negative' });
        } else {
            items.push({ label: 'Investissement PEA', val: 'Inactif', cls: 'negative' });
        }

        if (this.data.objectifs.length > 0) {
            const avgProg = this.data.objectifs.reduce((s, o) => s + Math.min(100, (o.actuel / o.cible) * 100), 0) / this.data.objectifs.length;
            score += Math.min(25, avgProg * 0.25);
            items.push({ label: 'Objectifs', val: avgProg.toFixed(0) + '%', cls: avgProg >= 50 ? 'positive' : 'warning' });
        } else {
            items.push({ label: 'Objectifs définis', val: 'Aucun', cls: 'negative' });
        }

        const finalScore = Math.round(Math.min(100, score));
        document.getElementById('score-num').textContent = finalScore;
        const arc = document.getElementById('score-arc');
        const circumference = 289;
        arc.style.strokeDashoffset = circumference - (circumference * finalScore / 100);
        arc.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)';

        document.getElementById('score-details').innerHTML = items.map(item => `
            <div style="display:flex;justify-content:space-between;padding:0.3rem 0;border-bottom:1px solid var(--border-color);font-size:0.8rem;">
                <span style="color:var(--text-secondary)">${item.label}</span>
                <span class="stat-change ${item.cls}" style="font-size:0.78rem">${item.val}</span>
            </div>
        `).join('');
    },

    refreshVueRapide() {
        const now = new Date();
        const patrimoineActuel = this.data.patrimoine.length > 0 ?
            [...this.data.patrimoine].sort((a, b) => { const mc = b.mois.localeCompare(a.mois); return mc !== 0 ? mc : (b.date||b.mois).localeCompare(a.date||a.mois); })[0] : null;
        const depensesMois = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).reduce((sum, d) => sum + d.montant, 0);
        const budgetTotal = Object.values(this.data.budgets).reduce((s, v) => s + v, 0);
        const budgetRestant = budgetTotal - depensesMois;
        const peaActuel = this.data.suiviPEA.length > 0 ?
            [...this.data.suiviPEA].sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;
        const objEnRetard = this.data.objectifs.filter(o => {
            if (!o.dateTarget) return false;
            const moisRestants = (new Date(o.dateTarget) - now) / (1000 * 60 * 60 * 24 * 30);
            const mensuelNecessaire = moisRestants > 0 ? (o.cible - o.actuel) / moisRestants : Infinity;
            return mensuelNecessaire > 1000;
        }).length;

        const grid = document.getElementById('vue-rapide-grid');
        if (!grid) return;
        grid.innerHTML = [
            { icon: '💰', label: 'Patrimoine', val: patrimoineActuel ? this.formatCurrency(patrimoineActuel.total) : '—', sub: '', cls: 'positive' },
            { icon: '📉', label: 'Dépenses mois', val: this.formatCurrency(depensesMois), sub: budgetTotal > 0 ? (depensesMois/budgetTotal*100).toFixed(0)+'% du budget' : '', cls: depensesMois > budgetTotal ? 'negative' : 'positive' },
            { icon: '📈', label: 'PEA', val: peaActuel ? this.formatCurrency(peaActuel.valeur) : '—', sub: peaActuel ? (parseFloat(peaActuel.performance) >= 0 ? '+' : '') + peaActuel.performance + '%' : '', cls: peaActuel && peaActuel.gainPerte >= 0 ? 'positive' : 'negative' },
            { icon: '🎯', label: 'Objectifs', val: this.data.objectifs.length + ' actif(s)', sub: objEnRetard > 0 ? objEnRetard + ' en retard' : 'Tout est OK', cls: objEnRetard > 0 ? 'negative' : 'positive' },
            { icon: '💳', label: 'Budget restant', val: this.formatCurrency(budgetRestant), sub: '', cls: budgetRestant >= 0 ? 'positive' : 'negative' },
            { icon: '🔄', label: 'Récurrences', val: this.formatCurrency(this.data.recurrences.filter(r => r.actif).reduce((s, r) => s + r.montant, 0)) + '/mois', sub: this.data.recurrences.filter(r => r.actif).length + ' actif(s)', cls: '' }
        ].map(item => `
            <div class="stat-card" style="text-align:left;padding:0.85rem;display:flex;align-items:center;gap:0.75rem">
                <div style="font-size:1.3rem">${item.icon}</div>
                <div>
                    <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:0.15rem">${item.label}</div>
                    <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary)">${item.val}</div>
                    ${item.sub ? `<div class="stat-change ${item.cls}" style="font-size:0.72rem">${item.sub}</div>` : ''}
                </div>
            </div>
        `).join('');
    },

    refreshAlertes() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear  = now.getFullYear();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear  = currentMonth === 0 ? currentYear - 1 : currentYear;
        const exclus    = this.data.categoriesEpargne || ['ÉPARGNE'];

        const depMois = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        const depMoisPrev = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
        });

        const depEffectives = depMois.filter(d =>
            !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase())));
        const totalEffMois  = depEffectives.reduce((s, d) => s + d.montant, 0);

        const parCatMois = {};
        const parCatPrev = {};
        depMois.forEach(d => { parCatMois[d.categorie] = (parCatMois[d.categorie] || 0) + d.montant; });
        depMoisPrev.forEach(d => { parCatPrev[d.categorie] = (parCatPrev[d.categorie] || 0) + d.montant; });

        const alertes = [];
        const { total: revenuTotal } = this.getRevenusMois(currentYear, currentMonth);

        if (revenuTotal === 0) {
            alertes.push({ type: 'warning', icon: '💡', msg: `Saisissez vos <strong>revenus du mois</strong> dans l'onglet Dépenses pour des analyses précises.` });
        }

        if (revenuTotal > 0) {
            const cashflow = revenuTotal - totalEffMois;
            const tauxEp   = (cashflow / revenuTotal) * 100;
            if (tauxEp < 5) {
                alertes.push({ type: 'danger', icon: '🚨', msg: `Taux d'épargne critique : <strong>${tauxEp.toFixed(0)}%</strong> — Cashflow : ${this.formatCurrency(cashflow)}` });
            } else if (tauxEp < 20) {
                alertes.push({ type: 'warning', icon: '⚠️', msg: `Taux d'épargne à <strong>${tauxEp.toFixed(0)}%</strong> — objectif 20%. Cashflow : <strong>${this.formatCurrency(cashflow)}</strong>` });
            } else {
                alertes.push({ type: 'success', icon: '✅', msg: `Taux d'épargne : <strong>${tauxEp.toFixed(0)}%</strong> — Cashflow positif : <strong>+${this.formatCurrency(cashflow)}</strong>` });
            }
        }

        const dernierPat = this.data.patrimoine.length > 0
            ? [...this.data.patrimoine].sort((a, b) => { const mc = b.mois.localeCompare(a.mois); return mc !== 0 ? mc : (b.date||b.mois).localeCompare(a.date||a.mois); })[0] : null;
        if (dernierPat) {
            const liquides = this.data.comptesLiquides || [];
            if (liquides.length === 0) {
                alertes.push({ type: 'warning', icon: '🛡️', msg: `Fonds d'urgence : aucun compte tagué comme liquide. Ouvrez <strong>Gérer les comptes</strong> (onglet Patrimoine) et cochez 🛡️ vos livrets.` });
            } else {
                let securise = 0;
                liquides.forEach(c => { securise += dernierPat[c] || 0; });
                let totalDep3M = 0, nbMois = 0;

                for (let i = 1; i <= 6; i++) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const t = this.data.depenses.filter(dep => {
                        const dd = new Date(dep.date);
                        return dd.getMonth() === d.getMonth() && dd.getFullYear() === d.getFullYear()
                            && !exclus.some(e => dep.categorie.toUpperCase().includes(e.toUpperCase()));
                    }).reduce((s, dep) => s + dep.montant, 0);
                    if (t > 0) { totalDep3M += t; nbMois++; }
                }
                if (nbMois > 0) {
                    const moyDep = totalDep3M / nbMois;
                    const couverture = securise / moyDep;
                    const detail = `${this.formatCurrency(securise)} épargnés · moy. dépenses ${this.formatCurrency(moyDep)}/mois (${nbMois} mois complets)`;
                    if (couverture < 3) {
                        alertes.push({ type: 'danger', icon: '🛡️', msg: `Fonds d'urgence insuffisant : <strong>${couverture.toFixed(1)} mois couverts</strong> — ${detail} — min recommandé : <strong>${this.formatCurrency(moyDep * 3)}</strong>` });
                    } else if (couverture < 6) {
                        alertes.push({ type: 'warning', icon: '🛡️', msg: `Fonds d'urgence : <strong>${couverture.toFixed(1)} mois couverts</strong> — ${detail} — cible idéale : <strong>${this.formatCurrency(moyDep * 6)}</strong> (6 mois)` });
                    } else {
                        alertes.push({ type: 'success', icon: '🛡️', msg: `Fonds d'urgence solide : <strong>${couverture.toFixed(1)} mois couverts</strong> — ${detail}` });
                    }
                }
            }
        }

        Object.keys(this.data.budgets).forEach(cat => {
            if (exclus.some(e => cat.toUpperCase().includes(e.toUpperCase()))) return;
            const dep    = parCatMois[cat] || 0;
            const budget = this.data.budgets[cat];
            if (budget <= 0) return;
            if (dep > budget) {
                alertes.push({ type: 'danger', icon: '🚨', msg: `Budget <strong>${cat}</strong> dépassé : ${this.formatCurrency(dep)} / ${this.formatCurrency(budget)}` });
            } else if (dep > budget * 0.85) {
                alertes.push({ type: 'warning', icon: '⚠️', msg: `Budget <strong>${cat}</strong> bientôt atteint : ${this.formatCurrency(dep)} / ${this.formatCurrency(budget)} (${(dep/budget*100).toFixed(0)}%)` });
            }
        });

        Object.keys(parCatMois).forEach(cat => {
            if (exclus.some(e => cat.toUpperCase().includes(e.toUpperCase()))) return;
            const prev = parCatPrev[cat];
            const mois = parCatMois[cat];
            if (prev && prev > 0) {
                const variation = ((mois - prev) / prev) * 100;
                if (variation > 50 && mois > 50)
                    alertes.push({ type: 'warning', icon: '📦', msg: `<strong>${cat}</strong> en hausse de ${variation.toFixed(0)}% vs mois dernier (${this.formatCurrency(mois)} vs ${this.formatCurrency(prev)})` });
            }
        });

        let bonnes = 0;
        Object.keys(this.data.budgets).forEach(cat => {
            if (exclus.some(e => cat.toUpperCase().includes(e.toUpperCase()))) return;
            const dep = parCatMois[cat] || 0;
            if (dep > 0 && this.data.budgets[cat] > 0 && dep < this.data.budgets[cat] * 0.7) bonnes++;
        });
        if (bonnes > 0) {
            alertes.push({ type: 'success', icon: '✅', msg: `<strong>${bonnes} catégorie(s)</strong> bien en dessous du budget — bravo !` });
        }

        const container = document.getElementById('alertes-container');
        if (!container) return;
        if (alertes.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div>Aucune anomalie détectée</div></div>';
            return;
        }

        alertes.sort((a,b) => {
            const order = { danger:0, warning:1, success:2 };
            return (order[a.type]||2) - (order[b.type]||2);
        });

        const badge = document.getElementById('alertes-badge');
        const urgentes = alertes.filter(a => a.type === 'danger' || a.type === 'warning').length;
        if (badge) {
            if (urgentes > 0) { badge.style.display = 'inline-block'; badge.textContent = urgentes + ' alerte' + (urgentes > 1 ? 's' : ''); }
            else { badge.style.display = 'none'; }
        }

        const alertesBody = document.getElementById('alertes-body');
        const alertesArrow = document.getElementById('alertes-arrow');
        if (alertesBody && urgentes > 0 && alertesBody.style.display === 'none') {
            alertesBody.style.display = 'block';
            if (alertesArrow) alertesArrow.style.transform = 'rotate(90deg)';
        }

        const renderAlerte = (a) => `
            <div style="display:flex;gap:0.75rem;align-items:flex-start;padding:0.65rem 0.9rem;border-radius:10px;margin-bottom:0.4rem;
                background:var(--bg-secondary);border-left:3px solid var(--${a.type === 'danger' ? 'danger' : a.type === 'warning' ? 'warning' : 'success'})">
                <span style="font-size:1rem;flex-shrink:0">${a.icon}</span>
                <span style="font-size:0.8rem;color:var(--text-primary);line-height:1.4">${a.msg}</span>
            </div>`;

        const visible = alertes.slice(0, 3);
        const reste = alertes.slice(3);

        let html = visible.map(renderAlerte).join('');
        if (reste.length > 0) {
            html += `
            <div id="alertes-extra" style="display:none">${reste.map(renderAlerte).join('')}</div>
            <button onclick="const el=document.getElementById('alertes-extra');const open=el.style.display!=='none';el.style.display=open?'none':'block';this.textContent=open?'▸ Voir ${reste.length} alerte(s) de plus':'▴ Réduire';"
                style="width:100%;padding:.5rem;background:transparent;border:1px solid var(--border-color);border-radius:8px;color:var(--text-tertiary);font-family:DM Mono,monospace;font-size:.68rem;cursor:pointer;margin-top:.25rem">
                ▸ Voir ${reste.length} alerte(s) de plus
            </button>`;
        }
        container.innerHTML = html;
    },

    ouvrirClassif503020() {
        if (!this.data.classif503020) this.data.classif503020 = {};
        const overrides  = this.data.classif503020;
        const exclus     = this.data.categoriesEpargne || ['ÉPARGNE'];
        const besoinsKeys = ['MANGER', 'CARBU', 'TRANSPORT', 'LOYER', 'SANTE', 'FACTURE', 'ABONNEMENT'];
        const enviesKeys  = ['LOISIR', 'BAR', 'VETEMENT', 'SHOPPING', 'RESTAURANT', 'SORTIE'];
        const cats = Object.keys(this.data.budgets).sort();

        const getClassif = cat => {
            if (overrides[cat]) return overrides[cat];
            if (exclus.some(e => cat.toUpperCase().includes(e.toUpperCase()))) return 'epargne';
            const catUp = cat.toUpperCase();
            if (besoinsKeys.some(k => catUp.includes(k))) return 'besoin';
            if (enviesKeys.some(k => catUp.includes(k))) return 'envie';
            return 'auto';
        };

        const mkBadge = (cat, type, current) => {
            const configs = {
                besoin:  { label: '🏠 Besoin',  color: 'var(--success)',   bg: 'rgba(0,200,83,.12)'   },
                envie:   { label: '🎉 Envie',   color: 'var(--warning)',   bg: 'rgba(255,152,0,.12)'  },
                epargne: { label: '💰 Épargne', color: 'var(--accent-primary)', bg: 'rgba(168,85,247,.12)' },
                auto:    { label: '🔀 Auto',    color: 'var(--text-tertiary)', bg: 'var(--bg-secondary)' },
            };
            const cfg = configs[type];
            const isActive = current === type;
            return `<button onclick="app._setClassif503020('${cat.replace(/'/g,"\\'")}','${type}')"
                style="font-size:.68rem;font-family:DM Mono,monospace;padding:.3rem .65rem;border-radius:100px;border:2px solid ${isActive ? cfg.color : 'var(--border-color)'};background:${isActive ? cfg.bg : 'transparent'};color:${isActive ? cfg.color : 'var(--text-tertiary)'};cursor:pointer;font-weight:${isActive ? '700' : '500'};transition:all .15s"
            >${cfg.label}</button>`;
        };

        let modal = document.getElementById('classif503020Modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'classif503020Modal';
            modal.className = 'modal';
            modal.style.cssText = 'z-index:2000;border-radius:20px;max-width:560px;max-height:80vh;overflow-y:auto';
            document.body.appendChild(modal);
        }

        const renderModal = () => {
            modal.innerHTML = `
            <div class="modal-header" style="position:sticky;top:0;background:var(--bg-card);z-index:1;padding-bottom:.75rem;margin-bottom:.25rem">
                <h2 class="modal-title" style="font-family:'Outfit',sans-serif">🏷 Classifier les catégories</h2>
                <p style="font-size:.75rem;color:var(--text-secondary);margin-top:.3rem;line-height:1.5">
                    Clique sur un badge pour forcer la classification.<br>
                    <strong>🔀 Auto</strong> = l'app utilise les mots-clés (comportement par défaut).
                </p>
            </div>
            <div class="modal-body" style="padding-top:.25rem">
                <div style="display:flex;flex-direction:column;gap:.55rem">
                ${cats.map(cat => {
                    const current = getClassif(cat);
                    const isEpargne = exclus.some(e => cat.toUpperCase().includes(e.toUpperCase()));
                    const isOverridden = !!overrides[cat];
                    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.6rem .85rem;background:var(--bg-secondary);border-radius:12px;flex-wrap:wrap">
                        <div style="display:flex;align-items:center;gap:.5rem;min-width:0">
                            <span style="font-size:.82rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${cat}</span>
                            ${isOverridden ? '<span style="font-size:.55rem;font-family:DM Mono,monospace;background:rgba(168,85,247,.15);color:var(--accent-primary);padding:.1rem .4rem;border-radius:100px;white-space:nowrap">forcé</span>' : ''}
                        </div>
                        <div style="display:flex;gap:.3rem;flex-wrap:wrap">
                            ${isEpargne ? mkBadge(cat,'epargne',current) : `${mkBadge(cat,'besoin',current)}${mkBadge(cat,'envie',current)}${mkBadge(cat,'auto',current)}`}
                        </div>
                    </div>`;
                }).join('')}
                </div>
                ${Object.keys(overrides).length > 0 ? `
                <button onclick="app._resetAllClassif503020()" class="btn btn-secondary btn-small" style="margin-top:1rem;width:100%">
                    🔄 Tout remettre en Auto
                </button>` : ''}
            </div>
            <div class="modal-footer">
                <button class="vp-btn-cancel" onclick="app._closeClassif503020Modal()">Fermer</button>
            </div>`;
        };

        renderModal();
        this._classif503020RenderFn = renderModal;
        modal.style.display = 'block';
        document.getElementById('overlay').style.display = 'block';
    },

    _setClassif503020(cat, type) {
        if (!this.data.classif503020) this.data.classif503020 = {};
        if (type === 'auto') {
            delete this.data.classif503020[cat];
        } else {
            this.data.classif503020[cat] = type;
        }
        this.save();
        this.refreshRegle503020();
        if (this._classif503020RenderFn) this._classif503020RenderFn();
    },

    _resetAllClassif503020() {
        this.data.classif503020 = {};
        this.save();
        this.refreshRegle503020();
        if (this._classif503020RenderFn) this._classif503020RenderFn();
    },

    _closeClassif503020Modal() {
        const modal = document.getElementById('classif503020Modal');
        if (modal) modal.style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
        this._classif503020RenderFn = null;
    },

    refreshRegle503020() {
        const now = new Date();
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        const depMois = this.data.depenses.filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });

        const depEffectives = depMois.filter(d =>
            !exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase()))
        );
        const totalDepenses = depEffectives.reduce((s, d) => s + d.montant, 0);

        const virements = depMois.filter(d =>
            exclus.some(e => d.categorie.toUpperCase().includes(e.toUpperCase()))
        ).reduce((s, d) => s + d.montant, 0);

        const { total: revenuTotal, source } = this.getRevenusMois(now.getFullYear(), now.getMonth());
        const base = revenuTotal > 0 ? revenuTotal : totalDepenses;
        if (base === 0) return;

        const besoinsKeys = ['MANGER', 'CARBU', 'TRANSPORT', 'LOYER', 'SANTE', 'FACTURE', 'ABONNEMENT'];
        const enviesKeys  = ['LOISIR', 'BAR', 'VETEMENT', 'SHOPPING', 'RESTAURANT', 'SORTIE'];
        const overrides   = this.data.classif503020 || {};

        let besoins = 0, envies = 0;
        depEffectives.forEach(d => {
            const cat = d.categorie;
            const override = overrides[cat];
            if (override === 'besoin') { besoins += d.montant; return; }
            if (override === 'envie')  { envies  += d.montant; return; }

            const catUp = cat.toUpperCase();
            if (besoinsKeys.some(k => catUp.includes(k))) besoins += d.montant;
            else if (enviesKeys.some(k => catUp.includes(k))) envies += d.montant;
            else { besoins += d.montant * 0.5; envies += d.montant * 0.5; }
        });

        const epargne = revenuTotal > 0
            ? Math.max(0, revenuTotal - totalDepenses)
            : 0;
        const pBesoins = Math.round((besoins / base) * 100);
        const pEnvies  = Math.round((envies  / base) * 100);
        const pEpargne = revenuTotal > 0 ? Math.round((epargne / revenuTotal) * 100) : Math.max(0, 100 - pBesoins - pEnvies);

        const elDep = document.getElementById('regle-total-dep');
        const elSal = document.getElementById('regle-total-sal');
        if (elDep) elDep.textContent = this.formatCurrency(totalDepenses);
        if (elSal) elSal.textContent = revenuTotal > 0 ? this.formatCurrency(revenuTotal) + '/mois' + (source === 'salaire' ? ' (param.)' : '') : 'Non renseigné';

        const comp = document.getElementById('comparaison-503020');
        if (comp) {
            const mkCard = (emoji, label, cibleLabel, cible, reel, montant, okFn) => {
                const ok = okFn(reel);
                const couleurs = ok
                    ? { bg: 'rgba(0,200,83,.1)', text: 'var(--success)', border: 'var(--success)' }
                    : reel > 0 && Math.abs(reel - cible) <= 5
                        ? { bg: 'rgba(255,152,0,.1)', text: 'var(--warning)', border: 'var(--warning)' }
                        : { bg: 'rgba(244,67,54,.1)', text: 'var(--danger)', border: 'var(--danger)' };
                return `
                <div style="background:${couleurs.bg};border-radius:16px;padding:1rem .85rem;text-align:center;position:relative;overflow:hidden;border-bottom:3px solid ${couleurs.border}">
                    <div style="font-size:1.5rem;margin-bottom:.25rem">${emoji}</div>
                    <div style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:${couleurs.text};font-weight:600;margin-bottom:.3rem">${label}</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.9rem;font-weight:800;color:${couleurs.text};line-height:1.1">${reel}%</div>
                    <div style="font-size:.62rem;color:var(--text-tertiary);margin:.25rem 0">cible ${cibleLabel}</div>
                    <div style="font-family:'DM Mono',monospace;font-size:.72rem;font-weight:600;color:${couleurs.text}">${this.formatCurrency(montant)}</div>
                </div>`;
            };
            comp.innerHTML =
                mkCard('🏠', 'Besoins', '≤ 50%', 50, pBesoins, besoins, p => p <= 55) +
                mkCard('🎉', 'Envies',  '≤ 30%', 30, pEnvies,  envies,  p => p <= 33) +
                (() => {
                    const ok = pEpargne >= 15;
                    const near = pEpargne > 0 && Math.abs(pEpargne - 20) <= 5;
                    const couleurs = ok
                        ? { bg: 'rgba(0,200,83,.1)', text: 'var(--success)', border: 'var(--success)' }
                        : near
                            ? { bg: 'rgba(255,152,0,.1)', text: 'var(--warning)', border: 'var(--warning)' }
                            : { bg: 'rgba(244,67,54,.1)', text: 'var(--danger)', border: 'var(--danger)' };
                    const cashflowResiduel = Math.max(0, epargne - virements);
                    const detail = virements > 0
                        ? `<div style="font-size:.6rem;color:var(--text-tertiary);margin-top:.3rem;line-height:1.5">
                              <span style="color:${couleurs.text};font-weight:600">${this.formatCurrency(virements)}</span> virements
                              ${cashflowResiduel > 0 ? `<br>+ <span style="color:${couleurs.text};font-weight:600">${this.formatCurrency(cashflowResiduel)}</span> cashflow` : ''}
                           </div>`
                        : '';
                    return `
                    <div style="background:${couleurs.bg};border-radius:16px;padding:1rem .85rem;text-align:center;position:relative;overflow:hidden;border-bottom:3px solid ${couleurs.border}">
                        <div style="font-size:1.5rem;margin-bottom:.25rem">💰</div>
                        <div style="font-size:.6rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:${couleurs.text};font-weight:600;margin-bottom:.3rem">Épargne</div>
                        <div style="font-family:'Outfit',sans-serif;font-size:1.9rem;font-weight:800;color:${couleurs.text};line-height:1.1">${pEpargne}%</div>
                        <div style="font-size:.62rem;color:var(--text-tertiary);margin:.25rem 0">cible ≥ 20%</div>
                        <div style="font-family:'DM Mono',monospace;font-size:.72rem;font-weight:600;color:${couleurs.text}">${this.formatCurrency(epargne)}</div>
                        ${detail}
                    </div>`;
                })();
        }

        const conseil = document.getElementById('regle-conseil');
        if (conseil) {
            const msgs = [];
            if (pEpargne < 15 && salaire > 0) {
                const manque = Math.round((revenuTotal * 0.20) - epargne);
                msgs.push(`💡 Épargne trop faible (${pEpargne}% vs 20% cible) — il te manque <strong>${this.formatCurrency(manque)}/mois</strong>.`);
            }
            if (pBesoins > 55) msgs.push(`⚠️ Tes besoins dépassent 50% de tes revenus — surveille les postes fixes.`);
            if (pEnvies > 33) msgs.push(`⚠️ Tes envies dépassent 30% — essaie de réduire loisirs ou shopping.`);
            if (msgs.length === 0) msgs.push(`✅ Tu respectes la règle 50/30/20 — continue comme ça !`);
            conseil.style.display = 'block';
            conseil.style.borderLeftColor = pEpargne >= 15 && pBesoins <= 55 && pEnvies <= 33 ? 'var(--success)' : 'var(--warning)';
            conseil.innerHTML = msgs.join('<br>');
        }

        const barWrap = document.getElementById('regle-global-bar');
        if (barWrap) {
            barWrap.style.display = 'block';
            const total3 = pBesoins + pEnvies + Math.max(0, pEpargne);
            const scale = total3 > 0 ? 100 / Math.max(total3, 100) : 1;
            const bB = document.getElementById('rbar-besoins');
            const bE = document.getElementById('rbar-envies');
            const bS = document.getElementById('rbar-epargne');
            if (bB) { bB.style.width = '0%'; setTimeout(() => bB.style.width = (pBesoins * scale).toFixed(1) + '%', 50); }
            if (bE) { bE.style.width = '0%'; setTimeout(() => bE.style.width = (pEnvies  * scale).toFixed(1) + '%', 200); }
            if (bS) { bS.style.width = '0%'; setTimeout(() => bS.style.width = (Math.max(0,pEpargne) * scale).toFixed(1) + '%', 350); }
            const lB = document.getElementById('rbar-lbl-besoins');
            const lE = document.getElementById('rbar-lbl-envies');
            const lS = document.getElementById('rbar-lbl-epargne');
            if (lB) lB.textContent = `Besoins ${pBesoins}% · ${this.formatCurrency(besoins)}`;
            if (lE) lE.textContent = `Envies ${pEnvies}% · ${this.formatCurrency(envies)}`;
            if (lS) lS.textContent = `Épargne ${pEpargne}% · ${this.formatCurrency(epargne)}`;
        }
    },

    ouvrirAjoutRecurrence() {

        let modal = document.getElementById('recurrenceModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'recurrenceModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal-header"><h2 class="modal-title">🔄 Nouvelle récurrence</h2></div>
            <div class="modal-body">
                <div class="form-group"><label class="form-label">Nom</label><input type="text" class="form-input" id="rec-nom" placeholder="Ex: Loyer, Netflix..."></div>
                <div class="form-group"><label class="form-label">Emoji</label>
                    <div class="emoji-picker-wrap">
                        <button type="button" class="emoji-preview-btn" onclick="app.openEmojiPicker('rec-emoji', this)">🏠</button>
                        <input type="text" class="form-input" id="rec-emoji" placeholder="🏠" style="display:none">
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group"><label class="form-label">Montant (€)</label><input type="number" class="form-input" id="rec-montant" placeholder="0" step="0.01"></div>
                    <div class="form-group"><label class="form-label">Jour du mois</label><input type="number" class="form-input" id="rec-jour" placeholder="1" min="1" max="31"></div>
                </div>
                <div class="form-group"><label class="form-label">Fréquence</label>
                    <select class="form-select" id="rec-freq"><option value="mensuel">Mensuel</option><option value="trimestriel">Trimestriel</option><option value="annuel">Annuel</option></select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="vp-btn-cancel" onclick="document.getElementById('recurrenceModal').classList.remove('active');document.getElementById('overlay').classList.remove('active')">Annuler</button>
                <button class="vp-btn-save" onclick="app.ajouterRecurrence()">+ Ajouter</button>
            </div>
        `;
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    ajouterRecurrence() {
        const nom = document.getElementById('rec-nom').value.trim();
        const emojiInput = document.getElementById('rec-emoji');
        const emojiBtn = emojiInput.closest('.emoji-picker-wrap')?.querySelector('.emoji-preview-btn');
        const emoji = emojiInput.value.trim() || (emojiBtn ? emojiBtn.textContent.trim() : '') || '💳';
        const montant = parseFloat(document.getElementById('rec-montant').value);
        const jour = parseInt(document.getElementById('rec-jour').value) || 1;
        const freq = document.getElementById('rec-freq').value;
        if (!nom || !montant) { this.notify('Remplir nom et montant', 'error'); return; }
        this.data.recurrences.push({ id: crypto.randomUUID(), nom, emoji, montant, jour, freq, actif: true });
        this.save();
        this.refreshRecurrences();
        document.getElementById('recurrenceModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        this.notify('Récurrence ajoutée', 'success');
    },

    supprimerRecurrence(id) {
        this.data.recurrences = this.data.recurrences.filter(r => r.id !== id);
        this.save();
        this.refreshRecurrences();
        this.notify('Récurrence supprimée', 'success');
    },

    refreshRecurrences() {
        const container = document.getElementById('recurrences-list');
        if (!container) return;
        const recs = this.data.recurrences;
        if (recs.length === 0) {
            container.innerHTML = `<div class="v-empty" style="padding:1.5rem 1rem"><div class="v-empty-title">Aucune récurrence</div><p class="v-empty-desc">Ajoute tes dépenses fixes (loyer, abonnements…) pour les suivre automatiquement.</p></div>`;
            const tot = document.getElementById('recurrences-total-wrap');
            if (tot) tot.style.display = 'none';
            return;
        }
        const now = new Date();
        const today = now.getDate();
        container.innerHTML = recs.map(r => {
            const jours = r.jour > today ? r.jour - today : 30 - today + r.jour;
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.65rem 0.85rem;background:var(--bg-secondary);border-radius:10px;margin-bottom:0.5rem;border:1px solid var(--border-color)">
                <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:8px;height:8px;border-radius:50%;background:${r.actif ? 'var(--success)' : 'var(--text-tertiary)'};box-shadow:${r.actif ? '0 0 6px var(--success)' : 'none'}"></div>
                    <span style="font-size:1.1rem">${r.emoji}</span>
                    <div>
                        <div style="font-size:0.85rem;font-weight:600">${r.nom}</div>
                        <div style="font-size:0.7rem;color:var(--text-tertiary)">${r.freq} · le ${r.jour}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:1rem">
                    <div style="text-align:right">
                        <div style="font-family:DM Mono,monospace;font-size:0.9rem;font-weight:600;color:var(--danger)">−${this.formatCurrency(r.montant)}</div>
                        <div style="font-size:0.65rem;color:var(--text-tertiary)">Dans ${jours} jours</div>
                    </div>
                    <button class="btn btn-small btn-secondary" onclick="app.supprimerRecurrence(${r.id})">✕</button>
                </div>
            </div>`;
        }).join('');
        const total = recs.filter(r => r.actif).reduce((s, r) => s + r.montant, 0);
        const totWrap = document.getElementById('recurrences-total-wrap');
        if (totWrap) { totWrap.style.display = 'flex'; }
        const totEl = document.getElementById('recurrences-total');
        if (totEl) totEl.textContent = this.formatCurrency(total);
    },

    ouvrirAjoutObjectif() {
        let modal = document.getElementById('objectifModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'objectifModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal-header"><h2 class="modal-title">🎯 Nouvel objectif</h2></div>
            <div class="modal-body">
                <div style="display:flex;flex-direction:column;gap:.65rem">
                    <div style="display:grid;grid-template-columns:1fr auto;gap:.65rem;align-items:end">
                        <div class="form-group" style="margin:0"><label class="form-label">Nom</label><input type="text" class="form-input" id="obj-nom" placeholder="Voyage Japon..."></div>
                        <div class="form-group" style="margin:0"><label class="form-label">Emoji</label>
                            <div class="emoji-picker-wrap">
                                <button type="button" class="emoji-preview-btn" onclick="app.openEmojiPicker('obj-emoji', this)">🎯</button>
                                <input type="text" class="form-input" id="obj-emoji" placeholder="🎯" style="display:none">
                            </div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem">
                        <div class="form-group" style="margin:0"><label class="form-label">Montant cible (€)</label><input type="number" class="form-input" id="obj-cible" placeholder="3500" step="100"></div>
                        <div class="form-group" style="margin:0"><label class="form-label">Déjà épargné (€)</label><input type="number" class="form-input" id="obj-actuel" placeholder="0" step="100"></div>
                    </div>
                    <div class="form-group" style="margin:0"><label class="form-label">Date cible</label><input type="month" class="form-input" id="obj-date"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="vp-btn-cancel" onclick="document.getElementById('objectifModal').classList.remove('active');document.getElementById('overlay').classList.remove('active')">Annuler</button>
                <button class="vp-btn-save" onclick="app.ajouterObjectif()">+ Ajouter</button>
            </div>
        `;
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    ajouterObjectif() {
        const nom = document.getElementById('obj-nom').value.trim();
        const emojiInput = document.getElementById('obj-emoji');
        const emojiBtn = emojiInput.closest('.emoji-picker-wrap')?.querySelector('.emoji-preview-btn');
        const emoji = emojiInput.value.trim() || (emojiBtn ? emojiBtn.textContent.trim() : '') || '🎯';
        const cible = parseFloat(document.getElementById('obj-cible').value);
        const actuel = parseFloat(document.getElementById('obj-actuel').value) || 0;
        const dateTarget = document.getElementById('obj-date').value;
        if (!nom || !cible) { this.notify('Remplir nom et cible', 'error'); return; }
        this.data.objectifs.push({ id: crypto.randomUUID(), nom, emoji, cible, actuel, dateTarget });
        this.save();
        this.refreshObjectifs();
        document.getElementById('objectifModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        this.notify('Objectif ajouté', 'success');
    },

    mettreAJourObjectif(id, nouvelActuel) {
        const obj = this.data.objectifs.find(o => o.id === id);
        if (obj) { obj.actuel = parseFloat(nouvelActuel) || 0; this.save(); this.refreshObjectifs(); }
    },

    supprimerObjectif(id) {
        this.showModal('Supprimer l\'objectif', 'Voulez-vous vraiment supprimer cet objectif ?', () => {
            this.data.objectifs = this.data.objectifs.filter(o => o.id !== id);
            this.save();
            this.refreshObjectifs();
            this.notify('Objectif supprimé', 'success');
        });
    },

    refreshObjectifs() {
        const list = document.getElementById('objectifs-list');
        const calcCard = document.getElementById('objectifs-calcul-card');
        if (!list) return;
        const objs = this.data.objectifs;
        const now = new Date();

        document.getElementById('obj-count').textContent = objs.length;
        document.getElementById('obj-total-cible').textContent = this.formatCurrency(objs.reduce((s, o) => s + o.cible, 0));

        if (objs.length === 0) {
            list.innerHTML = `<div class="v-empty">${(this._emptyIllus||{}).bilan||''}<div class="v-empty-title">Aucun objectif</div><p class="v-empty-desc">Définis tes premiers objectifs d'épargne pour te motiver au quotidien.</p></div>`;
            if (calcCard) calcCard.style.display = 'none';
            document.getElementById('obj-mensuel-total').textContent = '0 €';

            const dc = document.getElementById('d-obj-count'); if(dc) dc.textContent = '0 en cours';
            return;
        }

        let totalMensuel = 0;
        let calcHtml = '';
        const gradients = [
            'linear-gradient(135deg,var(--accent-gradient-start),var(--accent-gradient-end))',
            'linear-gradient(135deg,#4a1a6b,#7c4dff)',
            'linear-gradient(135deg,#0a3d2e,var(--success))',
            'linear-gradient(135deg,#5c2000,var(--warning))',
            'linear-gradient(135deg,#1a0a3d,#3949ab)',
            'linear-gradient(135deg,#3d0a0a,#e53935)',
        ];

        const termines = objs.filter(o => (o.actuel / o.cible) >= 1);
        const encours  = objs.filter(o => (o.actuel / o.cible) < 1);

        let gridHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;margin-bottom:1.5rem">';

        [...encours, ...termines].forEach((o, idx) => {
            const pct = Math.min(100, (o.actuel / o.cible) * 100);
            const done = pct >= 100;
            const moisRestants = o.dateTarget ? Math.max(1, Math.ceil((new Date(o.dateTarget + '-01') - now) / (1000*60*60*24*30))) : 12;
            const mensuel = Math.ceil((o.cible - o.actuel) / moisRestants);
            totalMensuel += done ? 0 : Math.max(0, mensuel);
            const dateLabel = o.dateTarget ? new Date(o.dateTarget + '-01').toLocaleDateString('fr-FR', {month:'short', year:'numeric'}) : '—';
            const grad = done ? 'linear-gradient(135deg,#006b2e,var(--success))' : gradients[idx % gradients.length];

            const salaire = this.data.parametres.salaire || 0;
            const epMensuelle = salaire > 0 ? salaire * 0.2 : 150;
            const moisProj = epMensuelle > 0 ? Math.ceil((o.cible - o.actuel) / epMensuelle) : null;
            let projText = '';
            if (!done && moisProj) {
                const projDate = new Date(); projDate.setMonth(projDate.getMonth() + moisProj);
                const projLabel = projDate.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
                projText = moisProj <= (moisRestants||999)
                    ? `<div style="background:rgba(0,200,83,.12);border-radius:8px;padding:.45rem .65rem;font-size:.68rem;color:var(--success);margin-top:.6rem">📊 Au rythme actuel → <strong>${projLabel}</strong></div>`
                    : `<div style="background:rgba(255,152,0,.1);border-radius:8px;padding:.45rem .65rem;font-size:.68rem;color:var(--warning);margin-top:.6rem">⚡ Augmenter l'épargne pour respecter l'échéance</div>`;
            }
            const progressColor = done ? 'var(--success)' : pct >= 60 ? 'var(--accent-primary)' : pct >= 30 ? 'var(--warning)' : 'var(--danger)';
            const doneTag = done ? '<span style="background:rgba(0,200,83,.15);color:var(--success);border:1px solid rgba(0,200,83,.3);border-radius:20px;font-size:.6rem;font-family:DM Mono,monospace;padding:.1rem .5rem;font-weight:600">ATTEINT ✓</span>' : '';

            gridHtml += `
            <div style="background:var(--bg-card);border-radius:18px;overflow:hidden;box-shadow:8px 8px 20px var(--shadow-light),-8px -8px 20px var(--shadow-dark);transition:transform .2s" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
              <div style="background:${grad};padding:1.1rem 1.25rem;position:relative">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div style="font-size:1.8rem">${o.emoji}</div>
                  <button onclick="app.supprimerObjectif(${o.id})" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center">✕</button>
                </div>
                <div style="font-weight:700;color:#fff;font-size:.95rem;margin-top:.35rem">${o.nom}</div>
                <div style="font-size:.65rem;color:rgba(255,255,255,.7);margin-top:.15rem">${dateLabel} ${doneTag}</div>
              </div>
              <div style="padding:.9rem 1.1rem">
                <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.35rem">
                  <span style="font-weight:700;font-size:1rem;font-family:'Outfit',sans-serif">${this.formatCurrency(o.actuel)}</span>
                  <span style="color:var(--text-tertiary)">${this.formatCurrency(o.cible)}</span>
                </div>
                <div class="progress-bar" style="height:8px;margin:.4rem 0">
                  <div class="progress-fill" style="width:${pct}%;background:${progressColor}"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-tertiary);margin-bottom:.4rem">
                  <span>${pct.toFixed(0)}% atteint</span>
                  ${done ? '' : `<span>${moisRestants} mois restants</span>`}
                </div>
                ${projText}
                ${done ? '' : `
                <div style="display:flex;gap:.4rem;margin-top:.65rem;align-items:center">
                  <input type="number" class="form-input" placeholder="Mettre à jour (€)" step="50" style="flex:1;padding:.5rem;font-size:.8rem" onchange="app.mettreAJourObjectif(${o.id}, this.value)">
                </div>`}
              </div>
            </div>`;

            calcHtml += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.85rem;background:var(--bg-secondary);border-radius:10px;margin-bottom:0.5rem;border:1px solid var(--border-color)">
                    <div><span style="font-size:0.9rem">${o.emoji}</span> <strong>${o.nom}</strong>
                        <div style="font-size:0.72rem;color:var(--text-tertiary)">${dateLabel} · ${moisRestants} mois</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-family:DM Mono,monospace;font-size:0.9rem;font-weight:700;background:linear-gradient(135deg,var(--accent-gradient-start),var(--accent-gradient-end));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${this.formatCurrency(Math.max(0, mensuel))}/mois</div>
                        <div style="font-size:0.68rem;color:var(--text-tertiary)">Reste ${this.formatCurrency(Math.max(0, o.cible - o.actuel))}</div>
                    </div>
                </div>`;
        });

        gridHtml += '</div>';
        list.innerHTML = gridHtml;

        if (calcCard) {
            calcCard.style.display = 'block';
            document.getElementById('objectifs-calcul').innerHTML = calcHtml;
            document.getElementById('obj-grand-total').textContent = this.formatCurrency(totalMensuel);
        }
        document.getElementById('obj-mensuel-total').textContent = this.formatCurrency(totalMensuel);
        const dc = document.getElementById('d-obj-count');
        if(dc) dc.textContent = `${encours.length} en cours`;
    },

    ajouterNote() {
        const mois = document.getElementById('note-mois').value;
        const texte = document.getElementById('note-texte').value.trim();
        const tag = document.getElementById('note-tag').value;
        if (!mois || !texte) { this.notify('Remplir mois et note', 'error'); return; }
        this.data.notes.push({ id: crypto.randomUUID(), mois, texte, tag });
        this.save();
        this.refreshNotes();
        document.getElementById('note-texte').value = '';
        this.notify('Note enregistrée', 'success');
    },

    openBsNote() {

        const today = new Date();
        const month = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
        document.getElementById('bs-note-mois').value = month;
        document.getElementById('bs-note-texte').value = '';
        document.getElementById('bs-note-tag').value = 'Général';
        document.getElementById('bs-note-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('bs-note-texte').focus(), 300);
    },

    closeBsNote() {
        this._vpBsClose('bs-note-overlay');
        document.body.style.overflow = '';
    },

    saveBsNote() {
        const mois  = document.getElementById('bs-note-mois').value;
        const texte = document.getElementById('bs-note-texte').value.trim();
        const tag   = document.getElementById('bs-note-tag').value;
        if (!mois || !texte) { this.notify('Remplir le mois et la note', 'error'); return; }
        this.data.notes.push({ id: crypto.randomUUID(), mois, texte, tag });
        this.save();
        this.refreshNotes();
        this.closeBsNote();
        this.notify('Note enregistrée ✓', 'success');
    },

    supprimerNote(id) {
        this.showModal(
            'Supprimer la note',
            'Voulez-vous vraiment supprimer cette note ?',
            () => {
                this.data.notes = this.data.notes.filter(n => String(n.id) !== String(id));
                this.save();
                this.refreshNotes();
                this.notify('Note supprimée', 'success');
            }
        );
    },

    refreshNotes() {
        const container = document.getElementById('notes-list');
        if (!container) return;
        const notes = [...this.data.notes].sort((a, b) => b.mois.localeCompare(a.mois));
        if (notes.length === 0) {
            container.innerHTML = `<div class="v-empty" style="padding:1.5rem 1rem"><div class="v-empty-title">Aucune note</div><p class="v-empty-desc">Ajoute des notes mensuelles pour garder une trace de tes moments financiers.</p></div>`;
            return;
        }
        const tagColors = {
            'Général': 'var(--accent-primary)',
            'Dépense exceptionnelle': 'var(--warning)',
            'Revenu exceptionnel': 'var(--success)',
            'Événement important': 'var(--accent-secondary)',
            'Objectif atteint 🎉': 'var(--success)'
        };
        container.innerHTML = notes.map(n => {
            const color = tagColors[n.tag] || 'var(--accent-primary)';
            const dateLabel = new Date(n.mois + '-01').toLocaleDateString('fr-FR', {month:'long', year:'numeric'});
            return `
            <div style="background:var(--bg-secondary);border-radius:12px;padding:1rem 1.25rem;margin-bottom:0.75rem;border-left:3px solid ${color};border:1px solid var(--border-color);border-left:3px solid ${color}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                    <div style="display:flex;align-items:center;gap:0.5rem">
                        <span style="font-family:DM Mono,monospace;font-size:0.78rem;color:${color};font-weight:600">${dateLabel}</span>
                        <span style="font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:4px;background:${color}22;color:${color}">${n.tag}</span>
                    </div>
                    <button class="btn btn-small btn-secondary" onclick="app.supprimerNote('${n.id}')">✕</button>
                </div>
                <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5">${n.texte}</div>
            </div>`;
        }).join('');
    },

    ouvrirAjoutLignePEA() {
        let modal = document.getElementById('lignePEAModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'lignePEAModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal-header"><h2 class="modal-title">📈 Nouvelle ligne PEA</h2></div>
            <div class="modal-body">
                <div class="grid grid-2">
                    <div class="form-group"><label class="form-label">Nom du titre</label><input type="text" class="form-input" id="lpea-nom" placeholder="MSCI World"></div>
                    <div class="form-group"><label class="form-label">ISIN</label><input type="text" class="form-input" id="lpea-isin" placeholder="IE00B4L5Y983" style="font-family:DM Mono,monospace;letter-spacing:0.04em"></div>
                    <div class="form-group"><label class="form-label">Nombre de parts</label><input type="number" class="form-input" id="lpea-parts" placeholder="10" step="1"></div>
                    <div class="form-group"><label class="form-label">PRU (€ / part)</label><input type="number" class="form-input" id="lpea-pru" placeholder="0.00" step="0.01"></div>
                </div>
                <p style="font-size:0.72rem;color:var(--text-tertiary);font-family:DM Mono,monospace;margin-top:0.5rem">💡 Saisis l'ISIN (ex: <strong>IE00B4L5Y983</strong>) ou directement le ticker Yahoo Finance (ex: <strong>MWRD.PA</strong>). Le cours sera récupéré automatiquement via 🔄 Actualiser.</p>
            </div>
            <div class="modal-footer">
                <button class="vp-btn-cancel" onclick="document.getElementById('lignePEAModal').classList.remove('active');document.getElementById('overlay').classList.remove('active')">Annuler</button>
                <button class="vp-btn-save" onclick="app.ajouterLignePEA()">+ Ajouter</button>
            </div>
        `;
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    ajouterLignePEA() {
        const nom = document.getElementById('lpea-nom').value.trim();
        const isin = document.getElementById('lpea-isin').value.trim().toUpperCase();
        const parts = parseFloat(document.getElementById('lpea-parts').value) || 0;
        const pru = parseFloat(document.getElementById('lpea-pru').value) || 0;
        if (!nom || !parts) { this.notify('Remplir nom et parts', 'error'); return; }
        this.data.lignesPEA.push({ id: crypto.randomUUID(), nom, isin, ticker: '', parts, pru, valeurActuelle: pru });
        this.save();
        this.refreshLignesPEA();
        this.chartPEA();
        document.getElementById('lignePEAModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        this.notify('Ligne PEA ajoutée — clique sur 🔄 Actualiser pour récupérer le cours', 'success');
    },

    supprimerLignePEA(id) {
        this.data.lignesPEA = this.data.lignesPEA.filter(l => String(l.id) !== String(id));
        this.save();
        this.refreshLignesPEA();
        this.chartPEA();
        this.notify('Ligne supprimée', 'success');
    },

    refreshLignesPEA() {
        const tbody = document.getElementById('tbody-lignes-pea');
        if (!tbody) return;
        const lignes = this.data.lignesPEA;
        if (lignes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="padding:0"><div class="v-empty" style="padding:2rem 1rem">${(this._emptyIllus||{}).pea||''}<div class="v-empty-title">Aucune ligne PEA</div><p class="v-empty-desc">Ajoute tes ETF et actions pour suivre ta performance.</p></div></td></tr>`;
            document.getElementById('pv-latente-total').textContent = this.formatCurrency(0);
            return;
        }
        let pvTotal = 0;
        tbody.innerHTML = lignes.map(l => {
            const valeurTotale = l.parts * (l.valeurActuelle || l.pru);
            const investi = l.parts * l.pru;
            const pv = valeurTotale - investi;
            const pvPct = investi > 0 ? ((pv / investi) * 100).toFixed(1) : 0;
            pvTotal += pv;
            const isinDisplay = l.isin || l.ticker || '—';
            return `
            <tr>
                <td><strong>${l.nom}</strong></td>
                <td style="font-family:DM Mono,monospace;font-size:0.72rem;color:var(--text-tertiary)">${isinDisplay}</td>
                <td style="font-family:DM Mono,monospace">${l.parts}</td>
                <td style="font-family:DM Mono,monospace">${this.formatCurrency(l.pru)}</td>
                <td style="font-family:DM Mono,monospace">${this.formatCurrency(l.valeurActuelle || l.pru)}</td>
                <td style="font-family:DM Mono,monospace">${this.formatCurrency(investi)}</td>
                <td class="stat-change ${pv >= 0 ? 'positive' : 'negative'}" style="font-family:DM Mono,monospace">${pv >= 0 ? '+' : ''}${pvPct}%</td>
                <td><button class="btn btn-small btn-secondary" onclick="app.supprimerLignePEA('${l.id}')">✕</button></td>
            </tr>`;
        }).join('');
        document.getElementById('pv-latente-total').textContent = (pvTotal >= 0 ? '+' : '') + this.formatCurrency(pvTotal);
    },

    async _finnhubQuote(ticker) {
        const key = (this.data.parametres.finnhubKey || '').trim();
        if (!key) throw new Error('Clé Finnhub manquante — ouvre les ⚙ Paramètres');
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`;
        const r = await Promise.race([
            fetch(url),
            new Promise((_,rej) => setTimeout(() => rej(new Error('Timeout Finnhub')), 8000))
        ]);
        if (!r.ok) throw new Error(`Finnhub HTTP ${r.status}`);
        const d = await r.json();
        if (!d || d.c === undefined || d.c === 0) throw new Error(`Ticker "${ticker}" introuvable sur Finnhub`);
        return d.c;
    },

    async actualiserCoursPEA() {
        const lignes = this.data.lignesPEA;
        if (lignes.length === 0) { this.notify('Ajoute des lignes PEA en premier', 'error'); return; }
        const key = (this.data.parametres.finnhubKey || '').trim();
        if (!key) {
            this.notify('Clé Finnhub manquante — ouvre les ⚙ Paramètres', 'error');
            this.toggleSettings();
            return;
        }

        const btn  = document.getElementById('btn-actualiser-pea');
        const icon = document.getElementById('actualiser-icon');
        if (btn)  btn.disabled = true;
        if (icon) icon.textContent = '⏳';
        this.notify('Récupération des cours Finnhub…', 'info');

        try {
            let mises = 0, nonTrouves = [];

            for (const l of lignes) {
                const ticker = (l.ticker || '').trim();
                if (!ticker) { nonTrouves.push(l.nom + ' (pas de ticker)'); continue; }
                try {
                    const prix = await this._finnhubQuote(ticker);
                    l.valeurActuelle = prix;
                    mises++;
                } catch(e) {
                    nonTrouves.push(l.nom);
                }

                await new Promise(r => setTimeout(r, 200));
            }

            if (mises === 0) throw new Error(`Aucun cours récupéré. Vérifie les tickers de tes lignes PEA (ex: CW8.PA pour Euronext Paris).`);

            const totalValeur  = lignes.reduce((s, l) => s + (l.parts * (l.valeurActuelle || l.pru)), 0);
            const totalInvesti = lignes.reduce((s, l) => s + (l.parts * l.pru), 0);
            const gain = totalValeur - totalInvesti;
            const perf = totalInvesti > 0 ? ((gain / totalInvesti) * 100).toFixed(2) : '0';
            const today = new Date().toISOString().split('T')[0];
            const entry = { id: crypto.randomUUID(), date: today, valeur: totalValeur, investi: totalInvesti,
                            gainPerte: gain, performance: perf, note: '📡 Finnhub' };
            const idx = this.data.suiviPEA.findIndex(p => p.date === today);
            if (idx >= 0) this.data.suiviPEA[idx] = entry; else this.data.suiviPEA.push(entry);

            this.save();
            this.refreshLignesPEA();
            this.refreshStatsPEA();
            this.afficherPEA();
            this.chartPEA();

            const warn = nonTrouves.length > 0 ? ` · ⚠️ Non trouvés : ${nonTrouves.join(', ')}` : '';
            this.notify(`✅ ${mises} cours mis à jour — PEA : ${this.formatCurrency(totalValeur)}${warn}`, 'success');

        } catch(err) {
            this.notify(`❌ ${err.message}`, 'error');
        } finally {
            if (btn)  btn.disabled = false;
            if (icon) icon.textContent = '🔄';
        }
    },

    async testerFinnhub() {
        const key = (document.getElementById('set-finnhub-key')?.value || '').trim();
        if (!key) { this.notify('Entre ta clé API en premier', 'error'); return; }
        this.data.parametres.finnhubKey = key;
        this.notify('Test en cours…', 'info');
        try {
            const url = `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${key}`;
            const r = await fetch(url);
            const d = await r.json();
            if (d && d.c > 0) {
                this.notify(`✅ Finnhub connecté ! Apple = $${d.c}`, 'success');
                this.save();
            } else {
                this.notify('❌ Clé invalide ou quota dépassé', 'error');
            }
        } catch(e) {
            this.notify('❌ Erreur de connexion Finnhub', 'error');
        }
    },

    _benchmarkPeriod: '1m',
    _benchmarkCache: {},

    toggleBenchmark() {
        const card = document.getElementById('benchmark-card');
        const btn  = document.getElementById('btn-benchmark-toggle');
        if (!card) return;
        const open = card.style.display !== 'none';
        card.style.display = open ? 'none' : 'block';
        btn.textContent = open ? '📊 Benchmark' : '✕ Fermer';
        if (!open) this.refreshBenchmark();
    },

    switchBenchmarkPeriod(el, period) {
        this._benchmarkPeriod = period;
        document.querySelectorAll('.period-btn').forEach(b => {
            b.className = b === el ? 'btn btn-small period-btn active' : 'btn btn-small btn-secondary period-btn';
        });
        this.refreshBenchmark();
    },

    async refreshBenchmark() {
        const key = (this.data.parametres.finnhubKey || '').trim();
        const statsEl = document.getElementById('benchmark-stats');
        const lastEl  = document.getElementById('benchmark-last-update');

        if (!key) {
            if (statsEl) statsEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔑</div><div>Configure ta clé Finnhub dans les ⚙️ Paramètres pour voir le benchmark</div></div>';
            return;
        }

        const peaData = [...this.data.suiviPEA].sort((a, b) => new Date(a.date) - new Date(b.date));
        if (peaData.length < 2) {
            if (statsEl) statsEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div>Il faut au moins 2 entrées dans ton historique PEA pour comparer</div></div>';
            return;
        }

        const period = this._benchmarkPeriod;
        const now = new Date();
        const cutoff = new Date(now);
        if      (period === '1m') cutoff.setMonth(cutoff.getMonth() - 1);
        else if (period === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
        else if (period === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
        else                      cutoff.setFullYear(cutoff.getFullYear() - 1);

        const peaFiltered = peaData.filter(p => new Date(p.date) >= cutoff);
        if (peaFiltered.length < 1) {
            if (statsEl) statsEl.innerHTML = '<div class="empty-state"><div>Pas assez de données PEA sur cette période</div></div>';
            return;
        }

        if (statsEl) statsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:var(--text-tertiary)">⏳ Récupération des indices…</div>';

        try {

            const peaStart = peaFiltered[0].valeur;
            const peaEnd   = peaFiltered[peaFiltered.length - 1].valeur;
            const peaPerf  = peaStart > 0 ? ((peaEnd - peaStart) / peaStart * 100) : 0;

            const [msciPrice, sp500Price] = await Promise.all([
                this._finnhubQuote('IWDA'),
                this._finnhubQuote('SPY'),
            ]);

            const cacheKey = `bench_${period}`;
            let msciPerf = 0, sp500Perf = 0;

            if (this._benchmarkCache[cacheKey]) {
                msciPerf  = this._benchmarkCache[cacheKey].msci;
                sp500Perf = this._benchmarkCache[cacheKey].sp500;
            } else {

                const fromTs = Math.floor(cutoff.getTime() / 1000);
                const toTs   = Math.floor(now.getTime() / 1000);

                const fetchCandles = async (symbol) => {
                    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${fromTs}&to=${toTs}&token=${key}`;
                    const r = await fetch(url);
                    const d = await r.json();
                    if (!d || !d.c || d.c.length < 2) return null;
                    return { start: d.c[0], end: d.c[d.c.length - 1], dates: d.t, closes: d.c };
                };

                const [msciCandles, sp500Candles] = await Promise.all([
                    fetchCandles('IWDA'),
                    fetchCandles('SPY'),
                ]);

                if (msciCandles)  msciPerf  = (msciCandles.end - msciCandles.start) / msciCandles.start * 100;
                if (sp500Candles) sp500Perf = (sp500Candles.end - sp500Candles.start) / sp500Candles.start * 100;

                this._benchmarkCache[cacheKey] = { msci: msciPerf, sp500: sp500Perf, ts: Date.now() };

                if (msciCandles && sp500Candles) {
                    const basePeaVal = peaFiltered[0]?.valeur || 1000;
                    this._renderBenchmarkChart(peaFiltered, msciCandles, sp500Candles, basePeaVal);
                }
            }

            const alpha = peaPerf - msciPerf;

            if (statsEl) {
                const fmt = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
                const col = (v) => v >= 0 ? 'var(--success)' : 'var(--danger)';
                statsEl.innerHTML = `
                <div class="stat-card" style="text-align:center">
                    <div class="stat-label">Ton PEA</div>
                    <div class="stat-value" style="color:${col(peaPerf)};font-size:1.8rem">${fmt(peaPerf)}</div>
                    <div class="stat-change" style="color:var(--text-tertiary);font-size:.72rem">${period === '1m' ? '1 mois' : period === '3m' ? '3 mois' : period === '6m' ? '6 mois' : '1 an'}</div>
                </div>
                <div class="stat-card" style="text-align:center">
                    <div class="stat-label">MSCI World (IWDA)</div>
                    <div class="stat-value" style="color:${col(msciPerf)};font-size:1.8rem">${fmt(msciPerf)}</div>
                    <div class="stat-change" style="color:var(--text-tertiary);font-size:.72rem">Référence mondiale</div>
                </div>
                <div class="stat-card" style="text-align:center;${Math.abs(alpha) > 0.1 ? 'border-left:3px solid ' + col(alpha) : ''}">
                    <div class="stat-label">Alpha généré</div>
                    <div class="stat-value" style="color:${col(alpha)};font-size:1.8rem">${fmt(alpha)}</div>
                    <div class="stat-change" style="color:var(--text-tertiary);font-size:.72rem">${alpha > 0 ? '🏆 Tu bats le marché' : alpha < -0.5 ? '📉 En dessous du marché' : '≈ Dans la moyenne'}</div>
                </div>`;
            }

            if (lastEl) lastEl.textContent = ` · Mis à jour : ${new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}`;

        } catch(e) {
            if (statsEl) statsEl.innerHTML = `<div style="grid-column:1/-1;color:var(--danger);padding:1rem;font-size:.85rem">❌ Erreur : ${e.message}</div>`;
        }
    },

    _renderBenchmarkChart(peaData, msciCandles, sp500Candles, basePeaVal) {
        const c = this.getChartColors();

        const labels = msciCandles.dates.map(t => {
            const d = new Date(t * 1000);
            return d.toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
        });
        const msciBase  = msciCandles.closes[0];
        const sp500Base = sp500Candles.closes[0];
        const msciNorm  = msciCandles.closes.map(v => ((v - msciBase) / msciBase * 100));
        const sp500Norm = sp500Candles.closes.map(v => ((v - sp500Base) / sp500Base * 100));

        const peaByDate = {};
        peaData.forEach(p => { peaByDate[p.date] = p.valeur; });
        const peaNorm = msciCandles.dates.map(t => {
            const d = new Date(t * 1000).toISOString().split('T')[0];

            const keys = Object.keys(peaByDate).sort();
            const closest = keys.reduce((a, b) => Math.abs(new Date(b) - new Date(d)) < Math.abs(new Date(a) - new Date(d)) ? b : a);
            return closest ? ((peaByDate[closest] - basePeaVal) / basePeaVal * 100) : null;
        });

        if (this.charts.benchmark) this.charts.benchmark.destroy();
        const ctx = document.getElementById('chart-benchmark');
        if (!ctx) return;

        this.charts.benchmark = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Ton PEA',
                        data: peaNorm,
                        borderColor: c.primary,
                        backgroundColor: c.bg1,
                        tension: 0.3, fill: true, borderWidth: 3,
                        spanGaps: true
                    },
                    {
                        label: 'MSCI World (IWDA)',
                        data: msciNorm,
                        borderColor: _b1,
                        backgroundColor: 'transparent',
                        tension: 0.3, fill: false, borderWidth: 2,
                        borderDash: [5,3]
                    },
                    {
                        label: 'S&P 500 (SPY)',
                        data: sp500Norm,
                        borderColor: _b2,
                        backgroundColor: 'transparent',
                        tension: 0.3, fill: false, borderWidth: 2,
                        borderDash: [2,3]
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: this.getChartLegendOptions(),
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? (ctx.parsed.y >= 0 ? '+' : '') + ctx.parsed.y.toFixed(2) + '%' : 'N/A'}`
                        }
                    }
                },
                scales: {
                    ...this.getChartScaleOptions(),
                    y: {
                        ...this.getChartScaleOptions().y,
                        ticks: {
                            ...this.getChartScaleOptions().y.ticks,
                            callback: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
                        }
                    }
                }
            }
        });
    },

    ouvrirModalRetraite() {
        let modal = document.getElementById('retraiteModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'retraiteModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal-header"><h2 class="modal-title">👴 Projection Retraite</h2></div>
            <div class="modal-body">
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Âge actuel</label>
                        <input type="number" class="form-input" id="ret-age" placeholder="28" min="18" max="65">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Âge cible retraite</label>
                        <input type="number" class="form-input" id="ret-age-cible" placeholder="65" min="40" max="80">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Épargne mensuelle (€)</label>
                        <input type="number" class="form-input" id="ret-epargne" placeholder="500" step="50">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rendement annuel moyen (%)</label>
                        <input type="number" class="form-input" id="ret-taux" placeholder="6" step="0.5">
                    </div>
                </div>
                <button class="btn btn-primary" onclick="app.calculerRetraite()" style="width:100%;margin-top:0.5rem">📊 Calculer</button>
                <div id="retraite-results" style="display:none;margin-top:1.5rem">
                    <div class="grid grid-3 grid-stats" style="margin-bottom:1rem">
                        <div class="stat-card stat-card-main"><div class="stat-label">Optimiste (+2%)</div><div class="stat-value accent" id="ret-optimiste">0 €</div></div>
                        <div class="stat-card stat-card-main"><div class="stat-label">Réaliste</div><div class="stat-value" id="ret-realiste">0 €</div></div>
                        <div class="stat-card stat-card-main"><div class="stat-label">Basse (−2%)</div><div class="stat-value" id="ret-basse">0 €</div></div>
                    </div>
                    <div style="padding:1rem;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border-color)" id="ret-conseil"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="vp-btn-cancel" onclick="document.getElementById('retraiteModal').classList.remove('active');document.getElementById('overlay').classList.remove('active')">Fermer</button>
            </div>
        `;
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
    },

    calculerRetraite() {
        const age = parseInt(document.getElementById('ret-age').value) || 28;
        const ageCible = parseInt(document.getElementById('ret-age-cible').value) || 65;
        const epargne = parseFloat(document.getElementById('ret-epargne').value) || 0;
        const taux = parseFloat(document.getElementById('ret-taux').value) / 100 || 0.06;
        const annees = Math.max(1, ageCible - age);
        const patrimoineActuel = this.data.patrimoine.length > 0 ?
            [...this.data.patrimoine].sort((a, b) => { const mc = b.mois.localeCompare(a.mois); return mc !== 0 ? mc : (b.date||b.mois).localeCompare(a.date||a.mois); })[0].total : 0;

        const calculer = (t) => {
            const tm = t / 12;
            const mois = annees * 12;
            let val = patrimoineActuel;
            for (let i = 0; i < mois; i++) {
                val = (val + epargne) * (1 + tm);
            }
            return val;
        };

        const realiste = calculer(taux);
        const optimiste = calculer(taux + 0.02);
        const basse = calculer(Math.max(0, taux - 0.02));

        document.getElementById('ret-optimiste').textContent = this.formatCurrency(optimiste);
        document.getElementById('ret-realiste').textContent = this.formatCurrency(realiste);
        document.getElementById('ret-basse').textContent = this.formatCurrency(basse);
        document.getElementById('retraite-results').style.display = 'block';

        const mensuelNecessaire = 500000 > realiste ?
            Math.ceil((500000 - patrimoineActuel) / ((Math.pow(1 + taux/12, annees*12) - 1) / (taux/12) || 1)) : 0;
        document.getElementById('ret-conseil').innerHTML = `
            <strong>💡 Conseil :</strong> Avec votre patrimoine actuel de <strong>${this.formatCurrency(patrimoineActuel)}</strong> et
            ${epargne > 0 ? `une épargne de <strong>${this.formatCurrency(epargne)}/mois</strong>` : 'aucune épargne mensuelle'},
            vous accumuleriez environ <strong>${this.formatCurrency(realiste)}</strong> à ${ageCible} ans.
            ${mensuelNecessaire > 0 && mensuelNecessaire > epargne ? `Pour atteindre <strong>500 000 €</strong>, il faudrait épargner <strong>${this.formatCurrency(mensuelNecessaire)}/mois</strong>.` : mensuelNecessaire === 0 ? '🎉 Vous êtes en bonne voie pour dépasser 500 000 € !' : ''}
        `;
    },

    _emojiData: {
        '😀 Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','🫠','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😶‍🌫️','😏','😒','🙄','😬','😮‍💨','🤥','🫨','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
        '👋 Gestes': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','🫷','🫸','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄','🫦','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵'],
        '👨‍💼 Personnes': ['🧑‍⚕️','👨‍⚕️','👩‍⚕️','🧑‍🎓','👨‍🎓','👩‍🎓','🧑‍🏫','👨‍🏫','👩‍🏫','🧑‍⚖️','👨‍⚖️','👩‍⚖️','🧑‍🌾','👨‍🌾','👩‍🌾','🧑‍🍳','👨‍🍳','👩‍🍳','🧑‍🔧','👨‍🔧','👩‍🔧','🧑‍🏭','👨‍🏭','👩‍🏭','🧑‍💼','👨‍💼','👩‍💼','🧑‍🔬','👨‍🔬','👩‍🔬','🧑‍🎨','👨‍🎨','👩‍🎨','🧑‍🚒','👨‍🚒','👩‍🚒','🧑‍✈️','👨‍✈️','👩‍✈️','🧑‍🚀','👨‍🚀','👩‍🚀','🧑‍💻','👨‍💻','👩‍💻','👮','💂','🕵️','👷','🥷','🫅','🤴','👸','👰','🤵','🎅','🤶','🧙','🧚','🧛','🧜','🧝','🧞','🧟','🧌','🦸','🦹','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','🧗','🏋️','🤼','🤸','⛹️','🏊','🤽','🚣','🧘','🛀'],
        '🐶 Animaux': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🫎','🫏','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗','🪳','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🪸','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🫚','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔','🐾'],
        '🌸 Plantes': ['🌸','🌺','🌻','🌹','🥀','🪷','🌷','💐','🌼','🌾','🍀','🍁','🍂','🍃','🪻','🌱','🪴','🌲','🌳','🌴','🌵','🎋','🎍','🍄','🪸','🪨','🌊','🌿'],
        '🍎 Nourriture': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🫛','🥦','🥬','🥒','🌶️','🫑','🧄','🧅','🥔','🍠','🫚','🥐','🥖','🍞','🥨','🥯','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🫙','🧂','🥫','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🥤','🧊'],
        '⚽ Sport': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🎯','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎷','🪗','🎸','🎹','🎺','🎻','🪕','🥁','🪘','🎮','🕹️','🎲','🧩','🪅','🪆','🎴','🀄','♟️'],
        '🚗 Transport': ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🛞','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰️','🚀','🛸','🪐','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚍','🛕','🚒'],
        '🏠 Lieux': ['🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏧','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🛖','🏕️','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🗾','🎑','🏞️','🌌','🌠','🎇','🎆','🌇','🗺️'],
        '💡 Objets': ['💡','🔦','🕯️','🪔','🧱','🪞','🪟','🛋️','🪑','🚽','🪠','🚿','🛁','🪤','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🪒','🛒','🚪','🪜','🧲','🪝','🧰','🔧','🔨','🪚','⚒️','🛠️','⛏️','🔩','🪛','🔗','⛓️','🧲','💊','💉','🩸','🩹','🩺','🩻','🩼','🩻','🔬','🔭','🧬','🦠','🧫','🧪','🌡️','🪜','💰','💴','💵','💶','💷','💸','💳','🪙','💹','✉️','📧','📨','📩','📪','📫','📬','📭','📮','🗳️','✏️','✒️','🖋️','🖊️','📝','📁','📂','🗂️','📅','📆','🗒️','🗓️','📇','📈','📉','📊','📋','📌','📍','🗺️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🪓','⚔️','🛡️','🪃','🏹','🔫','🪤','⚙️','🗜️','⚖️','🦯','🔗','🧲','💈','🔮','🪄','🧿','🪬','🪩','🪭','🧸','🪆','🎭','🖼️','🎨','🧵','🪡','🧶','🪢','🔔','🔕','📣','📢'],
        '💻 Tech': ['💻','🖥️','🖨️','⌨️','🖱️','🖲️','💾','💿','📀','🧮','📱','☎️','📞','📟','📠','📺','📷','📸','📹','🎥','📽️','🎞️','📡','🔋','🪫','🔌','💡','🔦','🕯️','📲','⌚','📡','🛰️','🤖','🎙️','🎚️','🎛️'],
        '🌟 Symboles': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','🔯','🛐','⭐','🌟','✨','💫','⚡','🔥','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','💧','💦','🌊','🌍','🌎','🌏','🪐','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌛','🌜','🌝','🌞','🪩','✅','❌','⭕','🛑','⛔','📛','🚫','💯','❗','❕','❓','❔','‼️','⁉️','♻️','⚠️','🔱','⚜️','🔰','✔️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔷','🔶','🔹','🔸','💠','🔘','🔲','🔳','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫'],
        '🌈 Nature': ['🌸','🌺','🌻','🌹','🥀','🌷','🌱','🌲','🌳','🌴','🌵','🎋','🎍','🍀','🍁','🍂','🍃','🪴','🪷','💐','🌾','🍄','🪸','🪨','🌊','💧','💦','⛰️','🏔️','🗻','🌋','🏝️','🏜️','🏕️','🌾','🐾','🦋','🌈','☀️','🌤️','⛅','☁️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌊','🌍','🌎','🌏','🪐','💫','⭐','🌟','✨','☄️','💥','🔥','🌈'],
        '🎉 Fêtes': ['🎉','🎊','🎈','🎁','🎀','🎗️','🎟️','🎫','🎖️','🏆','🥇','🥈','🥉','🏅','🎃','🎄','🎆','🎇','🧨','✨','🎋','🎍','🎎','🎐','🎑','🧧','🎠','🎡','🎢','🎪','🤹','🎭','🩰','🎬','🎤','🎧','🎼','🎵','🎶','🎷','🪗','🎸','🎹','🎺','🎻','🪕','🥁','🪘','🎮','🕹️','🎲','🧩','🪅','🪆','🧸','♠️','♥️','♦️','♣️','♟️','🃏','🀄','🎴'],
        '💼 Travail': ['💼','📁','📂','🗂️','📊','📈','📉','📋','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','💡','🖊️','🖋️','✒️','📝','💻','🖥️','🖨️','⌨️','🖱️','🖲️','💾','💿','📀','🧮','📱','☎️','📞','📟','📠','📺','📷','📸','📹','🎥','📡','🔋','🔌','🏦','🏧','💰','💳','💸','📦','🏷️','🛍️','📬','📮','📝','🗒️','🗓️','📅','📆','🔐','🔒','🔓','🔑','🗝️','⚙️','🔧','🔨','🛠️','🔬','🔭'],
        '🇫🇷 Drapeaux': ['🏳️','🏴','🏁','🚩','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇫🇷','🇧🇪','🇨🇭','🇱🇺','🇲🇨','🇦🇩','🇮🇹','🇪🇸','🇵🇹','🇩🇪','🇦🇹','🇬🇧','🇺🇸','🇨🇦','🇦🇺','🇯🇵','🇨🇳','🇧🇷','🇲🇽','🇮🇳','🇷🇺','🇰🇷','🇸🇦','🇮🇱','🇹🇷','🇬🇷','🇳🇱','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇵🇱','🇨🇿','🇭🇺','🇷🇴','🇺🇦','🌍','🌎','🌏'],
    },
    _emojiTarget: null,
    _emojiAllFlat: null,

    initEmojiPicker() {
        const picker = document.getElementById('emojiPicker');
        const catTabs = document.getElementById('emoji-cat-tabs');
        const grid = document.getElementById('emoji-grid');

        this._emojiAllFlat = Object.values(this._emojiData).flat();

        const cats = Object.keys(this._emojiData);
        catTabs.innerHTML = cats.map((cat, i) => {
            const icon = cat.split(' ')[0];
            return `<button class="emoji-cat-btn ${i === 0 ? 'active' : ''}" onclick="app.emojiShowCat('${cat}', this)" title="${cat}">${icon}</button>`;
        }).join('');

        this.emojiShowCat(cats[0], catTabs.firstElementChild);

        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target) &&
                !e.target.classList.contains('emoji-preview-btn')) {
                picker.classList.remove('open');
            }
        });
    },

    emojiShowCat(cat, btn) {
        document.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const emojis = this._emojiData[cat] || [];
        this.emojiRenderGrid(emojis);
    },

    _emojiKeywords: {

        '😀':'sourire content heureux','😂':'rire larmes','😍':'amour coeur yeux','😎':'cool lunettes','😭':'pleurer triste','😡':'colère fâché','🤔':'réfléchir question','😴':'dormir sommeil','🤢':'malade nausée','🤧':'rhume éternuer','😷':'masque malade',

        '🏠':'maison home logement','🏡':'maison jardin','🏢':'bureau immeuble travail','🏥':'hôpital médecin santé','🏦':'banque argent','🏪':'magasin boutique','🏫':'école université','🚗':'voiture auto véhicule','🚕':'taxi voiture','🚙':'SUV voiture','🚲':'vélo cyclisme','🛵':'scooter moto','🏍':'moto','✈️':'avion voyage vol','🚂':'train','🚌':'bus transport','⚓':'ancre bateau','🚀':'fusée espace','🛸':'ovni vaisseau',

        '🍎':'pomme fruit','🍊':'orange fruit','🍋':'citron','🍇':'raisin fruit','🍓':'fraise fruit','🍕':'pizza','🍔':'burger hamburger','🍟':'frites','🌮':'taco','🍜':'ramen nouilles','🍣':'sushi japonais','🍺':'bière alcool','🍷':'vin alcool rouge','☕':'café thé boisson','🧃':'jus boisson',

        '🌸':'fleur cerisier','🌺':'fleur hibiscus','🌻':'tournesol fleur','🌹':'rose fleur','🌱':'plante pousse','🌲':'arbre forêt','🌴':'palmier tropical','🌵':'cactus désert','🍀':'trèfle chance','❄️':'neige froid hiver','🔥':'feu flamme chaud','💧':'eau goutte','🌊':'vague mer ocean','🌈':'arc-en-ciel','⭐':'étoile','🌙':'lune nuit','☀️':'soleil journée',

        '🐶':'chien animal','🐱':'chat animal','🐭':'souris animal','🐰':'lapin animal','🐻':'ours animal','🐼':'panda animal','🦊':'renard animal','🐯':'tigre animal','🦁':'lion animal','🐮':'vache animal','🐷':'cochon animal','🐸':'grenouille animal','🐠':'poisson mer','🐬':'dauphin mer','🦋':'papillon insecte','🐝':'abeille insecte',

        '⚽':'foot football sport','🏀':'basket basketball sport','🎾':'tennis sport','🏊':'natation nager sport','🚴':'cyclisme vélo sport','🏆':'trophée victoire gagnant','🥇':'médaille or premier','🎯':'cible objectif but',

        '💼':'travail bureau mallette','💻':'ordinateur pc travail','📱':'téléphone mobile','💰':'argent monnaie sac','💵':'billet argent dollar','💳':'carte crédit paiement','💸':'argent dépense payer','📊':'graphique stats données','📈':'hausse croissance','📉':'baisse perte','🏧':'distributeur ATM','💹':'bourse finance','📝':'note écrire liste','📅':'calendrier date','✉️':'email lettre message','📞':'téléphone appel',

        '💊':'médicament pilule santé','💉':'vaccin injection santé','🩺':'médecin docteur santé','🏋':'musculation gym sport','🧘':'yoga méditation',

        '🎉':'fête anniversaire célébration','🎊':'fête confetti','🎁':'cadeau présent','🎂':'gâteau anniversaire','🎄':'noël sapin','❤️':'amour coeur','💔':'coeur brisé','💯':'cent parfait','✅':'validé ok oui','❌':'non croix annuler','⚠️':'attention danger alerte','🔔':'notification cloche alerte','🔕':'silencieux muet',

        '🛒':'courses shopping chariot','🧹':'ménage nettoyer','🧺':'linge lavage','🛁':'bain douche','🚿':'douche','🪴':'plante intérieur','🛋':'canapé salon','🪑':'chaise','🚪':'porte','💡':'lampe idée lumière','🔑':'clé porte','🔒':'serrure sécurité',

        '📺':'télé streaming Netflix','🎵':'musique Spotify abonnement','🌐':'internet box wifi','🏠':'loyer logement maison','💈':'coiffeur salon','🚿':'eau facture','⚡':'électricité facture','🔥':'gaz facture chauffage','📦':'abonnement livraison colis','🚌':'transport abonnement',
    },

    emojiSearch(query) {
        const picker = document.getElementById('emojiPicker');
        if (!query.trim()) {
            const firstCat = Object.keys(this._emojiData)[0];
            this.emojiShowCat(firstCat, document.querySelector('.emoji-cat-btn'));
            document.querySelectorAll('.emoji-cat-btn').forEach(b => b.style.opacity = '');
            return;
        }

        document.querySelectorAll('.emoji-cat-btn').forEach(b => {
            b.classList.remove('active');
            b.style.opacity = '0.3';
        });
        const q = query.toLowerCase().trim();
        const all = this._emojiAllFlat;

        const byKeyword = all.filter(e => {
            const kw = this._emojiKeywords[e] || '';
            return kw.toLowerCase().includes(q);
        });

        const byCat = [];
        Object.entries(this._emojiData).forEach(([cat, emojis]) => {
            if (cat.toLowerCase().includes(q)) byCat.push(...emojis);
        });

        const results = [...new Set([...byKeyword, ...byCat])];
        this.emojiRenderGrid(results.length > 0 ? results : []);
        if (results.length === 0) {
            document.getElementById('emoji-grid').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-tertiary);font-size:0.8rem">Aucun résultat pour "${query}"</div>`;
        }
    },

    emojiRenderGrid(emojis) {
        const grid = document.getElementById('emoji-grid');
        grid.innerHTML = emojis.map(e =>
            `<button class="emoji-btn" onclick="app.emojiSelect('${e}')" title="${e}">${e}</button>`
        ).join('');
    },

    openEmojiPickerForCat(cat, btn) {
        this._emojiCatTarget = cat;
        this._emojiCatSelected = this.data.catEmojis?.[cat] || this._getCatEmoji(cat);

        // Remplir le subtitle
        const subtitle = document.getElementById('emoji-cat-modal-subtitle');
        if (subtitle) subtitle.textContent = cat;

        // Aperçu initial
        this._updateEmojiCatPreview(this._emojiCatSelected, cat);

        // Remplir les onglets
        this._initEmojiCatTabs();

        // Reset recherche
        const search = document.getElementById('emoji-cat-search');
        if (search) search.value = '';

        // Ouvrir la modal avec son propre overlay (z-index > budgetsModal)
        document.getElementById('emoji-cat-overlay')?.classList.add('open');
        document.getElementById('modal-emoji-cat')?.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    _updateEmojiCatPreview(emoji, cat) {
        const preview = document.getElementById('emoji-cat-preview');
        const name    = document.getElementById('emoji-cat-preview-name');
        if (preview) preview.textContent = emoji;
        if (name)    name.textContent    = cat || this._emojiCatTarget || '—';
        this._emojiCatSelected = emoji;
    },

    _initEmojiCatTabs() {
        const tabs = document.getElementById('emoji-cat-tabs-modal');
        if (!tabs) return;
        const cats = Object.keys(this._emojiData);
        tabs.innerHTML = cats.map((cat, i) => {
            const icon = cat.split(' ')[0];
            return `<button class="emoji-cat-btn ${i === 0 ? 'active' : ''}"
                style="border-radius:10px;padding:.3rem .5rem;font-size:1.1rem;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;flex-shrink:0;transition:background .15s"
                onclick="app._emojiCatShowCat('${cat}', this)" title="${cat}">${icon}</button>`;
        }).join('');
        this._emojiCatShowCat(cats[0], tabs.firstElementChild);
    },

    _emojiCatShowCat(cat, btn) {
        document.querySelectorAll('#emoji-cat-tabs-modal .emoji-cat-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'var(--bg-secondary)';
        });
        if (btn) { btn.classList.add('active'); btn.style.background = 'var(--bg-card)'; }
        this._emojiCatRenderGrid(this._emojiData[cat] || []);
    },

    _emojiCatRenderGrid(emojis) {
        const grid = document.getElementById('emoji-cat-grid');
        if (!grid) return;
        grid.innerHTML = emojis.map(e =>
            `<button onclick="app._emojiCatSelect('${e}')"
             style="font-size:1.3rem;border:none;background:none;cursor:pointer;border-radius:8px;padding:.2rem;transition:background .12s;line-height:1.4"
             onmouseover="this.style.background='var(--bg-secondary)'"
             onmouseout="this.style.background='none'"
             title="${e}">${e}</button>`
        ).join('');
    },

    _emojiCatSelect(emoji) {
        this._updateEmojiCatPreview(emoji, this._emojiCatTarget);
    },

    _emojiCatSearch(query) {
        if (!query.trim()) {
            const firstCat = Object.keys(this._emojiData)[0];
            this._emojiCatShowCat(firstCat, document.querySelector('#emoji-cat-tabs-modal .emoji-cat-btn'));
            document.querySelectorAll('#emoji-cat-tabs-modal .emoji-cat-btn').forEach(b => b.style.opacity = '');
            return;
        }
        document.querySelectorAll('#emoji-cat-tabs-modal .emoji-cat-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'var(--bg-secondary)';
            b.style.opacity = '.4';
        });
        const q = query.toLowerCase().trim();
        const all = this._emojiAllFlat || Object.values(this._emojiData).flat();
        const byKeyword = all.filter(e => (this._emojiKeywords[e] || '').toLowerCase().includes(q));
        const byCat = [];
        Object.entries(this._emojiData).forEach(([cat, emojis]) => {
            if (cat.toLowerCase().includes(q)) byCat.push(...emojis);
        });
        const results = [...new Set([...byKeyword, ...byCat])];
        if (results.length === 0) {
            const grid = document.getElementById('emoji-cat-grid');
            if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-tertiary);font-size:.8rem">Aucun résultat</div>`;
        } else {
            this._emojiCatRenderGrid(results);
        }
    },

    resetEmojiCat() {
        const cat = this._emojiCatTarget;
        if (!cat) return;
        const defaultEmoji = this._getCatEmojiDefault(cat);
        this._updateEmojiCatPreview(defaultEmoji, cat);
    },

    _getCatEmojiDefault(cat) {
        // Retourne l'emoji par défaut (sans tenir compte de catEmojis)
        const match = cat.match(/^\p{Emoji}/u);
        if (match) return match[0];
        const MAP = {
            'ALIMENTATION':'🛒','COURSES':'🛒','MANGER':'🛒','RESTAURANT':'🍽️','RESTAURANTS':'🍽️',
            'LOGEMENT':'🏠','LOYER':'🏠','LOYERS':'🏠','TRANSPORT':'🚗','CARBU':'⛽','CARBURANT':'⛽',
            'LOISIR':'🎮','LOISIRS':'🎮','SANTÉ':'💊','SANTE':'💊','ÉPARGNE':'💎','EPARGNE':'💎',
            'INVESTISSEMENT':'📈','HABILLEMENT':'👔','VETEMENT':'👗','VÊTEMENT':'👗',
            'VOYAGES':'✈️','VOYAGE':'✈️','SPORT':'🏋️','EDUCATION':'📚','HIGH-TECH':'💻',
            'ABONNEMENT':'📱','ABONNEMENTS':'📱','BAR':'🍺','CIGARETTE':'🚬','TABAC':'🚬',
            'AUTRE':'📦','AUTRES':'📦','DIVERS':'📦','SHOPPING':'🛍️','FACTURE':'📄',
        };
        const up = cat.toUpperCase();
        for (const k of Object.keys(MAP)) if (up.includes(k)) return MAP[k];
        return '📦';
    },

    confirmEmojiCat() {
        const cat   = this._emojiCatTarget;
        const emoji = this._emojiCatSelected;
        if (!cat) return;

        if (!this.data.catEmojis) this.data.catEmojis = {};
        // Si l'emoji sélectionné == défaut, supprimer l'entrée custom (économie de stockage)
        if (emoji === this._getCatEmojiDefault(cat)) {
            delete this.data.catEmojis[cat];
        } else {
            this.data.catEmojis[cat] = emoji;
        }
        this.save();

        // Mettre à jour le bouton dans la liste sans re-render
        const btn = document.querySelector(`.cat-emoji-btn[data-cat="${CSS.escape(cat)}"]`);
        if (btn) btn.textContent = emoji;

        // Rafraîchir les zones budget
        this._refreshBudgetHeroAndCats();
        if (document.getElementById('modal-all-cats')?.classList.contains('open')) this._renderAllCatsModal();

        this.closeEmojiCatModal();
        this.notify(`Emoji de "${cat}" mis à jour`, 'success');
    },

    closeEmojiCatModal() {
        document.getElementById('modal-emoji-cat')?.classList.remove('open');
        document.getElementById('emoji-cat-overlay')?.classList.remove('open');
        this._emojiCatTarget   = null;
        this._emojiCatSelected = null;
        document.body.style.overflow = '';
    },

    openEmojiPicker(targetInputId, btn) {
        this._emojiTarget = targetInputId;
        const picker = document.getElementById('emojiPicker');
        const rect = btn.getBoundingClientRect();

        const spaceBelow = window.innerHeight - rect.bottom;
        picker.style.left = Math.min(rect.left, window.innerWidth - 330) + 'px';
        if (spaceBelow > 400) {
            picker.style.top = (rect.bottom + 6) + 'px';
            picker.style.bottom = 'auto';
        } else {
            picker.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
            picker.style.top = 'auto';
        }
        document.getElementById('emoji-search').value = '';
        const firstCat = Object.keys(this._emojiData)[0];
        this.emojiShowCat(firstCat, document.querySelector('.emoji-cat-btn'));
        picker.classList.toggle('open');
    },

    emojiSelect(emoji) {
        // Mode normal (objectifs, récurrences)
        if (this._emojiTarget) {
            const input = document.getElementById(this._emojiTarget);
            if (input) {
                input.value = emoji;
                const btn = input.closest('.emoji-picker-wrap')?.querySelector('.emoji-preview-btn');
                if (btn) btn.textContent = emoji;
            }
        }
        document.getElementById('emojiPicker').classList.remove('open');
    },

    /* Legacy compat — ancien toggle outils (remplacé par openPeaPanel) */
    togglePeaOutils() {
        const card = document.getElementById('pea-outils-card');
        const btn  = document.getElementById('btn-pea-outils-toggle');
        if (!card) return;
        const open = card.style.display !== 'none';
        card.style.display = open ? 'none' : 'block';
        if (btn) btn.textContent = open ? '🧮 Outils' : '✕ Outils';
    },

    switchPeaOutil(nom, el) {
        ['previsions','calculateur'].forEach(n => {
            const panel = document.getElementById('pea-outil-' + n);
            if (panel) panel.style.display = n === nom ? 'block' : 'none';
        });
        document.querySelectorAll('#pea-outils-card .period-btn').forEach(b => {
            b.classList.toggle('active', b === el);
            b.classList.toggle('btn-secondary', b !== el);
        });
    },

    fermerResumeHebdo() {
        const card = document.getElementById('resume-hebdo-card');
        if (card) card.style.display = 'none';
        localStorage.setItem('resumeHebdoFerme', new Date().toISOString().split('T')[0]);
    },

    checkResumeHebdo() {
        const today     = new Date();
        const dayOfWeek = today.getDay();
        const fermeKey  = localStorage.getItem('resumeHebdoFerme');
        const fermeToday = fermeKey === today.toISOString().split('T')[0];
        if (fermeToday) return;

        this.genererResumeHebdo();
    },

    genererResumeHebdo() {
        const card = document.getElementById('resume-hebdo-card');
        if (!card) return;

        const today  = new Date();
        const lundi  = new Date(today); lundi.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() - 1);
        const lundiPrev = new Date(lundi); lundiPrev.setDate(lundi.getDate() - 7);

        const fmtDate = (d) => d.toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
        const periode = `${fmtDate(lundiPrev)} — ${fmtDate(dimanche)}`;

        const lundiPrevStr  = lundiPrev.toISOString().split('T')[0];
        const dimancheStr   = dimanche.toISOString().split('T')[0];
        const depsSemaine   = this.data.depenses.filter(d => d.date >= lundiPrevStr && d.date <= dimancheStr);
        const totalSemaine  = depsSemaine.reduce((s,d) => s + d.montant, 0);

        const lundi2Prev = new Date(lundiPrev); lundi2Prev.setDate(lundiPrev.getDate() - 7);
        const lundi2Str  = lundi2Prev.toISOString().split('T')[0];
        const deps2Sem   = this.data.depenses.filter(d => d.date >= lundi2Str && d.date < lundiPrevStr);
        const total2Sem  = deps2Sem.reduce((s,d) => s + d.montant, 0);
        const deltaPerc  = total2Sem > 0 ? ((totalSemaine - total2Sem) / total2Sem * 100).toFixed(0) : null;

        const peaSorted = [...this.data.suiviPEA].sort((a,b) => b.date.localeCompare(a.date));
        const peaLast   = peaSorted[0];
        const peaPrev   = peaSorted[1];
        const gainPEA   = (peaLast && peaPrev) ? (peaLast.valeur - peaPrev.valeur) : null;

        const objsEnCours = this.data.objectifs.filter(o => (o.actuel / o.cible) < 1 && (o.actuel / o.cible) >= 0.5);

        const items = [];

        if (depsSemaine.length > 0) {
            const delta = deltaPerc !== null ? (parseInt(deltaPerc) > 0 ? `<span style="color:var(--danger)">+${deltaPerc}%</span>` : `<span style="color:var(--success)">${deltaPerc}%</span>`) : '';
            const topCat = {};
            depsSemaine.forEach(d => { topCat[d.categorie] = (topCat[d.categorie]||0) + d.montant; });
            const cats = Object.entries(topCat).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,v])=>`${c} ${this.formatCurrency(v)}`).join(' · ');
            items.push({ icon: '💸', color: 'var(--text-secondary)', title: `Dépenses semaine : ${this.formatCurrency(totalSemaine)} ${delta}`, sub: cats || 'Aucune catégorie' });
        } else {
            items.push({ icon: '✅', color: 'var(--success)', title: 'Aucune dépense la semaine dernière', sub: 'Semaine parfaite !' });
        }

        if (gainPEA !== null) {
            const col = gainPEA >= 0 ? 'var(--success)' : 'var(--danger)';
            items.push({ icon: '📈', color: col, title: `PEA : ${gainPEA >= 0 ? '+' : ''}${this.formatCurrency(gainPEA)} vs entrée précédente`, sub: `Valeur actuelle : ${this.formatCurrency(peaLast.valeur)} · Perf : ${peaLast.performance}%` });
        }

        const budget = Object.values(this.data.budgets).reduce((s,v)=>s+v,0);
        if (budget > 0) {
            const mois = today.toISOString().slice(0,7);
            const depsMois = this.data.depenses.filter(d=>d.date.startsWith(mois)).reduce((s,d)=>s+d.montant,0);
            const ratio = depsMois / budget * 100;
            const col   = ratio > 90 ? 'var(--danger)' : ratio > 70 ? 'var(--warning)' : 'var(--success)';
            items.push({ icon: ratio > 90 ? '⚠️' : '💰', color: col, title: `Budget mensuel : ${depsMois.toFixed(0)}€ / ${budget}€ (${ratio.toFixed(0)}%)`, sub: ratio > 90 ? 'Attention, budget presque épuisé' : 'Dans les clous' });
        }

        objsEnCours.forEach(o => {
            const pct = (o.actuel/o.cible*100).toFixed(0);
            items.push({ icon: o.emoji||'🎯', color: 'var(--accent-primary)', title: `${o.nom} — ${pct}% atteint`, sub: `${this.formatCurrency(o.actuel)} / ${this.formatCurrency(o.cible)}` });
        });

        if (items.length === 0) return;

        const score = totalSemaine < budget/4 ? '🟢' : totalSemaine < budget/2 ? '🟡' : '🔴';
        const titre = totalSemaine === 0 ? 'Aucune dépense cette semaine !' : totalSemaine < budget/4 ? 'Bonne semaine !' : 'Semaine chargée';

        document.getElementById('resume-hebdo-emoji').textContent  = score;
        document.getElementById('resume-hebdo-titre').textContent  = titre;
        document.getElementById('resume-hebdo-periode').textContent = periode;

        const body = document.getElementById('resume-hebdo-body');
        body.innerHTML = items.map(item => `
            <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.65rem .85rem;background:var(--bg-secondary);border-radius:12px;border-left:3px solid ${item.color}">
                <span style="font-size:1.1rem;flex-shrink:0">${item.icon}</span>
                <div><div style="font-size:.85rem;font-weight:600">${item.title}</div><div style="font-size:.72rem;color:var(--text-tertiary);margin-top:.15rem">${item.sub}</div></div>
            </div>`).join('');

        card.style.display = 'block';
    },

    _importRows: [],

    importCSVDrop(e) {
        e.preventDefault();
        document.getElementById('import-drop-zone').style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer?.files[0];
        if (file) this._parseImportCSV(file);
    },

    importCSVFile(e) {
        const file = e.target.files[0];
        if (file) this._parseImportCSV(file);
    },

    _parseImportCSV(file) {

        const self = this;
        const binReader = new FileReader();
        binReader.onload = (ev) => {
            const bytes = new Uint8Array(ev.target.result);
            let text;
            try {

                text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch (e) {

                text = new TextDecoder('iso-8859-1').decode(bytes);
            }
            const ok = self._doParse(text);
            if (!ok) self.notify('Format non reconnu. Vérifie que le fichier est bien un CSV de ta banque.', 'error');
        };
        binReader.readAsArrayBuffer(file);
    },

    _doParse(text) {

        const allLines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length > 2);
        if (allLines.length < 2) return false;

        const sample = allLines.slice(0, 10).join('\n');
        const cnt = (c) => (sample.split(c).length - 1);
        const sepScores = [[';', cnt(';')], [',', cnt(',')], ['\t', cnt('\t')]];
        const sep = sepScores.sort((a,b) => b[1]-a[1])[0][0];

        const splitLine = (l) => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '').trim());

        // ── 3. Trouver l'en-tête ─────────────────────────────────────────────
        let headerIdx = -1, headers = [];
        for (let i = 0; i < Math.min(10, allLines.length); i++) {
            const cols = splitLine(allLines[i]);
            if (cols.length >= 3 && cols.filter(c => c.length > 0).length >= 3) {
                headerIdx = i;
                headers = cols.map(c => c.toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9\s]/g, ' ').trim());
                break;
            }
        }
        if (headerIdx === -1) return false;

        const findCol = (...kws) => {
            for (const kw of kws) {
                const idx = headers.findIndex(h => h.includes(kw));
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const colDate    = headers.findIndex(h => h === 'date' || h === 'dat' || h.startsWith('date ') && !h.includes('valeur') && !h.includes('analyse'));
        const colLibelle = findCol('libelle', 'label', 'description', 'intitule', 'operation', 'wording', 'motif', 'detail', 'tiers');
        const colNote    = findCol('note personnelle', 'note');
        const colDebit   = findCol('debit', 'sortie', 'debit ', 'retrait', 'withdrawal', 'montant debit');
        const colCredit  = findCol('credit', 'entree', 'depot', 'deposit', 'montant credit');
        const colMontant = findCol('montant', 'amount', 'valeur');
        const colSolde   = findCol('solde', 'balance', 'cumul');
        const colCateg   = findCol('categorie', 'category');

        const hasDebitCredit  = colDebit !== -1 && colCredit !== -1;
        const hasMontantUnique = !hasDebitCredit && colMontant !== -1;

        this._importRows = [];

        allLines.slice(headerIdx + 1).forEach(line => {
            if (!line.trim()) return;
            const cols = splitLine(line);
            if (cols.length < 2) return;

            let date = null;
            const dateCandidates = colDate >= 0
                ? [cols[colDate] || '']
                : cols.slice(0, Math.min(4, cols.length));

            for (const s of dateCandidates) {
                const m1 = s.match(/^(\d{2})[./](\d{2})[./](\d{4})/);
                const m2 = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
                const m3 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
                if (m1) { date = m1[3]+'-'+m1[2]+'-'+m1[1]; break; }
                if (m2) { date = m2[1]+'-'+m2[2]+'-'+m2[3]; break; }
                if (m3 && parseInt(m3[2]) <= 12) { date = m3[1]+'-'+m3[2]+'-'+m3[3]; break; }
            }
            if (!date) return;

            let libelle = colLibelle >= 0 ? (cols[colLibelle] || '') : '';
            if (!libelle) {

                libelle = cols.reduce((best, c, i) => {
                    if (i === colSolde || i === colDate) return best;
                    const isText = c.length > 3 && !/^-?[\d\s.,]+$/.test(c);
                    return (isText && c.length > best.length) ? c : best;
                }, '');
            }
            if (!libelle) libelle = 'Transaction';

            const libelleNettoye = this._nettoyerLibelle(libelle);

            let montant = 0, type = 'debit';
            const parseNum = (s) => {
                if (!s || !s.trim() || s.trim() === '-' || s.trim() === '') return NaN;
                let c = s.trim().replace(/\s/g, '');

                if (/^\-?[\d]+\.[\d]{3},[\d]/.test(c)) c = c.replace(/\./g, '').replace(',', '.');

                else if (/^\-?[\d]+,[\d]{3}\.[\d]/.test(c)) c = c.replace(/,/g, '');

                else c = c.replace(',', '.');
                return parseFloat(c);
            };

            if (hasDebitCredit) {
                const d = parseNum(cols[colDebit]  || '');
                const cr = parseNum(cols[colCredit] || '');
                const dVal  = isNaN(d)  ? 0 : Math.abs(d);
                const crVal = isNaN(cr) ? 0 : Math.abs(cr);
                if (dVal > 0)       { montant = dVal;  type = 'debit';  }
                else if (crVal > 0) { montant = crVal; type = 'credit'; }
                else return;
            } else if (hasMontantUnique) {
                const val = parseNum(cols[colMontant] || '');
                if (isNaN(val) || val === 0) return;
                montant = Math.abs(val);
                type    = val < 0 ? 'debit' : 'credit';
            } else {

                const isDateLike = (s) => /^\d{2}[./]\d{2}[./]\d{4}/.test(s) || /^\d{4}[-/]\d{2}[-/]\d{2}/.test(s);
                const candidates = cols.map((c, i) => {
                    if (i === colSolde || isDateLike(c)) return NaN;
                    return parseNum(c);
                }).filter(n => !isNaN(n) && Math.abs(n) >= 0.01 && Math.abs(n) < 99999);
                if (candidates.length === 0) return;
                const sorted = candidates.slice().sort((a,b) => Math.abs(a)-Math.abs(b));
                const val = sorted[0];
                montant = Math.abs(val);
                type    = val < 0 ? 'debit' : 'credit';
            }

            if (montant < 0.01) return;

            const bankCat = colCateg >= 0 ? (cols[colCateg] || '') : '';
            const cat = this._guessCategory(libelle, bankCat);

            this._importRows.push({
                date, montant, libelle, libelleNettoye,
                note: libelleNettoye,
                categorie: cat, type,
                selected: type === 'debit'
            });
        });

        if (this._importRows.length === 0) return false;

        this._importRows.sort((a,b) => b.date.localeCompare(a.date));

        const nd = this._importRows.filter(r=>r.type==='debit').length;
        const nc = this._importRows.filter(r=>r.type==='credit').length;
        this.notify(this._importRows.length + ' transactions trouvées (' + nd + ' débits, ' + nc + ' crédits)', 'info');
        this._renderImportPreview();
        return true;
    },

    _nettoyerLibelle(raw) {
        if (!raw) return '';
        let s = raw;

        s = s.replace(/^(PAIEMENT PSC|PAIEMENT CB|VIR SEPA|VIR INST|VIR C\/C|VIR LIVRET|VIR ALFA|VIR DE |VIR |RETRAIT DAB|VRST REF\w+|F COTIS|F RETRO|AVOIR |PRELEVEMENT |REM CHQ)\s*/i, '');

        s = s.replace(/^\d{4}\s+/, '');

        s = s.replace(/^([A-Z][A-Z\s\-]{2,20})\s+(?=[A-Z])/g, (m, ville) => {

            return ville.length > 12 ? '' : m;
        });

        s = s.replace(/\s+(CARTE\s+[\d\s*]+.*|GI[PR]\d+.*|CG3\w+.*|VG\w+.*|REF\w+.*|TR\s+\w+.*)/i, '');

        s = s.replace(/\s+\d{8,}.*/g, '');
        s = s.replace(/[*]\w+/g, '');

        s = s.replace(/\s{2,}/g, ' ').trim();

        s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

        if (s.length < 3) s = raw.substring(0, 45).trim();
        return s;
    },

    _guessCategory(lib, bankCat) {
        const bc = (bankCat || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const l  = lib.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cats = this.data.budgets ? Object.keys(this.data.budgets) : [];
        const find = (...kws) => cats.find(c => kws.some(k => c.toLowerCase().includes(k))) || null;

        if (/alimentation|grande surface|petit commer|snack|repas au travail/.test(bc)) return find('mang','course','aliment') || 'MANGER';
        if (/loisirs|sport|sortie|restaurant/.test(bc))  return find('loisir') || 'LOISIR';
        if (/culture|passion/.test(bc))                   return find('loisir','culture') || 'LOISIR';
        if (/carburant|vehicule/.test(bc))                return find('carbu','transport') || 'CARBU';
        if (/sante|pharmacie|medecin|optique/.test(bc))   return find('sante') || 'SANTE';
        if (/habillement|shopping|soin/.test(bc))         return find('vetement','habit','shopping') || 'VETEMENT';
        if (/cafe|tabac|jeux/.test(bc))                   return find('bar','cafe','loisir') || 'BAR';
        if (/frais bancaires/.test(bc))                   return find('banque','autre','frais') || (cats[0] || 'AUTRE');

        if (/carrefour|leclerc|lidl|aldi|intermarche|colruyt|casino|monop|thiriet|biocoop|grand frais|intermarch/.test(l)) return find('mang','course') || 'MANGER';
        if (/mcdonald|mcdo|kfc|burger|pizza|subway|kebab|sushi|brasserie|bistro|resto|chez gaston|au p.tit|trane|restaurant|cyrano|san remo|zak food|adas/.test(l)) return find('bar','loisir') || 'BAR';
        if (/netflix|spotify|prime video|disney|apple|google play|xbox|psn|steam|gaming|instant gaming|microsoft|megaport/.test(l)) return find('loisir') || 'LOISIR';
        if (/sncf|ratp|navigo|ter |blabla|total |esso|bp |shell|station|petro|avia |carbu/.test(l)) return find('carbu','transport') || 'CARBU';
        if (/pharmacie|medecin|docteur|hopital|clinique|optic|dentiste/.test(l)) return find('sante') || 'SANTE';
        if (/amazon|fnac|darty|decathlon|zara|h.m|intersport|nike|adidas|klarna|hollister/.test(l)) return find('vetement','habit') || 'VETEMENT';
        if (/loyer|edf|engie|eau |fibre|orange|sfr|bouygues|assurance/.test(l)) return find('loyer','logement') || (cats[0] || 'AUTRE');
        return cats[0] || 'AUTRE';
    },

    _renderImportPreview() {
        const preview = document.getElementById('import-preview');
        const body    = document.getElementById('import-preview-body');
        const title   = document.getElementById('import-preview-title');
        if (!preview || !body) return;

        // Peupler le select compte
        const importCompteSelect = document.getElementById('import-compte-select');
        if (importCompteSelect) {
            const comptes = this.data.comptesPointage || [];
            importCompteSelect.innerHTML = '<option value="">💳 Compte — (optionnel)</option>' +
                comptes.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
        }

        const cats  = this.data.budgets ? Object.keys(this.data.budgets) : ['AUTRE'];
        const total = this._importRows.length;
        const nd    = this._importRows.filter(r=>r.type==='debit').length;
        title.textContent = total + ' transactions trouvées · ' + nd + ' débits pré-cochés · Modifie la note si besoin avant d\'importer';

        body.innerHTML = this._importRows.map((row, i) => {
            const color = row.type === 'debit' ? 'var(--danger)' : 'var(--success)';
            const sign  = row.type === 'debit' ? '-' : '+';
            const badge = row.type === 'debit'
                ? '<span style="background:rgba(244,67,54,.1);color:var(--danger);border-radius:6px;padding:.15rem .4rem;font-size:.62rem;font-family:DM Mono,monospace;font-weight:600">DÉBIT</span>'
                : '<span style="background:rgba(0,200,83,.1);color:var(--success);border-radius:6px;padding:.15rem .4rem;font-size:.62rem;font-family:DM Mono,monospace;font-weight:600">CRÉDIT</span>';
            const rawEsc   = this._esc(row.libelle);
            const noteEsc  = this._esc(row.note);
            const netEsc   = this._esc(row.libelleNettoye);
            const catOpts  = cats.map(c => '<option value="'+c+'" '+(c===row.categorie?'selected':'')+'>'+c+'</option>').join('');
            return '<tr style="'+(row.type==='credit'?'opacity:.6':'')+'">'+
                '<td><input type="checkbox" '+(row.selected?'checked':'')+' onchange="app._importRows['+i+'].selected=this.checked;app._updateImportCount()" style="accent-color:var(--accent-primary)"></td>'+
                '<td style="font-family:DM Mono,monospace;font-size:.75rem;white-space:nowrap">'+row.date+'</td>'+
                '<td style="max-width:200px">'+
                  '<div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+rawEsc+'">'+netEsc+'</div>'+
                  '<div style="font-size:.62rem;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem" title="'+rawEsc+'">'+rawEsc+'</div>'+
                '</td>'+
                '<td><input type="text" value="'+noteEsc+'" oninput="app._importRows['+i+'].note=this.value" style="width:140px;padding:.3rem .5rem;font-size:.75rem;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-family:inherit"></td>'+
                '<td style="font-weight:700;color:'+color+';font-family:DM Mono,monospace;white-space:nowrap">'+sign+this.formatCurrency(row.montant)+'</td>'+
                '<td>'+badge+'</td>'+
                '<td><select data-import-cat style="padding:.25rem .4rem;font-size:.72rem;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary)" onchange="app._importRows['+i+'].categorie=this.value">'+catOpts+'</select></td>'+
                '</tr>';
        }).join('');

        this._updateImportCount();
        preview.style.display = 'block';
    },

    _updateImportCount() {
        const n   = (this._importRows||[]).filter(r=>r.selected).length;
        const btn = document.getElementById('btn-import-valider');
        const lbl = document.getElementById('import-count-label');
        if (btn) btn.textContent = '✅ Importer la sélection (' + n + ')';
        if (lbl) lbl.textContent = n + ' / ' + (this._importRows||[]).length + ' sélectionnées';
    },

    importToggleAll(checked) {
        (this._importRows||[]).forEach(r => r.selected = checked);
        this._renderImportPreview();
    },

    validerImportCSV() {
        const selected = (this._importRows||[]).filter(r => r.selected);
        if (selected.length === 0) { this.notify('Aucune transaction sélectionnée', 'error'); return; }
        const compteId = document.getElementById('import-compte-select')?.value || null;
        let added = 0;
        selected.forEach(row => {
            this.data.depenses.push({
                id: crypto.randomUUID(),
                categorie: row.categorie,
                montant: row.montant,
                date: row.date,
                note: row.note || row.libelleNettoye || row.libelle,
                compteId: compteId || null
            });
            added++;
        });
        this.save();
        this.annulerImportCSV();
        this.refresh();
        this.refreshBilanAnnuel();
        this.notify('✅ ' + added + ' dépenses importées', 'success');
    },

    annulerImportCSV() {
        this._importRows = [];
        const preview = document.getElementById('import-preview');
        if (preview) preview.style.display = 'none';
        const fileInput = document.getElementById('import-csv-file');
        if (fileInput) fileInput.value = '';
        this.closeBsImport();
    },

    notify(msg, type = 'success') {
        // Toast amélioré — remplace l'ancien système .notification
        let toast = document.getElementById('v-toast-singleton');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'v-toast-singleton';
            toast.className = 'v-toast';
            document.body.appendChild(toast);
        }
        clearTimeout(this._toastTimer);
        toast.className = `v-toast ${type}`;
        toast.textContent = msg;
        requestAnimationFrame(() => toast.classList.add('show'));
        this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    },

    /* ══════════════════════════════════════════════════════
       VAULT BUDGET v4 — Nouvelles fonctions
    ══════════════════════════════════════════════════════ */

    _budgetMonth: null, // "YYYY-MM" ou null = mois courant

    _budgetMonthDate() {
        if (this._budgetMonth) {
            const [y, m] = this._budgetMonth.split('-').map(Number);
            return new Date(y, m - 1, 1);
        }
        return new Date();
    },

    _initBudgetMonthLabel() {
        const MONTHS_FR = ['Jan.','Fév.','Mars','Avr.','Mai','Juin','Juil.','Août','Sep.','Oct.','Nov.','Déc.'];
        const now = new Date();
        this._budgetMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const label = MONTHS_FR[now.getMonth()] + ' ' + now.getFullYear();
        const el = document.getElementById('budget-month-label');
        if (el) el.textContent = label;
        const periodEl = document.getElementById('budget-hero-period');
        if (periodEl) periodEl.textContent = label;
    },

    budgetPrevMonth() {
        const d = this._budgetMonthDate();
        d.setMonth(d.getMonth() - 1);
        this._setBudgetMonth(d);
    },

    budgetNextMonth() {
        const d = this._budgetMonthDate();
        d.setMonth(d.getMonth() + 1);
        const now = new Date();
        if (d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) return;
        this._setBudgetMonth(d);
    },

    _setBudgetMonth(d) {
        const MONTHS_FR = ['Jan.','Fév.','Mars','Avr.','Mai','Juin','Juil.','Août','Sep.','Oct.','Nov.','Déc.'];
        this._budgetMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = MONTHS_FR[d.getMonth()] + ' ' + d.getFullYear();
        const labelEl = document.getElementById('budget-month-label');
        if (labelEl) labelEl.textContent = label;
        const periodEl = document.getElementById('budget-hero-period');
        if (periodEl) periodEl.textContent = label;
        const histMois = document.getElementById('hist-filter-mois');
        if (histMois) histMois.value = this._budgetMonth;
        this._refreshBudgetHeroAndCats();
        this.afficherDepenses();
    },

    toggleBudgetDepDropdown() {
        document.getElementById('budget-dep-menu')?.classList.toggle('open');
    },

    toggleBudgetAnalyseMenu() {
        const menu = document.getElementById('budget-an-menu');
        const btn = document.getElementById('budget-an-btn');
        if (!menu || !btn) return;
        const open = menu.classList.toggle('open');
        btn.classList.toggle('open-state', open);
    },

    openBudgetAnalyseModal(type) {
        // Ferme dropdown
        document.getElementById('budget-an-menu')?.classList.remove('open');
        document.getElementById('budget-an-btn')?.classList.remove('open-state');
        // Rafraîchit le contenu selon le type
        if (type === 'comp') this.refreshComparaison();
        if (type === 'regle') this.refreshRegle503020();
        if (type === 'rec') this.refreshRecurrences();
        if (type === 'cashflow') this._refreshBudgetCashflowModal();
        if (type === 'analyse') this._renderBudgetAnCats();
        // Ouvre overlay + modal
        document.getElementById('budget-modal-overlay')?.classList.add('open');
        document.getElementById('modal-budget-' + type)?.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    _refreshBudgetCashflowModal() {
        // Redirige refreshHistoriqueRevenus vers le container de la modal
        const realContainer = document.getElementById('historique-revenus-container');
        const modalContainer = document.getElementById('modal-historique-revenus-container');
        this.refreshHistoriqueRevenus();
        if (realContainer && modalContainer) {
            modalContainer.innerHTML = realContainer.innerHTML;
        }
    },

    openBudgetHistoriqueComplet() {
        const wrap = document.getElementById('budget-hist-complet-wrap');
        if (!wrap) return;
        wrap.classList.add('open');
        document.getElementById('budget-modal-overlay')?.classList.add('open');
        document.body.style.overflow = 'hidden';
        // Initialise le filtre mois sur le mois budget courant
        const histMois = document.getElementById('hist-filter-mois');
        if (histMois && this._budgetMonth) histMois.value = this._budgetMonth;
        // Reset type sur "Tout"
        if (!this._histType) this._histType = 'all';
        ['all','dep','rev'].forEach(t => document.getElementById('hist-type-' + t)?.classList.toggle('active', t === (this._histType || 'all')));
        this.afficherDepenses();
    },

    closeBudgetHistoriqueComplet() {
        document.getElementById('budget-hist-complet-wrap')?.classList.remove('open');
        // Ferme overlay seulement si aucune autre modal ouverte
        const anyOpen = ['modal-budget-comp','modal-budget-regle','modal-budget-rec','modal-budget-cashflow','modal-budget-analyse','pea-panel']
            .some(mid => document.getElementById(mid)?.classList.contains('open'));
        if (!anyOpen) {
            document.getElementById('budget-modal-overlay')?.classList.remove('open');
            document.body.style.overflow = '';
        }
    },

    _refreshBudgetRecentTxs() {
        const container = document.getElementById('budget-recent-txs');
        if (!container) return;
        const d = this._budgetMonthDate();
        const y = d.getFullYear(), m = d.getMonth();
        const deps = (this.data.depenses || [])
            .filter(dep => { const dt = new Date(dep.date); return dt.getFullYear() === y && dt.getMonth() === m; })
            .map(dep => ({ id: dep.id, date: dep.date, label: dep.note || dep.categorie, cat: dep.categorie, montant: -dep.montant, type: 'dep' }));
        const revs = (this.data.revenus || [])
            .filter(rev => { const dt = new Date(rev.date); return dt.getFullYear() === y && dt.getMonth() === m; })
            .map(rev => ({ id: rev.id, date: rev.date, label: rev.source || rev.note || 'Revenu', cat: 'Revenu', montant: rev.montant, type: 'rev' }));
        const all = [...deps, ...revs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
        if (all.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:1.5rem"><div class="empty-state-icon">💸</div><div>Aucune transaction pour ce mois</div></div>';
            return;
        }
        const MONTHS_ABBR = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
        container.innerHTML = all.map(tx => {
            const dt = new Date(tx.date);
            const dateStr = dt.getDate() + ' ' + MONTHS_ABBR[dt.getMonth()];
            const emoji = tx.type === 'rev' ? '💰' : this._getCatEmoji(tx.cat);
            const catName = tx.cat.replace(/^\p{Emoji}\s*/u, '') || tx.cat;
            const amountStr = (tx.montant >= 0 ? '+' : '−') + this.formatCurrency(Math.abs(tx.montant));
            const amountClass = tx.montant >= 0 ? 'budget-tx-amount pos' : 'budget-tx-amount';
            const iconBg = tx.type === 'rev' ? 'rgba(0,200,83,.12)' : 'var(--bg-secondary)';
            const actions = tx.type === 'rev'
                ? `<button class="budget-tx-action-btn" onclick="app.supprimerRevenu('${tx.id}')" title="Supprimer">✕</button>`
                : `<button class="budget-tx-action-btn" onclick="app.modifierNote('depense','${tx.id}')" title="Modifier">✏️</button>
                   <button class="budget-tx-action-btn" onclick="app.supprimerDepense('${tx.id}')" title="Supprimer">✕</button>`;
            return `<div class="budget-tx-card budget-tx-card--actions">
                <div class="budget-tx-icon" style="background:${iconBg}">${emoji}</div>
                <div class="budget-tx-info">
                    <div class="budget-tx-name">${tx.label}</div>
                    <div class="budget-tx-meta">${catName}</div>
                </div>
                <div class="budget-tx-date">${dateStr}</div>
                <div class="${amountClass}">${amountStr}</div>
                <div class="budget-tx-actions">${actions}</div>
            </div>`;
        }).join('');
    },

    closeBudgetAnalyseModal(id) {
        document.getElementById(id)?.classList.remove('open');
        // Ferme overlay si aucune modal ouverte
        const anyOpen = ['modal-budget-comp','modal-budget-regle','modal-budget-rec','modal-budget-cashflow','modal-budget-analyse','budget-hist-complet-wrap']
            .some(mid => document.getElementById(mid)?.classList.contains('open'));
        if (!anyOpen) {
            document.getElementById('budget-modal-overlay')?.classList.remove('open');
            document.body.style.overflow = '';
        }
    },

    _closeBudgetModalOnOutside(e) {
        if (e.target.id !== 'budget-modal-overlay') return;
        // Fix : ignore si le mousedown a commencé à l'intérieur d'une modal ouverte
        if (this._budgetMouseDownInside) return;
        ['modal-budget-comp','modal-budget-regle','modal-budget-rec','modal-budget-cashflow','modal-budget-analyse','budget-hist-complet-wrap','modal-all-cats','modal-emoji-cat'].forEach(id => {
            document.getElementById(id)?.classList.remove('open');
        });
        document.getElementById('budget-modal-overlay')?.classList.remove('open');
        document.body.style.overflow = '';
    },

    _refreshBudgetHeroAndCats() {
        const d = this._budgetMonthDate();
        const y = d.getFullYear(), m = d.getMonth();
        const exclus = this.data.categoriesEpargne || ['ÉPARGNE'];
        const depMois = this.data.depenses.filter(dep => {
            const dt = new Date(dep.date);
            return dt.getFullYear() === y && dt.getMonth() === m;
        });
        const totalDep = depMois
            .filter(dep => !exclus.some(e => dep.categorie.toUpperCase().includes(e.toUpperCase())))
            .reduce((s, dep) => s + dep.montant, 0);
        const budgetTotal = Object.entries(this.data.budgets)
            .filter(([cat]) => !exclus.some(e => cat.toUpperCase().includes(e.toUpperCase())))
            .reduce((s, [, v]) => s + v, 0);
        const restant = budgetTotal - totalDep;
        const pct = budgetTotal > 0 ? Math.min((totalDep / budgetTotal) * 100, 100) : 0;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;
        const daysLeft = isCurrentMonth ? daysInMonth - today.getDate() + 1 : 0;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('budget-hero-amount', this.formatCurrency(totalDep));
        set('budget-hero-badge', Math.round(pct) + '% utilisé');
        set('budget-hero-restant', this.formatCurrency(restant) + ' restants');
        set('budget-hero-total-label', this.formatCurrency(budgetTotal));
        set('budget-hero-total-label2', this.formatCurrency(budgetTotal));
        if (daysLeft > 0) set('budget-hero-days', daysLeft + ' jour' + (daysLeft > 1 ? 's' : '') + ' restants');
        else set('budget-hero-days', '');
        const sub = document.getElementById('budget-hero-sub');
        if (sub) sub.innerHTML = 'sur <span id="budget-hero-total-label">' + this.formatCurrency(budgetTotal) + '</span> de budget mensuel · <strong id="budget-hero-restant" style="color:rgba(255,255,255,.9)">' + this.formatCurrency(restant) + ' restants</strong>';
        const progEl = document.getElementById('budget-hero-prog');
        if (progEl) {
            progEl.style.width = pct + '%';
        }
        this._refreshBudgetTopCats(depMois);
        this._refreshBudgetRecentTxs();
    },

    _refreshBudgetTopCats(depMois) {
        const container = document.getElementById('budget-top-cats');
        if (!container) return;
        if (!depMois) {
            const d = this._budgetMonthDate();
            depMois = this.data.depenses.filter(dep => {
                const dt = new Date(dep.date);
                return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
            });
        }
        const bycat = {};
        depMois.forEach(dep => {
            if (!bycat[dep.categorie]) bycat[dep.categorie] = 0;
            bycat[dep.categorie] += dep.montant;
        });
        const allCats = new Set([...Object.keys(this.data.budgets), ...Object.keys(bycat)]);
        const catData = Array.from(allCats)
            .map(cat => ({ cat, spent: bycat[cat] || 0, budget: this.data.budgets[cat] || 0 }))
            .filter(c => c.cat in this.data.budgets || c.spent > 0)
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 8);
        if (catData.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:1.5rem"><div class="empty-state-icon">📂</div><div>Aucune catégorie active pour ce mois</div></div>';
            return;
        }
        const getBar = pct => pct >= 100 ? 'linear-gradient(90deg,#f44336,#e57373)' : pct >= 80 ? 'linear-gradient(90deg,#ff9800,#ffb74d)' : 'linear-gradient(90deg,var(--accent-gradient-start),var(--accent-gradient-end))';
        const getBadge = pct => pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
        container.innerHTML = catData.map(({ cat, spent, budget }) => {
            const pct = budget > 0 ? Math.round(spent / budget * 100) : (spent > 0 ? 100 : 0);
            const fillPct = budget > 0 ? Math.min(spent / budget * 100, 100) : (spent > 0 ? 100 : 0);
            const emoji = this._getCatEmoji(cat);
            const catName = cat.replace(/^\p{Emoji}\s*/u, '') || cat;
            return `<div class="budget-cat-card">
                <div class="budget-cat-top">
                    <div class="budget-cat-left">
                        <div class="budget-cat-icon">${emoji}</div>
                        <div><div class="budget-cat-name">${catName}</div><div class="budget-cat-amounts">${this.formatCurrency(spent)} / ${this.formatCurrency(budget)}</div></div>
                    </div>
                    <span class="cat-pct-badge ${getBadge(pct)}">${pct}%</span>
                </div>
                <div class="budget-cat-progress"><div class="budget-cat-progress-fill" style="width:${fillPct}%;background:${getBar(pct)}"></div></div>
            </div>`;
        }).join('');
    },

    /* Analyse détaillée — catégories dépliables */
    _budgetAnalysePeriodeChange() {
        const val = document.getElementById('budget-an-periode')?.value;
        const moisWrap  = document.getElementById('budget-an-periode-mois-wrap');
        const anneeWrap = document.getElementById('budget-an-periode-annee-wrap');
        const plageWrap = document.getElementById('budget-an-periode-plage-wrap');
        if (moisWrap)  moisWrap.style.display  = val === 'mois-choisi'   ? 'block' : 'none';
        if (anneeWrap) anneeWrap.style.display  = val === 'annee-choisie' ? 'block' : 'none';
        if (plageWrap) plageWrap.style.display  = val === 'plage'         ? 'grid'  : 'none';

        // Peupler le select des années
        if (val === 'annee-choisie') {
            const sel = document.getElementById('budget-an-annee');
            if (sel && sel.options.length === 0) {
                const years = [...new Set(this.data.depenses.map(d => new Date(d.date).getFullYear()))].sort().reverse();
                const now = new Date().getFullYear();
                if (!years.includes(now)) years.unshift(now);
                sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
            }
        }
        // Dates par défaut pour la plage
        if (val === 'plage') {
            const debutEl = document.getElementById('budget-an-debut');
            const finEl   = document.getElementById('budget-an-fin');
            const now = new Date();
            if (finEl   && !finEl.value)   finEl.value   = now.toISOString().slice(0,10);
            if (debutEl && !debutEl.value) {
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                debutEl.value = firstDay.toISOString().slice(0,10);
            }
        }
        this._renderBudgetAnCats();
    },

    _renderBudgetAnCats() {
        const container = document.getElementById('budget-an-cats-list');
        if (!container) return;
        const periodeEl = document.getElementById('budget-an-periode');
        const periode = periodeEl ? periodeEl.value : 'mois';
        const now = new Date();
        let depsFiltrees = this.data.depenses;

        if (periode === 'mois') {
            depsFiltrees = depsFiltrees.filter(d => {
                const dt = new Date(d.date);
                return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
            });
        } else if (periode === 'mois-choisi') {
            const moisVal = document.getElementById('budget-an-mois')?.value;
            if (moisVal) {
                const [y, m] = moisVal.split('-').map(Number);
                depsFiltrees = depsFiltrees.filter(d => {
                    const dt = new Date(d.date);
                    return dt.getFullYear() === y && dt.getMonth() === m - 1;
                });
            }
        } else if (periode === 'annee') {
            depsFiltrees = depsFiltrees.filter(d => new Date(d.date).getFullYear() === now.getFullYear());
        } else if (periode === 'annee-choisie') {
            const anneeVal = parseInt(document.getElementById('budget-an-annee')?.value);
            if (anneeVal) {
                depsFiltrees = depsFiltrees.filter(d => new Date(d.date).getFullYear() === anneeVal);
            }
        } else if (periode === 'plage') {
            const debut = document.getElementById('budget-an-debut')?.value;
            const fin   = document.getElementById('budget-an-fin')?.value;
            if (debut) depsFiltrees = depsFiltrees.filter(d => d.date >= debut);
            if (fin)   depsFiltrees = depsFiltrees.filter(d => d.date <= fin);
        }

        const totalAll = depsFiltrees.reduce((s, d) => s + d.montant, 0);
        const nbTx = depsFiltrees.length;

        // Calcul de la métrique 3e stat : moy/jour pour mois unique, moy/mois sinon
        let avgValue = 0;
        let avgLabel = 'Moy. / jour';
        const isMultiMonth = ['annee','annee-choisie','plage'].includes(periode);

        if (isMultiMonth) {
            avgLabel = 'Moy. / mois';
            if (depsFiltrees.length > 0) {
                // Nombre de mois distincts dans la sélection
                const moisDistincts = new Set(depsFiltrees.map(d => d.date.slice(0,7))).size;
                avgValue = moisDistincts > 0 ? totalAll / moisDistincts : 0;
            }
        } else {
            // Mois unique → moy/jour comme avant
            let daysInPeriod = 1;
            if (periode === 'mois') {
                daysInPeriod = now.getDate();
            } else if (periode === 'mois-choisi') {
                const moisVal = document.getElementById('budget-an-mois')?.value;
                if (moisVal) {
                    const [y, m] = moisVal.split('-').map(Number);
                    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;
                    daysInPeriod = isCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate();
                }
            }
            avgValue = daysInPeriod > 0 ? totalAll / daysInPeriod : 0;
        }

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('budget-an-total', this.formatCurrency(totalAll));
        set('budget-an-count', nbTx);
        set('budget-an-avg',   this.formatCurrency(avgValue));
        set('budget-an-avg-label', avgLabel);

        const bycat = {};
        depsFiltrees.forEach(d => {
            if (!bycat[d.categorie]) bycat[d.categorie] = { txs: [], total: 0 };
            bycat[d.categorie].txs.push(d);
            bycat[d.categorie].total += d.montant;
        });
        const cats = Object.entries(bycat).sort((a, b) => b[1].total - a[1].total);
        if (cats.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><div>Aucune dépense pour cette période</div></div>';
            return;
        }
        const BAR_COLORS = ['linear-gradient(90deg,#f44336,#e57373)','linear-gradient(90deg,#ff9800,#ffb74d)','linear-gradient(90deg,#ff9800,#ffd54f)','linear-gradient(90deg,#00c853,#69f0ae)','linear-gradient(90deg,#3f51b5,#7c4dff)','linear-gradient(90deg,#5c6bc0,#9fa8da)','linear-gradient(90deg,#7c4dff,#b259ff)','linear-gradient(90deg,#e91e63,#f48fb1)'];
        container.innerHTML = cats.map(([cat, data], i) => {
            const pct = totalAll > 0 ? Math.round(data.total / totalAll * 100) : 0;
            const barColor = BAR_COLORS[i % BAR_COLORS.length];
            const emoji = this._getCatEmoji(cat);
            const catName = cat.replace(/^\p{Emoji}\s*/u, '') || cat;
            const txsHtml = data.txs
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(t => {
                    const dt = new Date(t.date);
                    const MONTHS_ABBR = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
                    return `<div class="an-tx-row">
                        <span class="an-tx-date">${dt.getDate()} ${MONTHS_ABBR[dt.getMonth()]}${isMultiMonth ? ' ' + dt.getFullYear() : ''}</span>
                        <span class="an-tx-note">${t.note || '—'}</span>
                        <span class="an-tx-amount">−${this.formatCurrency(t.montant)}</span>
                    </div>`;
                }).join('');
            return `<div class="an-cat-block" id="an-cat-block-${i}">
                <div class="an-cat-header" onclick="app._toggleBudgetAnCat(${i})">
                    <div class="an-cat-emoji" style="background:var(--bg-secondary)">${emoji}</div>
                    <div class="an-cat-label">
                        <div class="an-cat-name">${catName}</div>
                        <div class="an-cat-bar-row">
                            <div class="an-cat-bar-bg"><div class="an-cat-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
                            <span class="an-cat-pct">${pct}%</span>
                        </div>
                    </div>
                    <div class="an-cat-right">
                        <span class="an-cat-amount">${this.formatCurrency(data.total)}</span>
                        <span class="an-cat-count">${data.txs.length} transaction${data.txs.length > 1 ? 's' : ''}</span>
                    </div>
                    <span class="an-cat-chevron">›</span>
                </div>
                <div class="an-cat-txs">${txsHtml}</div>
            </div>`;
        }).join('');
    },

    _toggleBudgetAnCat(i) {
        const block = document.getElementById('an-cat-block-' + i);
        if (!block) return;
        const wasOpen = block.classList.contains('expanded');
        document.querySelectorAll('.an-cat-block').forEach(b => b.classList.remove('expanded'));
        if (!wasOpen) block.classList.add('expanded');
    }

};

document.addEventListener('DOMContentLoaded', () => {
    app.init().then(() => {
        try {
            const last = localStorage.getItem('lastTab');
            if (last && last !== 'dashboard') app.switchTab(last);
        } catch(e) {}
    });

    // Alerte si hors ligne avec modifications non syncées, OU si le dernier sync a échoué
    window.addEventListener('beforeunload', (e) => {
        const hasUnsyncedChanges = app._lastChange && !app._lastSyncOk;
        if (hasUnsyncedChanges) {
            e.preventDefault();
            const msg = navigator.onLine
                ? 'La synchronisation a échoué — vos modifications ne sont pas enregistrées sur le cloud.'
                : 'Vous êtes hors ligne — vos modifications ne sont pas encore enregistrées sur le cloud.';
            e.returnValue = msg;
            return msg;
        }
    });
});
