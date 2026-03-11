document.addEventListener('DOMContentLoaded', () => {
    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registrato con successo:', reg.scope))
                .catch(err => console.log('Errore registrazione Service Worker:', err));
        });
    }

    let deferredPrompt;
    const pwaInstallBtn = document.getElementById('pwa-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('Evento beforeinstallprompt intercettato! L\'app è installabile.');
        // Impedisci la visualizzazione automatica del prompt
        e.preventDefault();
        // Salva l'evento per usarlo dopo
        deferredPrompt = e;
        // Mostra il pulsante di installazione
        if (pwaInstallBtn) {
            pwaInstallBtn.classList.remove('hidden');
        }
    });

    if (pwaInstallBtn) {
        pwaInstallBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!deferredPrompt) {
                alert("L'app non è ancora pronta per essere scaricata. Assicurati di:\n1. Usare un browser supportato (Chrome/Edge).\n2. Non essere in modalità Incognito.\n3. Aprire il sito tramite un server (es. Live Server) e non come file locale.");
                return;
            }
            // Mostra il prompt di installazione
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Risultato installazione: ${outcome}`);
            deferredPrompt = null;
            pwaInstallBtn.classList.add('hidden');
        });
    }

    // Diagnostic console message
    console.log('PWA Setup: Service Worker e Manifest configurati. In attesa di "beforeinstallprompt"...');
    if (!('serviceWorker' in navigator)) {
        console.warn('Attenzione: Il tuo browser non supporta i Service Worker. La PWA non funzionerà.');
    }
    if (window.location.protocol === 'file:') {
        console.warn('Attenzione: Le PWA non funzionano se aperte come file locale (file://). Usa un server locale.');
    }

    // --- Supabase Config ---
    const SUPABASE_URL = "https://hkcsuledqzpzqlawygsg.supabase.co";
    const SUPABASE_KEY = "sb_publishable_QCxJNslnjEIcNncc9jTDpA_YP0O56dT";
    const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

    // --- Auth State ---
    const authScreen = document.getElementById('auth-screen');
    const appContainer = document.querySelector('.app-container');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authError = document.getElementById('auth-error');
    const currentUserNameDisplay = document.getElementById('current-user-name');



    let currentUser = JSON.parse(localStorage.getItem('financeCurrentUser')) || null;

    // --- Elements ---
    // Inputs
    const incomeInput = document.getElementById('income');
    const rentInput = document.getElementById('rent');
    const billsInput = document.getElementById('bills');
    const autoInput = document.getElementById('auto');
    const foodInput = document.getElementById('food');
    const subsInput = document.getElementById('subs');
    const leisureInput = document.getElementById('leisure');
    const shoppingInput = document.getElementById('shopping');
    const extraInput = document.getElementById('extra');


    // Summary
    const summarySection = document.getElementById('summary-section');
    const summaryIncome = document.getElementById('summary-income');
    const summaryExpenses = document.getElementById('summary-expenses');
    const summaryRemaining = document.getElementById('summary-remaining');
    const adviceList = document.getElementById('advice-list');



    // Formatter per valuta
    const currency = new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    });

    function recalculateSummary() {
        const income = parseFloat(incomeInput.value) || 0;

        // Calcolo totale spese
        const rent = parseFloat(rentInput.value) || 0;
        const bills = parseFloat(billsInput.value) || 0;
        const auto = parseFloat(autoInput.value) || 0;
        const food = parseFloat(foodInput.value) || 0;
        const subs = parseFloat(subsInput.value) || 0;
        const leisure = parseFloat(leisureInput.value) || 0;
        const shopping = parseFloat(shoppingInput.value) || 0;
        const extra = parseFloat(extraInput.value) || 0;

        // Deductions for Saving Goals
        const goals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals')) || '[]');
        const totalGoalDeposits = goals.reduce((sum, goal) => {
            return !goal.isCompleted ? sum + (parseFloat(goal.deposit) || 0) : sum;
        }, 0);

        const totalExpenses = rent + bills + auto + food + subs + leisure + shopping + extra;
        const remaining = income - totalExpenses - totalGoalDeposits;

        // Mostra risultati
        summaryIncome.textContent = currency.format(income);
        summaryExpenses.textContent = currency.format(totalExpenses);
        summaryRemaining.textContent = currency.format(remaining);

        // Aggiorna colore rimanenza in base al valore
        summaryRemaining.className = 'value'; // reseta classe
        if (remaining > 0) {
            summaryRemaining.classList.add('success');
        } else if (remaining < 0) {
            summaryRemaining.classList.add('danger');
        } else {
            summaryRemaining.classList.add('primary');
        }

        // Genera suggerimenti
        generateAdvice(income, rent, bills, auto, food, totalExpenses, remaining);

        // Mostra la sezione
        if (summarySection) summarySection.classList.remove('hidden');
    }



    function generateAdvice(income, rent, bills, auto, food, totalExpenses, remaining) {
        adviceList.innerHTML = ''; // Svuota lista

        const advices = [];

        if (income === 0) {
            advices.push("Inserisci il tuo reddito per ricevere consigli personalizzati.");
            renderAdvices(advices);
            return;
        }

        if (remaining < 0) {
            advices.push("<strong>Attenzione:</strong> Le tue spese superano le entrate. Rivedi immediatamente le spese non essenziali.");
        }

        // Regola 50/30/20 approssimata per fisse
        const fixedPercentage = (totalExpenses / income) * 100;
        if (fixedPercentage > 60) {
            advices.push(`Le tue spese fisse assorbono il <strong>${fixedPercentage.toFixed(1)}%</strong> del tuo reddito (si consiglia max 50%). Prova a rinegoziare bollette o affitto.`);
        }

        // Controllo Affitto
        if ((rent / income) > 0.35) {
            advices.push("L'affitto/mutuo supera il 35% del tuo stipendio. Potrebbe incidere sui tuoi risparmi a lungo termine.");
        }

        // Controllo Auto
        if ((auto / income) > 0.15) {
            advices.push("Spendi molto in trasporti. Valuta il car sharing, abbonamenti pubblici o usa l'auto solo quando strettamente necessario.");
        }

        // Suggerimento Risparmio se in positivo
        if (remaining > 0) {
            let suggestSave = remaining * 0.5; // Suggerisci di salvare metà della rimanenza
            advices.push(`Ti rimangono ${currency.format(remaining)}. Prova a mettere da parte <strong>${currency.format(suggestSave)}</strong> questo mese in un fondo di emergenza.`);
        }

        if (advices.length === 0) {
            advices.push("Le tue finanze sembrano bilanciate. Ottimo lavoro!");
        }

        renderAdvices(advices);
    }

    function renderAdvices(advices) {
        advices.forEach(advice => {
            const li = document.createElement('li');
            li.innerHTML = advice;
            adviceList.appendChild(li);
        });
    }

    // --- Calendar Logic ---
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-days-grid');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // --- Event Modals Elements ---
    const dayDetailsModal = document.getElementById('day-details-modal');
    const closeDetailsModalBtn = document.getElementById('close-details-modal');
    const dayDetailsTitle = document.getElementById('day-details-title');
    const dayEventsList = document.getElementById('day-events-list');
    const openAddEventBtn = document.getElementById('open-add-event-btn');
    const deleteAllEventsBtn = document.getElementById('delete-all-events-btn');

    const eventModal = document.getElementById('event-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveEventBtn = document.getElementById('save-event-btn');
    const eventCategoryInput = document.getElementById('event-category');
    const eventAmountInput = document.getElementById('event-amount');

    let currentDate = new Date();
    let selectedDateInfo = null;

    // Carica budget mensili o array vuoto
    const getStorageKey = (key) => currentUser ? `${currentUser.username}_${key}` : null;

    let monthlyBudgets = {};
    let events = {};

    async function loadUserData() {
        if (!currentUser) return;

        // 1. Carica prima i dati dal LocalStorage (base locale)
        const localBudgets = JSON.parse(localStorage.getItem(getStorageKey('financeMonthlyBudgets'))) || {};
        const localEvents = JSON.parse(localStorage.getItem(getStorageKey('financeEvents'))) || {};
        const localGoals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals'))) || [];

        // Inizializza lo stato con i dati locali per non perdere nulla in caso di errore
        monthlyBudgets = localBudgets;
        events = localEvents;

        if (supabase && currentUser.id) {
            console.log("Tentativo di caricamento dati da Supabase per:", currentUser.username);

            const { data, error } = await supabase
                .from('user_data')
                .select('key, value')
                .eq('user_id', currentUser.id);

            if (error) {
                console.error("Errore caricamento Supabase:", error.message);
                // In caso di errore, manteniamo i dati locali già caricati
            } else if (data && data.length > 0) {
                console.log("Dati ricevuti da Supabase:", data);
                let foundBudgets = false;
                let foundEvents = false;
                let foundGoals = false;

                data.forEach(item => {
                    if (item.key === 'budgets') {
                        monthlyBudgets = item.value;
                        localStorage.setItem(getStorageKey('financeMonthlyBudgets'), JSON.stringify(monthlyBudgets));
                        foundBudgets = true;
                    }
                    if (item.key === 'events') {
                        events = item.value;
                        localStorage.setItem(getStorageKey('financeEvents'), JSON.stringify(events));
                        foundEvents = true;
                    }
                    if (item.key === 'goals') {
                        localStorage.setItem(getStorageKey('financeGoals'), JSON.stringify(item.value));
                        foundGoals = true;
                    }
                });

                // Se Supabase ha alcuni dati ma non altri, sincronizziamo quelli mancanti da locale a remoto?
                // Per ora, se Supabase ha ALMENO una chiave, consideriamo Supabase la fonte di verità.
                // Se invece Supabase è completamente vuoto per questo utente (length > 0 sopra ma magari chiavi diverse),
                // o se mancano chiavi specifiche che abbiamo in locale, facciamo l'upload.
                if (!foundBudgets && Object.keys(localBudgets).length > 0) syncData('budgets', localBudgets);
                if (!foundEvents && Object.keys(localEvents).length > 0) syncData('events', localEvents);
                if (!foundGoals && localGoals.length > 0) syncData('goals', localGoals);

            } else {
                console.log("Nessun dato trovato su Supabase. Sincronizzazione dati locali iniziali...");
                // Se Supabase è vuoto, facciamo il primo upload dei dati locali
                if (Object.keys(localBudgets).length > 0) syncData('budgets', localBudgets);
                if (Object.keys(localEvents).length > 0) syncData('events', localEvents);
                if (localGoals.length > 0) syncData('goals', localGoals);
            }
        }
    }

    async function syncData(key, value) {
        if (!supabase || !currentUser || !currentUser.id) return;

        const { error } = await supabase
            .from('user_data')
            .upsert({
                user_id: currentUser.id,
                key: key,
                value: value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,key' });

        if (error) console.error(`Error syncing ${key}:`, error.message);
    }

    // --- Auth Logic ---
    function showAuthError(msg) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
    }

    function toggleAuthForms(showSignup) {
        authError.classList.add('hidden');
        if (showSignup) {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        } else {
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
        }
    }

    async function handleSignup() {
        const emailInput = document.getElementById('signup-email');
        const emailValue = emailInput ? emailInput.value.trim() : '';
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value.trim();

        if (!username || !password || (emailInput && !emailValue)) {
            showAuthError("Inserisci tutti i campi.");
            return;
        }

        if (supabase) {
            const { data, error } = await supabase.auth.signUp({
                email: emailValue,
                password: password,
                options: {
                    data: {
                        username: username,
                        real_email: emailValue
                    }
                }
            });

            if (error) {
                console.error("Signup Error:", error);
                showAuthError("Errore registrazione: " + (error.message || "Errore sconosciuto"));
            } else {
                console.log("Signup Success:", data);
                alert("Registrazione completata! Se hai disattivato 'Confirm Email' nelle impostazioni di Supabase, ora puoi accedere.");
                toggleAuthForms(false);
            }
        } else {
            // Fallback locale se supabase non è pronto
            let users = JSON.parse(localStorage.getItem('financeUsers')) || [];
            if (users.find(u => u.username === username)) {
                showAuthError("Username già esistente.");
                return;
            }
            users.push({ username, password, email: emailValue });
            localStorage.setItem('financeUsers', JSON.stringify(users));
            doLogin(username, null, emailValue);
        }
    }

    async function handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!email || !password) {
            showAuthError("Inserisci tutti i campi.");
            return;
        }

        if (supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                showAuthError("Credenziali errate o errore: " + error.message);
            } else {
                // Prendi lo username dai metadata se possibile
                const user = data.user;
                const finalUsername = user.user_metadata.username || email.split('@')[0];
                doLogin(finalUsername, user.id, email);
            }
        } else {
            let users = JSON.parse(localStorage.getItem('financeUsers')) || [];
            const user = users.find(u => u.email === email && u.password === password);
            if (user) {
                doLogin(user.username, null, email);
            } else {
                showAuthError("Email o password errati.");
            }
        }
    }

    function doLogin(username, userId = null, email = null) {
        currentUser = { username, id: userId, email };
        localStorage.setItem('financeCurrentUser', JSON.stringify(currentUser));
        localStorage.setItem('financeLastUser', username);

        let loggedUsers = JSON.parse(localStorage.getItem('financeLoggedUsers')) || [];
        if (!loggedUsers.find(u => u.username === username)) {
            loggedUsers.push(currentUser);
            localStorage.setItem('financeLoggedUsers', JSON.stringify(loggedUsers));
        }

        checkAuthStatus();
    }

    function handleLogout() {
        if (currentUser) {
            let loggedUsers = JSON.parse(localStorage.getItem('financeLoggedUsers')) || [];
            loggedUsers = loggedUsers.filter(u => u.username !== currentUser.username);
            localStorage.setItem('financeLoggedUsers', JSON.stringify(loggedUsers));

            if (loggedUsers.length > 0) {
                currentUser = loggedUsers[0];
                localStorage.setItem('financeCurrentUser', JSON.stringify(currentUser));
                localStorage.setItem('financeLastUser', currentUser.username);
            } else {
                localStorage.removeItem('financeCurrentUser');
            }
        } else {
            localStorage.removeItem('financeCurrentUser');
        }
        location.reload();
    }

    async function checkAuthStatus() {
        document.querySelectorAll('.cancel-auth-container').forEach(el => el.classList.add('hidden'));
        if (currentUser) {
            authScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            currentUserNameDisplay.textContent = currentUser.username;
            updateLoggedUsersList();
            await loadUserData(); // Attendi il caricamento da Supabase
            loadCurrentMonthBudget();
            loadGoals();
            renderCalendar();
            initializeLastValues();
        } else {
            authScreen.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    }

    function updateLoggedUsersList() {
        const listContainer = document.getElementById('logged-users-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        let loggedUsers = JSON.parse(localStorage.getItem('financeLoggedUsers')) || [];

        loggedUsers.forEach(user => {
            const isCurrent = currentUser && currentUser.username === user.username;
            const userBtn = document.createElement('button');
            userBtn.className = 'dropdown-item';
            userBtn.style.display = 'flex';
            userBtn.style.alignItems = 'center';
            userBtn.style.gap = '8px';
            userBtn.innerHTML = `<i class="fa-solid fa-circle-user"></i> <span style="flex-grow: 1; text-align: left;">${user.username}</span> ${isCurrent ? '<i class="fa-solid fa-check" style="color: var(--success); font-size: 0.9em;"></i>' : ''}`;

            if (!isCurrent) {
                userBtn.addEventListener('click', () => {
                    doLogin(user.username, user.id);
                    location.reload();
                });
            } else {
                userBtn.style.cursor = 'default';
                userBtn.style.opacity = '0.9';
                userBtn.style.background = 'rgba(255, 255, 255, 0.05)';
            }
            listContainer.appendChild(userBtn);
        });
    }

    // --- Auth Listeners ---
    if (showSignupLink) showSignupLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });
    if (signupBtn) signupBtn.addEventListener('click', handleSignup);
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    // NEW: User Menu & Dropdown logic
    const userMenuToggle = document.getElementById('user-menu-toggle');
    const userDropdown = document.getElementById('user-dropdown');
    const logoutBtnDropdown = document.getElementById('logout-btn-dropdown');
    const addAccountBtnDropdown = document.getElementById('add-account-btn-dropdown');

    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (userDropdown) userDropdown.classList.add('hidden');
    });

    if (logoutBtnDropdown) {
        logoutBtnDropdown.addEventListener('click', handleLogout);
    }

    if (addAccountBtnDropdown) {
        addAccountBtnDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.add('hidden');
            appContainer.classList.add('hidden');
            authScreen.classList.remove('hidden');
            document.querySelectorAll('.cancel-auth-container').forEach(el => el.classList.remove('hidden'));

            // Clear current inputs and state to prevent residual data from being seen or saved
            allBudgetInputs.forEach(input => { if (input) input.value = ''; });
            monthlyBudgets = {};
            events = {};
            lastInputValues = {};

            toggleAuthForms(false);
        });
    }

    // --- Settings UI Interactions ---
    const settingsBtnDropdown = document.getElementById('settings-btn-dropdown');

    if (settingsBtnDropdown) {
        settingsBtnDropdown.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (userDropdown) userDropdown.classList.add('hidden');

            // Navigate to settings tab via the hidden nav button
            const settingsTabNavBtn = document.querySelector('.nav-btn[data-tab="tab-settings"]');
            if (settingsTabNavBtn) settingsTabNavBtn.click();

            // Populate data
            const settingsUsernameInput = document.getElementById('settings-username');
            const settingsEmailInput = document.getElementById('settings-email');

            if (settingsUsernameInput && currentUser) {
                settingsUsernameInput.value = currentUser.username || '';
            }

            if (settingsEmailInput && currentUser) {
                if (currentUser.email) {
                    settingsEmailInput.value = currentUser.email;
                } else {
                    // local fallback
                    let users = JSON.parse(localStorage.getItem('financeUsers')) || [];
                    const localUser = users.find(u => u.username === currentUser.username);
                    settingsEmailInput.value = localUser ? (localUser.email || '') : '';

                    // try fetch from supabase session
                    if (supabase) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user && user.email) {
                            settingsEmailInput.value = user.email;
                        } else if (user && user.user_metadata && user.user_metadata.real_email) {
                            settingsEmailInput.value = user.user_metadata.real_email;
                        }
                    }
                }
            }
        });
    }

    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const newUsername = document.getElementById('settings-username').value.trim();
            const settingsMsg = document.getElementById('settings-message');

            if (!newUsername) {
                settingsMsg.textContent = "L'username non può essere vuoto.";
                settingsMsg.style.color = "var(--danger)";
                return;
            }
            if (newUsername === currentUser.username) {
                settingsMsg.textContent = "L'username è uguale a quello attuale.";
                settingsMsg.style.color = "var(--warning)";
                return;
            }

            // 1. Check LocalStorage `financeUsers` to avoid duplicates
            let users = JSON.parse(localStorage.getItem('financeUsers')) || [];
            if (users.find(u => u.username === newUsername)) {
                settingsMsg.textContent = "Questo username è già in uso.";
                settingsMsg.style.color = "var(--danger)";
                return;
            }

            const localUserIdx = users.findIndex(u => u.username === currentUser.username);
            if (localUserIdx >= 0) {
                users[localUserIdx].username = newUsername;
                localStorage.setItem('financeUsers', JSON.stringify(users));
            }

            // 2. Update Supabase if active
            if (supabase) {
                const { data, error } = await supabase.auth.updateUser({
                    data: { username: newUsername }
                });
                if (error) {
                    console.error("Errore aggiornamento username su Supabase:", error);
                }
            }

            // Update reference in logged users
            let loggedUsers = JSON.parse(localStorage.getItem('financeLoggedUsers')) || [];
            const lUserIdx = loggedUsers.findIndex(u => u.username === currentUser.username);
            if (lUserIdx >= 0) {
                loggedUsers[lUserIdx].username = newUsername;
                localStorage.setItem('financeLoggedUsers', JSON.stringify(loggedUsers));
            }

            // Migrate keys for data (they use username prefixes!)
            const oldPrefix = currentUser.username + '_';
            const newPrefix = newUsername + '_';

            const keysToMigrate = ['financeMonthlyBudgets', 'financeEvents', 'financeGoals'];
            keysToMigrate.forEach(k => {
                const oldData = localStorage.getItem(oldPrefix + k);
                if (oldData) {
                    localStorage.setItem(newPrefix + k, oldData);
                    localStorage.removeItem(oldPrefix + k);
                }
            });

            // Update current user state
            currentUser.username = newUsername;
            localStorage.setItem('financeCurrentUser', JSON.stringify(currentUser));
            localStorage.setItem('financeLastUser', newUsername);

            settingsMsg.textContent = "Username aggiornato con successo!";
            settingsMsg.style.color = "var(--success)";

            // Wait slightly and refresh
            setTimeout(() => {
                location.reload();
            }, 1000);
        });
    }

    document.querySelectorAll('.cancel-auth-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentUser) {
                checkAuthStatus();
            }
        });
    });

    // NEW: Theme Switching logic
    const themeBtns = document.querySelectorAll('.theme-btn');

    function setTheme(themeName) {
        if (themeName === 'black') {
            document.body.classList.add('theme-black');
        } else {
            document.body.classList.remove('theme-black');
        }

        // Update ALL theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.getAttribute('data-theme') === themeName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Persist theme
        localStorage.setItem('financeTheme', themeName);
    }

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = btn.getAttribute('data-theme');
            setTheme(theme);
        });
    });

    // --- Saving Goals Logic ---
    const addGoalBtn = document.getElementById('add-goal-btn');
    const goalNameInput = document.getElementById('goal-name');
    const goalAmountInput = document.getElementById('goal-amount');
    const goalMonthsInput = document.getElementById('goal-months');
    const goalsContainer = document.getElementById('active-goals-grid');

    function loadGoals() {
        if (!currentUser) return;
        const goals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals')) || '[]');
        renderGoals(goals);
    }

    function renderGoals(goals) {
        goalsContainer.innerHTML = '';

        // Get current monthly savings (before goal deductions to show feasibility)
        const income = parseFloat(incomeInput.value) || 0;
        const rent = parseFloat(rentInput.value) || 0;
        const bills = parseFloat(billsInput.value) || 0;
        const auto = parseFloat(autoInput.value) || 0;
        const food = parseFloat(foodInput.value) || 0;
        const subs = parseFloat(subsInput.value) || 0;
        const leisure = parseFloat(leisureInput.value) || 0;
        const shopping = parseFloat(shoppingInput.value) || 0;
        const extra = parseFloat(extraInput.value) || 0;
        const baseExpenses = rent + bills + auto + food + subs + leisure + shopping + extra;
        const availableForGoals = income - baseExpenses;

        goals.forEach(goal => {
            const isCompleted = goal.isCompleted || false;
            const deposit = parseFloat(goal.deposit) || 0;
            const progressPercent = Math.min(100, Math.floor((goal.savedAmount / goal.amount) * 100) || 0);

            // Prediction based on set deposit
            const monthsLeft = deposit > 0 ? Math.ceil((goal.amount - (goal.savedAmount || 0)) / deposit) : '∞';

            let statusClass = 'status-on-track';
            let statusText = 'In linea';

            if (!isCompleted && deposit > availableForGoals) {
                statusClass = 'status-behind';
                statusText = 'Budget Insufficiente';
            }

            const goalCard = document.createElement('div');
            goalCard.className = `goal-card glass-panel ${isCompleted ? 'completed' : ''}`;
            goalCard.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                    depositToGoal('${goal.id}');
                }
            };

            goalCard.innerHTML = `
                <button class="delete-goal" onclick="deleteGoal('${goal.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3>${goal.name}</h3>
                    ${isCompleted ? '<span class="status-badge status-on-track">Completata</span>' : `<span class="status-badge ${statusClass}">${statusText}</span>`}
                </div>
                <div class="goal-progress-container">
                    <div class="goal-progress-info">
                        <span>Avanzamento Target (${currency.format(goal.savedAmount || 0)})</span>
                        <span>${progressPercent}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
                <div class="goal-prediction">
                    <div class="prediction-item">
                        <i class="fa-solid fa-piggy-bank"></i>
                        <span>Pianificato: <b class="editable-deposit" onclick="editGoalDeposit('${goal.id}')">${currency.format(deposit)}/mese</b></span>
                    </div>
                    <div class="prediction-item" style="margin-top: 0.5rem;">
                        <i class="fa-solid fa-clock"></i>
                        <span>Tempo stimato: <b>${isCompleted ? 'Traguardo raggiunto!' : (monthsLeft + ' mesi')}</b></span>
                    </div>
                    <div class="prediction-item" style="margin-top: 0.5rem; justify-content: space-between;">
                        <span><i class="fa-solid fa-euro-sign"></i> Totale: <b>${currency.format(goal.amount)}</b></span>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="primary-btn" style="width: auto; padding: 5px 15px; font-size: 0.8rem; background: var(--primary-light);" onclick="depositToGoal('${goal.id}')">Deposita</button>
                            ${!isCompleted ? `<button class="primary-btn" style="width: auto; padding: 5px 15px; font-size: 0.8rem;" onclick="toggleGoalComplete('${goal.id}')">Completa</button>` : `<button class="primary-btn" style="width: auto; padding: 5px 15px; font-size: 0.8rem; background: var(--text-muted);" onclick="toggleGoalComplete('${goal.id}')">Ripristina</button>`}
                        </div>
                    </div>
                </div>
            `;
            goalsContainer.appendChild(goalCard);
        });
    }

    window.depositToGoal = function (id) {
        const goals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals')) || '[]');
        const goal = goals.find(g => g.id === id);
        if (!goal || goal.isCompleted) return;

        const amount = prompt(`Quanto vuoi depositare oggi per "${goal.name}"?`, goal.deposit || 0);
        if (amount !== null) {
            const val = parseFloat(amount);
            if (!isNaN(val) && val > 0) {
                // 1. Update Goal
                goal.savedAmount = (parseFloat(goal.savedAmount) || 0) + val;
                if (goal.savedAmount >= goal.amount) {
                    goal.savedAmount = goal.amount;
                    goal.isCompleted = true;
                }

                // 2. RECORDING ONLY: Add to Calendar without inflating 'extra' input automatically
                // Se l'utente vuole che il deposito sia visto come spesa extra, può aggiungerlo manualmente nel tab budget.
                // Inserirlo automaticamente raddoppia il peso sui risparmi pianificati.

                // 3. Add to Calendar
                const today = new Date();
                const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                if (!events[dateStr]) events[dateStr] = [];
                events[dateStr].push({
                    category: 'extra',
                    amount: val,
                    isGoal: true,
                    goalName: goal.name
                });

                // Persist
                localStorage.setItem(getStorageKey('financeGoals'), JSON.stringify(goals));
                localStorage.setItem(getStorageKey('financeEvents'), JSON.stringify(events));
                syncData('goals', goals);
                syncData('events', events);

                // Refresh
                loadGoals();
                recalculateSummary();
                renderCalendar();
                initializeLastValues(); // Sync Magic Sync

                if (goal.isCompleted) {
                    alert(`Congratulazioni! Hai completato l'obiettivo: ${goal.name}`);
                }
            } else {
                alert("Inserisci un importo valido.");
            }
        }
    };

    window.editGoalDeposit = function (id) {
        const goals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals')) || '[]');
        const goal = goals.find(g => g.id === id);
        if (!goal) return;

        const newDeposit = prompt(`Quanto vuoi depositare mensilmente per "${goal.name}"?`, goal.deposit);
        if (newDeposit !== null) {
            const val = parseFloat(newDeposit);
            if (!isNaN(val) && val >= 0) {
                goal.deposit = val;
                localStorage.setItem(getStorageKey('financeGoals'), JSON.stringify(goals));
                syncData('goals', goals);
                loadGoals();
                recalculateSummary();
            } else {
                alert("Inserisci un importo valido.");
            }
        }
    };

    window.toggleGoalComplete = function (id) {
        const goals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals')) || '[]');
        const goal = goals.find(g => g.id === id);
        if (!goal) return;

        goal.isCompleted = !goal.isCompleted;
        if (goal.isCompleted) {
            goal.savedAmount = goal.amount; // Mark as fully saved
        } else {
            goal.savedAmount = 0; // Reset or keep partial? Let's reset for simplicity
        }

        localStorage.setItem(getStorageKey('financeGoals'), JSON.stringify(goals));
        syncData('goals', goals);
        loadGoals();
        recalculateSummary();
    };

    function addGoal() {
        const name = goalNameInput.value.trim();
        const amount = parseFloat(goalAmountInput.value);
        const months = parseInt(goalMonthsInput.value);
        const depositInput = document.getElementById('goal-deposit');
        const deposit = parseFloat(depositInput.value) || 0;

        if (!name || isNaN(amount) || isNaN(months) || amount <= 0 || months <= 0) {
            alert('Per favore inserisci dati validi per l\'obiettivo.');
            return;
        }

        const goals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals')) || '[]');
        const newGoal = {
            id: Date.now().toString(),
            name,
            amount,
            months,
            deposit,
            savedAmount: 0,
            isCompleted: false,
            createdAt: new Date().toISOString()
        };

        goals.push(newGoal);
        localStorage.setItem(getStorageKey('financeGoals'), JSON.stringify(goals));
        syncData('goals', goals);

        goalNameInput.value = '';
        goalAmountInput.value = '';
        goalMonthsInput.value = '';
        depositInput.value = '';

        loadGoals();
        recalculateSummary();
    }

    // --- Auto-calculation for Goal Deposit ---
    function updateSuggestedDeposit() {
        const amount = parseFloat(goalAmountInput.value) || 0;
        const months = parseInt(goalMonthsInput.value) || 0;
        const depositInput = document.getElementById('goal-deposit');

        if (amount > 0 && months > 0) {
            const suggested = (amount / months).toFixed(2);
            depositInput.value = suggested;
        }
    }

    if (goalAmountInput) goalAmountInput.addEventListener('input', updateSuggestedDeposit);
    if (goalMonthsInput) goalMonthsInput.addEventListener('input', updateSuggestedDeposit);

    // Expose deleteGoal to global scope for onclick
    window.deleteGoal = function (id) {
        if (!confirm('Eliminare questo obiettivo?')) return;
        let goals = JSON.parse(localStorage.getItem(getStorageKey('financeGoals')) || '[]');
        goals = goals.filter(g => g.id !== id);
        localStorage.setItem(getStorageKey('financeGoals'), JSON.stringify(goals));
        syncData('goals', goals);
        loadGoals();
    };

    if (addGoalBtn) {
        addGoalBtn.addEventListener('click', addGoal);
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('financeTheme') || 'default';
    setTheme(savedTheme);

    // Password Toggle Listeners
    document.querySelectorAll('.password-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = button.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // --- Magic Sync State ---
    let lastInputValues = {};
    function initializeLastValues() {
        allBudgetInputs.forEach(input => {
            if (input) {
                lastInputValues[input.id] = parseFloat(input.value) || 0;
            }
        });
    }

    function saveCurrentMonthBudget() {
        if (!currentDate) return;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-11
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;

        monthlyBudgets[key] = {
            income: parseFloat(incomeInput.value) || 0,
            rent: parseFloat(rentInput.value) || 0,
            bills: parseFloat(billsInput.value) || 0,
            auto: parseFloat(autoInput.value) || 0,
            food: parseFloat(foodInput.value) || 0,
            subs: parseFloat(subsInput.value) || 0,
            leisure: parseFloat(leisureInput.value) || 0,
            shopping: parseFloat(shoppingInput.value) || 0,
            extra: parseFloat(extraInput.value) || 0
        };

        localStorage.setItem(getStorageKey('financeMonthlyBudgets'), JSON.stringify(monthlyBudgets));
        syncData('budgets', monthlyBudgets);
    }

    function loadCurrentMonthBudget() {
        if (!currentDate) return;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;

        const budget = monthlyBudgets[key] || { income: '', rent: '', bills: '', auto: '', food: '', subs: '', leisure: '', shopping: '', extra: '' };

        // Se 0 nel salvataggio, lo mostriamo vuoto per pulizia a meno che non fosse intenzionale, ma lasciamo il fallback a stringa vuota per i mesi nuovi
        incomeInput.value = budget.income || '';
        rentInput.value = budget.rent || '';
        billsInput.value = budget.bills || '';
        autoInput.value = budget.auto || '';
        foodInput.value = budget.food || '';
        subsInput.value = budget.subs || '';
        leisureInput.value = budget.leisure || '';
        shoppingInput.value = budget.shopping || '';
        extraInput.value = budget.extra || '';

        // Mostra il summary se ci sono dati caricati
        recalculateSummary();
    }

    // Salva automaticamente input manuali e implementa logica ADDITIVA
    const allBudgetInputs = [incomeInput, rentInput, billsInput, autoInput, foodInput, subsInput, leisureInput, shoppingInput, extraInput];
    allBudgetInputs.forEach(input => {
        if (input) {
            // Ricalcolo in tempo reale per lo sguardo veloce
            input.addEventListener('input', recalculateSummary);

            input.addEventListener('change', () => {
                const enteredVal = parseFloat(input.value) || 0;

                // --- Logica Standard: Il valore inserito sostituisce il precedente ---
                input.value = enteredVal;
                lastInputValues[input.id] = enteredVal;

                // --- Magic Sync: Automatic Event Recording ---
                if (enteredVal !== 0) {
                    const today = new Date();
                    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                    if (!events[dateStr]) events[dateStr] = [];

                    events[dateStr].push({
                        category: input.id,
                        amount: Math.abs(enteredVal)
                    });

                    localStorage.setItem(getStorageKey('financeEvents'), JSON.stringify(events));
                    syncData('events', events);
                    renderCalendar();
                }

                saveCurrentMonthBudget();
                recalculateSummary();
            });
        }
    });

    // --- Data Deletion Logic for Budget Inputs ---
    document.querySelectorAll('.clear-input-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                targetInput.value = '';
                // Trigger event change per salvare e ricalcolare
                targetInput.dispatchEvent(new Event('change'));

                // Rimuovi anche gli eventi per la data corrispondente a oggi 
                // in modo che cliccando la X si elimini anche la registrazione nel calendario
                const today = new Date();
                const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                if (events[dateStr]) {
                    events[dateStr] = events[dateStr].filter(e => e.category !== targetId);
                    if (events[dateStr].length === 0) {
                        delete events[dateStr];
                    }
                    localStorage.setItem(getStorageKey('financeEvents'), JSON.stringify(events));
                    syncData('events', events);
                    renderCalendar();
                }
            }
        });
    });


    const monthNames = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];

    // Mappa categorie per visualizzazione
    const categoryNames = {
        'income': 'Stipendio',
        'rent': 'Affitto / Mutuo',
        'bills': 'Bollette',
        'auto': 'Auto / Trasporti',
        'food': 'Spesa / Cibo',
        'subs': 'Abbonamenti',
        'leisure': 'Svago',
        'shopping': 'Shopping',
        'extra': 'Spese Extra',
        'other': 'Altro'
    };

    // Mappa categorie in type (per il colore css: event-income, event-expense, event-other)
    const categoryToType = {
        'income': 'income',
        'rent': 'expense',
        'bills': 'expense',
        'auto': 'expense',
        'food': 'expense',
        'subs': 'expense',
        'leisure': 'expense',
        'shopping': 'expense',
        'extra': 'expense',
        'other': 'other'
    };

    function renderCalendar() {
        if (!calendarGrid) {
            console.error("Calendar grid not found!");
            return;
        }
        calendarGrid.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        if (calendarMonthYear) calendarMonthYear.textContent = `${monthNames[month]} ${year}`;

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Lunedì come primo giorno (0=Domenica -> diventa 6, altrimenti meno 1)
        const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        // Slot vuoti
        for (let i = 0; i < startingDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyDiv);
        }

        const today = new Date();

        // Giorni
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';

            if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
                dayDiv.classList.add('today');
            }

            const dateNum = document.createElement('span');
            dateNum.className = 'date-num';
            dateNum.textContent = i;
            dayDiv.appendChild(dateNum);

            // Mostra eventi sulla griglia del calendario
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            if (events[dateStr]) {
                events[dateStr].forEach((evt, index) => {
                    const evtDiv = document.createElement('div');
                    evtDiv.className = `event-indicator event-${categoryToType[evt.category] || 'other'}`;

                    let amountStr = '';
                    if (evt.amount) {
                        const type = categoryToType[evt.category] || 'other';
                        const prefix = type === 'expense' ? '-' : (type === 'income' ? '+' : '');
                        amountStr = ` ${prefix}€${evt.amount}`;
                    }

                    const titleText = evt.isGoal ? 'Spese Obiettivo' : (categoryNames[evt.category] || 'Altro');
                    evtDiv.textContent = `${titleText}${amountStr}`;

                    // Impediamo il click event bubble dalla griglia per far aprire sempre la Dettagli Modal per uniformità
                    evtDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openDayDetailsModal(dateStr, i, month, year);
                    });

                    dayDiv.appendChild(evtDiv);
                });
            }

            // Cliccando sul giorno intero si apre il riepilogo
            dayDiv.addEventListener('click', () => {
                openDayDetailsModal(dateStr, i, month, year);
            });

            calendarGrid.appendChild(dayDiv);
        }
    }

    function openDayDetailsModal(dateStr, day, month, year) {
        selectedDateInfo = dateStr;
        if (!dayDetailsModal) return;

        // Set title
        if (dayDetailsTitle) {
            dayDetailsTitle.textContent = `Eventi del ${day} ${monthNames[month]} ${year}`;
        }

        // Render Events
        if (dayEventsList) {
            dayEventsList.innerHTML = '';
            const dayEvents = events[dateStr] || [];

            if (dayEvents.length === 0) {
                dayEventsList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;">Nessun evento registrato.</p>';
            } else {
                dayEvents.forEach((evt, index) => {
                    const evtItem = document.createElement('div');
                    evtItem.style.display = 'flex';
                    evtItem.style.justifyContent = 'space-between';
                    evtItem.style.alignItems = 'center';
                    evtItem.style.padding = '10px';
                    evtItem.style.borderBottom = '1px solid var(--panel-border)';
                    evtItem.style.marginBottom = '5px';

                    let amountStr = '';
                    if (evt.amount) {
                        const type = categoryToType[evt.category] || 'other';
                        const prefix = type === 'expense' ? '-' : (type === 'income' ? '+' : '');
                        amountStr = ` ${prefix}€${evt.amount}`;
                    }
                    const titleText = evt.isGoal ? `Spesa Obiettivo: ${evt.goalName || ''}` : (categoryNames[evt.category] || 'Altro');

                    evtItem.innerHTML = `
                        <div>
                            <span class="event-indicator event-${categoryToType[evt.category] || 'other'}" style="display:inline-block; margin-right: 10px;">${titleText}</span>
                            <span style="font-weight: 500;">${amountStr}</span>
                        </div>
                        <button class="icon-btn" aria-label="Elimina Evento" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                    `;

                    // Eliminazione Singola
                    const deleteBtn = evtItem.querySelector('button');
                    deleteBtn.addEventListener('click', () => {
                        if (confirm(`Vuoi rimuovere l'evento "${titleText}"?`)) {
                            // Sincronizza con il budget: sottrai l'importo
                            if (evt.amount) {
                                const targetInput = document.getElementById(evt.category);
                                if (targetInput) {
                                    const currentVal = parseFloat(targetInput.value) || 0;
                                    targetInput.value = Math.max(0, currentVal - parseFloat(evt.amount));
                                    saveCurrentMonthBudget();
                                    recalculateSummary();
                                    initializeLastValues(); // SINCRONIZZAZIONE: evita che il Magic Sync creda ci sia di nuovo una spesa
                                }
                            }

                            events[dateStr].splice(index, 1);
                            if (events[dateStr].length === 0) delete events[dateStr];
                            localStorage.setItem(getStorageKey('financeEvents'), JSON.stringify(events));
                            syncData('events', events); // Aggiunto sync
                            renderCalendar();
                            openDayDetailsModal(dateStr, day, month, year); // Refresh della vista
                        }
                    });

                    dayEventsList.appendChild(evtItem);
                });
            }
        }

        dayDetailsModal.classList.remove('hidden');
    }

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            saveCurrentMonthBudget();
            currentDate.setMonth(currentDate.getMonth() - 1);
            loadCurrentMonthBudget();
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            saveCurrentMonthBudget();
            currentDate.setMonth(currentDate.getMonth() + 1);
            loadCurrentMonthBudget();
            renderCalendar();
        });
    }

    // --- Day Details Modal Actions ---
    if (closeDetailsModalBtn) {
        closeDetailsModalBtn.addEventListener('click', () => {
            if (dayDetailsModal) dayDetailsModal.classList.add('hidden');
        });
    }

    if (openAddEventBtn) {
        openAddEventBtn.addEventListener('click', () => {
            if (dayDetailsModal) dayDetailsModal.classList.add('hidden');
            if (eventModal) {
                eventModal.classList.remove('hidden');
                if (eventAmountInput) {
                    eventAmountInput.value = '';
                    eventAmountInput.focus();
                }
            }
        });
    }

    if (deleteAllEventsBtn) {
        deleteAllEventsBtn.addEventListener('click', () => {
            if (selectedDateInfo && events[selectedDateInfo]) {
                if (confirm(`Sei sicuro di voler eliminare TUTTI gli eventi di questa giornata?`)) {
                    // Sincronizza con il budget: sottrai tutti gli importi degli eventi del giorno
                    events[selectedDateInfo].forEach(evt => {
                        if (evt.amount) {
                            const targetInput = document.getElementById(evt.category);
                            if (targetInput) {
                                const currentVal = parseFloat(targetInput.value) || 0;
                                targetInput.value = Math.max(0, currentVal - parseFloat(evt.amount));
                            }
                        }
                    });
                    saveCurrentMonthBudget();
                    recalculateSummary();
                    initializeLastValues(); // SINCRONIZZAZIONE TOTALE

                    // Svuota gli eventi di questa giornata in modo robusto
                    delete events[selectedDateInfo];
                    localStorage.setItem(getStorageKey('financeEvents'), JSON.stringify(events));
                    syncData('events', events); // Aggiunto sync

                    // Chiudi la modale dettaglio giorno dato che è vuota
                    if (dayDetailsModal) dayDetailsModal.classList.add('hidden');

                    // Aggiorna il calendario per rimuovere il badge
                    renderCalendar();
                }
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (eventModal) eventModal.classList.add('hidden');
        });
    }

    if (saveEventBtn) {
        saveEventBtn.addEventListener('click', () => {
            if (!eventCategoryInput) return;
            const category = eventCategoryInput.value;
            const amount = eventAmountInput ? parseFloat(eventAmountInput.value.trim()) : 0;

            if (selectedDateInfo) {
                if (!events[selectedDateInfo]) {
                    events[selectedDateInfo] = [];
                }
                const newEvent = { category };
                if (!isNaN(amount) && amount > 0) {
                    newEvent.amount = amount;

                    // Aggiorna campo corrispondente nel Budget
                    const targetInput = document.getElementById(category);
                    if (targetInput) {
                        const currentVal = parseFloat(targetInput.value) || 0;
                        targetInput.value = currentVal + amount;
                        // Rimosso il calcolo automatico su richiesta dell'utente
                        saveCurrentMonthBudget();
                        recalculateSummary();
                    }
                }

                events[selectedDateInfo].push(newEvent);
                localStorage.setItem(getStorageKey('financeEvents'), JSON.stringify(events));
                syncData('events', events); // Aggiunto sync
                renderCalendar();
                if (eventModal) eventModal.classList.add('hidden');

                // Opzionale: riaprire il dettaglio giorno dopo aver salvato
                const [year, month, day] = selectedDateInfo.split('-');
                openDayDetailsModal(selectedDateInfo, parseInt(day), parseInt(month) - 1, parseInt(year));
            }
        });
    }

    // --- Tab Navigation Logic ---
    const navBtns = document.querySelectorAll('.app-nav .nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Rimuovi active da tutti i btn
            navBtns.forEach(b => b.classList.remove('active'));
            // Aggiungi active a questo btn
            btn.classList.add('active');

            // Nascondi tutte le tab
            tabPanes.forEach(pane => pane.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.add('hidden'));

            // Mostra tab selezionata
            const targetId = btn.getAttribute('data-tab');
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.remove('hidden');
                targetPane.classList.add('active');

                // Se apriamo le statistiche, aggiorna il grafico
                if (targetId === 'tab-stats') {
                    renderYearlyChart();
                }
            }
        });
    });

    // --- Yearly Chart Logic ---
    let yearlyChartInstance = null;
    const yearlyTotalIncomeEl = document.getElementById('yearly-total-income');
    const statsYearTitle = document.getElementById('stats-year-title');
    const chartDetailsPanel = document.getElementById('chart-details');
    const noDataMsg = document.getElementById('no-data-msg');

    function renderYearlyChart() {
        const currentYear = currentDate.getFullYear();
        if (statsYearTitle) statsYearTitle.textContent = currentYear;

        let totalIncome = 0;
        const expensesByCategory = {
            'rent': 0,
            'bills': 0,
            'auto': 0,
            'food': 0,
            'subs': 0,
            'leisure': 0,
            'shopping': 0,
            'extra': 0,
            'other': 0
        };

        let hasData = false;

        // 1. Aggrega dai budget mensili salvati (Valori base + eventi che hanno aggiornato i campi)
        for (let m = 1; m <= 12; m++) {
            const key = `${currentYear}-${String(m).padStart(2, '0')}`;
            const budget = monthlyBudgets[key];
            if (budget) {
                totalIncome += (parseFloat(budget.income) || 0);
                expensesByCategory['rent'] += (parseFloat(budget.rent) || 0);
                expensesByCategory['bills'] += (parseFloat(budget.bills) || 0);
                expensesByCategory['auto'] += (parseFloat(budget.auto) || 0);
                expensesByCategory['food'] += (parseFloat(budget.food) || 0);
                expensesByCategory['subs'] += (parseFloat(budget.subs) || 0);
                expensesByCategory['leisure'] += (parseFloat(budget.leisure) || 0);
                expensesByCategory['shopping'] += (parseFloat(budget.shopping) || 0);
                expensesByCategory['extra'] += (parseFloat(budget.extra) || 0);

                if (budget.income || budget.rent || budget.bills || budget.auto || budget.food || budget.subs || budget.leisure || budget.shopping || budget.extra) {
                    hasData = true;
                }
            }
        }

        // 2. Aggrega solo gli eventi "Altro" (quelli che non finiscono nei campi fissi)
        // Nota: Gli eventi come 'bollette' sono già inclusi nei campi sopra perché saveEventBtn aggiorna l'input e salva il budget.
        Object.keys(events).forEach(dateStr => {
            if (dateStr.startsWith(currentYear.toString())) {
                events[dateStr].forEach(evt => {
                    const amount = parseFloat(evt.amount) || 0;
                    if (amount > 0 && evt.category === 'other') {
                        expensesByCategory['other'] += amount;
                        hasData = true;
                    }
                });
            }
        });

        // Mostra stipendio totale anno
        if (yearlyTotalIncomeEl) {
            yearlyTotalIncomeEl.textContent = currency.format(totalIncome);
        }

        const ctx = document.getElementById('yearly-chart');
        if (!ctx) return;

        // Reset details panel
        if (chartDetailsPanel) {
            chartDetailsPanel.innerHTML = `
                <i class="fa-solid fa-hand-pointer" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted);">Clicca su una fetta del grafico a torta per visualizzare qui i dettagli della categoria di spesa.</p>
            `;
        }

        // Renderizza elenco risparmi mensili
        renderMonthlySavingsList(currentYear);

        const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);

        if (!hasData || totalExpenses === 0) {
            if (noDataMsg) noDataMsg.style.display = 'block';
            if (yearlyChartInstance) {
                yearlyChartInstance.destroy();
                yearlyChartInstance = null;
            }
            return;
        } else {
            if (noDataMsg) noDataMsg.style.display = 'none';
        }

        // Prepariamo i dati per Chart.js
        const labels = [];
        const data = [];
        const backgroundColors = [];
        const borderColors = [];

        // Mapping colori per categoria
        const colors = {
            'rent': { bg: 'rgba(239, 68, 68, 0.7)', border: '#ef4444' }, // Red
            'bills': { bg: 'rgba(245, 158, 11, 0.7)', border: '#f59e0b' }, // Orange/Warning
            'auto': { bg: 'rgba(56, 189, 248, 0.7)', border: '#38bdf8' }, // Sky Blue
            'food': { bg: 'rgba(16, 185, 129, 0.7)', border: '#10b981' }, // Emerald / Success
            'subs': { bg: 'rgba(236, 72, 153, 0.7)', border: '#ec4899' }, // Pink
            'leisure': { bg: 'rgba(249, 115, 22, 0.7)', border: '#f97316' }, // Orange
            'shopping': { bg: 'rgba(139, 92, 246, 0.7)', border: '#8b5cf6' }, // Violet
            'extra': { bg: 'rgba(168, 85, 247, 0.7)', border: '#a855f7' }, // Purple
            'other': { bg: 'rgba(148, 163, 184, 0.7)', border: '#94a3b8' } // Slate
        };

        const activeCategories = [];

        Object.keys(expensesByCategory).forEach(cat => {
            if (expensesByCategory[cat] > 0) {
                labels.push(categoryNames[cat]);
                data.push(expensesByCategory[cat]);
                backgroundColors.push(colors[cat].bg);
                borderColors.push(colors[cat].border);
                activeCategories.push(cat); // Teniamo traccia per il click
            }
        });

        if (yearlyChartInstance) {
            yearlyChartInstance.destroy();
        }

        yearlyChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Spese Annuali (€)',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#fff',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 13
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += currency.format(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        const categoryName = labels[idx];
                        const amount = data[idx];

                        if (chartDetailsPanel) {
                            chartDetailsPanel.innerHTML = `
                                <h3 style="color: ${borderColors[idx]}; margin-bottom: 0.5rem; font-size: 1.4rem;">${categoryName}</h3>
                                <p style="font-size: 1.1rem;">Hai speso un totale di <strong style="color: white; font-size: 1.5rem;">${currency.format(amount)}</strong> in quest'anno per questa categoria.</p>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 10px;">Questa categoria rappresenta il <strong>${((amount / data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%</strong> delle tue spese annuali tracciate.</p>
                            `;
                        }
                    }
                }
            }
        });
    }

    function renderMonthlySavingsList(year) {
        const savingsListEl = document.getElementById('monthly-savings-list');
        const yearlyTotalSavingsEl = document.getElementById('yearly-total-savings');
        if (!savingsListEl) return 0;

        savingsListEl.innerHTML = '';
        let totalYearlySavings = 0;

        for (let m = 0; m < 12; m++) {
            const key = `${year}-${String(m + 1).padStart(2, '0')}`;
            const budget = monthlyBudgets[key] || { income: 0, rent: 0, bills: 0, auto: 0, food: 0, subs: 0, leisure: 0, shopping: 0, extra: 0 };

            let monthIncome = parseFloat(budget.income) || 0;
            let monthExpenses = (parseFloat(budget.rent) || 0) +
                (parseFloat(budget.bills) || 0) +
                (parseFloat(budget.auto) || 0) +
                (parseFloat(budget.food) || 0) +
                (parseFloat(budget.subs) || 0) +
                (parseFloat(budget.leisure) || 0) +
                (parseFloat(budget.shopping) || 0) +
                (parseFloat(budget.extra) || 0);

            // Aggiungi solo eventi 'other' (gli altri sono già nel budget sopra)
            Object.keys(events).forEach(dateStr => {
                if (dateStr.startsWith(key)) {
                    events[dateStr].forEach(evt => {
                        const amount = parseFloat(evt.amount) || 0;
                        if (evt.category === 'other') {
                            monthExpenses += amount;
                        }
                    });
                }
            });

            const balance = monthIncome - monthExpenses;
            totalYearlySavings += balance;

            // Crea card per il mese
            const monthCard = document.createElement('div');
            monthCard.className = 'saving-card glass-panel';
            monthCard.style.padding = '1.2rem';
            monthCard.style.textAlign = 'center';
            monthCard.style.borderRadius = '16px';
            monthCard.style.border = '1px solid var(--panel-border)';

            const isPositive = balance >= 0;
            const statusClass = isPositive ? 'success' : 'danger';
            const icon = isPositive ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';

            monthCard.innerHTML = `
                <span class="month-name" style="display: block; font-weight: 500; margin-bottom: 0.5rem;">${monthNames[m]}</span>
                <div class="balance-value ${statusClass}" style="font-size: 1.3rem; font-weight: 700;">
                    ${currency.format(balance)}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
                    <i class="fa-solid ${icon}"></i> Rimanenza
                </div>
            `;

            savingsListEl.appendChild(monthCard);
        }

        // Mostra Risparmio Totale Annuo
        if (yearlyTotalSavingsEl) {
            yearlyTotalSavingsEl.textContent = currency.format(totalYearlySavings);
            yearlyTotalSavingsEl.className = totalYearlySavings >= 0 ? 'success' : 'danger';
        }
    }

    // --- CSV Import/Export Logic ---
    const downloadDemoCsvBtn = document.getElementById('download-demo-csv-btn');

    if (downloadDemoCsvBtn) {
        downloadDemoCsvBtn.addEventListener('click', () => {
            const csvContent =
                "Data,Descrizione,Importo\n" +
                "01/03/2026,Stipendio mensile,2500.00\n" +
                "02/03/2026,Affitto casa mensile,-800.00\n" +
                "05/03/2026,Bolletta Enel Luce,-65.50\n" +
                "08/03/2026,Spesa Supermercato Conad,-120.40\n" +
                "10/03/2026,Rifornimento Benzina Agip,-50.00\n" +
                "12/03/2026,Abbonamento Netflix,-12.99\n" +
                "15/03/2026,Acquisti abbigliamento Zara,-45.90\n" +
                "18/03/2026,Cena Ristorante Pizzeria,-35.00\n" +
                "20/03/2026,Biglietti Cinema,-18.00\n" +
                "25/03/2026,Pagamento Palestra mensile,-40.00\n" +
                "26/03/2026,Spesa imprevista extra,-100.00";

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "estratto_conto_demo.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }


    function processCSV(csvText) {
        const rows = csvText.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        if (rows.length < 2) {
            alert('Il file CSV sembra essere vuoto o non valido.');
            return;
        }

        let importedCategories = {
            income: 0, rent: 0, bills: 0, auto: 0,
            food: 0, subs: 0, leisure: 0, shopping: 0, extra: 0
        };

        let importCount = 0;

        // Saltiamo l'intestazione (i = 1)
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',').map(c => c.replace(/(^"|"$)/g, '').trim());

            let desc = "";
            let amount = 0;

            if (cols.length >= 2) {
                for (let j = cols.length - 1; j >= 0; j--) {
                    let valStr = cols[j].replace(/[€"']/g, '').trim();

                    if (valStr.includes(',') && valStr.includes('.')) {
                        if (valStr.lastIndexOf(',') > valStr.lastIndexOf('.')) {
                            valStr = valStr.replace(/\./g, '').replace(',', '.');
                        } else {
                            valStr = valStr.replace(/,/g, '');
                        }
                    } else if (valStr.includes(',')) {
                        valStr = valStr.replace(',', '.');
                    }

                    let val = parseFloat(valStr);
                    if (!isNaN(val)) {
                        amount = val;
                        desc = cols.slice(0, j).join(' ').toLowerCase();
                        break;
                    }
                }
            }

            if (amount !== 0 && desc) {
                const category = categorizeExpense(desc, amount);
                if (category) {
                    importedCategories[category] += Math.abs(amount);
                    importCount++;
                }
            }
        }

        if (importCount > 0) {
            if (importedCategories.income > 0) incomeInput.value = ((parseFloat(incomeInput.value) || 0) + importedCategories.income).toFixed(2);
            if (importedCategories.rent > 0) rentInput.value = ((parseFloat(rentInput.value) || 0) + importedCategories.rent).toFixed(2);
            if (importedCategories.bills > 0) billsInput.value = ((parseFloat(billsInput.value) || 0) + importedCategories.bills).toFixed(2);
            if (importedCategories.auto > 0) autoInput.value = ((parseFloat(autoInput.value) || 0) + importedCategories.auto).toFixed(2);
            if (importedCategories.food > 0) foodInput.value = ((parseFloat(foodInput.value) || 0) + importedCategories.food).toFixed(2);
            if (importedCategories.subs > 0) subsInput.value = ((parseFloat(subsInput.value) || 0) + importedCategories.subs).toFixed(2);
            if (importedCategories.leisure > 0) leisureInput.value = ((parseFloat(leisureInput.value) || 0) + importedCategories.leisure).toFixed(2);
            if (importedCategories.shopping > 0) shoppingInput.value = ((parseFloat(shoppingInput.value) || 0) + importedCategories.shopping).toFixed(2);
            if (importedCategories.extra > 0) extraInput.value = ((parseFloat(extraInput.value) || 0) + importedCategories.extra).toFixed(2);

            saveCurrentMonthBudget();
            recalculateSummary();
            initializeLastValues();
            alert(`Estratto conto importato con successo!\nSono stati elaborati ${importCount} movimenti e suddivisi automaticamente nelle categorie del budget.`);
        } else {
            alert('Nessun movimento valido o riconosciuto trovato nel CSV. Assicurati che contenga descrizioni e importi validi (separati da virgola).');
        }
    }

    function categorizeExpense(desc, amount) {
        if (amount > 0 && (desc.includes('stipendio') || desc.includes('bonifico a tuo favore') || desc.includes('accredito') || desc.includes('rimborso'))) {
            return 'income';
        }

        const categories = {
            'rent': ['affitto', 'mutuo', 'immobiliare', 'condominio', 'canone'],
            'bills': ['enel', 'luce', 'gas', 'acqua', 'tim', 'vodafone', 'wind', 'iliad', 'bolletta', 'tari', 'ama', 'telecom', 'fastweb', 'acea'],
            'auto': ['benzina', 'agip', 'eni', 'q8', 'tamoil', 'telepass', 'assicurazione auto', 'meccanico', 'parcheggio', 'autostrada', 'trenitalia', 'atm', 'atac', 'carburante', 'diesel', 'ip'],
            'food': ['supermercato', 'coop', 'conad', 'esselunga', 'pam', 'carrefour', 'lidl', 'eurospin', 'md', 'spesa', 'macellaio', 'panificio', 'ristorante', 'pizzeria', 'mcdonald', 'burger king', 'bar', 'glovo', 'deliveroo', 'just eat', 'tigros', 'iper', 'bennet'],
            'subs': ['netflix', 'spotify', 'amazon prime', 'disney+', 'dazn', 'palestra', 'abbonamento', 'icloud', 'g-suite', 'mensile'],
            'shopping': ['amazon', 'zara', 'h&m', 'ikea', 'zalando', 'abbigliamento', 'scarpe', 'negozio', 'centro commerciale', 'tezenis', 'calzedonia', 'mediaworld', 'unieuro', 'euronics'],
            'leisure': ['cinema', 'teatro', 'concerto', 'ticketone', 'museo', 'viaggio', 'ryanair', 'booking', 'easyjet', 'tripadvisor', 'hotel']
        };

        for (const [cat, keywords] of Object.entries(categories)) {
            if (keywords.some(kw => desc.includes(kw))) {
                return cat;
            }
        }

        // Se l'importo è positivo ed ha fallito i check, potrebbe essere un rimborso/entrata generica, 
        // ma mettiamolo in 'income' per sicurezza o saltiamolo
        if (amount > 0) {
            return 'income'; // default positivi come entrate
        }

        return 'extra';
    }


    // --- Smart Import Logic ---
    const smartImportBtn = document.getElementById('smart-import-btn');
    const smartImportModal = document.getElementById('smart-import-modal');
    const closeSmartImportBtn = document.getElementById('close-smart-import');
    const analyzeSmartImportBtn = document.getElementById('analyze-smart-import');
    const applySmartImportBtn = document.getElementById('apply-smart-import');
    const smartImportTextArea = document.getElementById('smart-import-text');
    const smartImportReview = document.getElementById('smart-import-review');
    const smartImportResultsList = document.getElementById('smart-import-results-list');

    // File upload elements
    const smartFileUpload = document.getElementById('smart-file-upload');
    const smartFileName = document.getElementById('smart-file-name');
    const fileNameSpan = document.getElementById('file-name-span');

    let smartImportData = {};
    let fileContent = "";

    if (smartImportBtn) {
        smartImportBtn.addEventListener('click', () => {
            smartImportModal.classList.remove('hidden');
            smartImportTextArea.value = '';
            smartImportReview.classList.add('hidden');
            applySmartImportBtn.classList.add('hidden');
            smartFileUpload.value = '';
            smartFileName.classList.add('hidden');
            fileContent = "";
        });
    }

    if (closeSmartImportBtn) {
        closeSmartImportBtn.addEventListener('click', () => {
            smartImportModal.classList.add('hidden');
        });
    }

    if (smartFileUpload) {
        smartFileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileNameSpan.textContent = file.name;
            smartFileName.classList.remove('hidden');

            const reader = new FileReader();
            reader.onload = (event) => {
                fileContent = event.target.result;
            };
            reader.readAsText(file);
        });
    }

    if (analyzeSmartImportBtn) {
        analyzeSmartImportBtn.addEventListener('click', () => {
            const pastedText = smartImportTextArea.value.trim();
            const textToAnalyze = fileContent || pastedText;

            if (!textToAnalyze) {
                alert("Per favore, incolla del testo o carica un file da analizzare.");
                return;
            }

            const results = processSmartImportText(textToAnalyze);
            if (results.count > 0) {
                smartImportData = results.categories;
                renderSmartImportReview(results.items);
                smartImportReview.classList.remove('hidden');
                applySmartImportBtn.classList.remove('hidden');
            } else {
                alert("Non ho trovato nessun importo o descrizione valida nel contenuto fornito.");
            }
        });
    }

    if (applySmartImportBtn) {
        applySmartImportBtn.addEventListener('click', () => {
            if (smartImportData.income > 0) incomeInput.value = ((parseFloat(incomeInput.value) || 0) + smartImportData.income).toFixed(2);
            if (smartImportData.rent > 0) rentInput.value = ((parseFloat(rentInput.value) || 0) + smartImportData.rent).toFixed(2);
            if (smartImportData.bills > 0) billsInput.value = ((parseFloat(billsInput.value) || 0) + smartImportData.bills).toFixed(2);
            if (smartImportData.auto > 0) autoInput.value = ((parseFloat(autoInput.value) || 0) + smartImportData.auto).toFixed(2);
            if (smartImportData.food > 0) foodInput.value = ((parseFloat(foodInput.value) || 0) + smartImportData.food).toFixed(2);
            if (smartImportData.subs > 0) subsInput.value = ((parseFloat(subsInput.value) || 0) + smartImportData.subs).toFixed(2);
            if (smartImportData.leisure > 0) leisureInput.value = ((parseFloat(leisureInput.value) || 0) + smartImportData.leisure).toFixed(2);
            if (smartImportData.shopping > 0) shoppingInput.value = ((parseFloat(shoppingInput.value) || 0) + smartImportData.shopping).toFixed(2);
            if (smartImportData.extra > 0) extraInput.value = ((parseFloat(extraInput.value) || 0) + smartImportData.extra).toFixed(2);

            saveCurrentMonthBudget();
            recalculateSummary();
            initializeLastValues();

            smartImportModal.classList.add('hidden');
            alert("Dati applicati con successo al tuo budget!");
        });
    }

    function processSmartImportText(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let categories = {
            income: 0, rent: 0, bills: 0, auto: 0,
            food: 0, subs: 0, leisure: 0, shopping: 0, extra: 0
        };
        let items = [];
        let count = 0;

        lines.forEach(line => {
            // Regex migliorata per trovare importi (es. -45.90, +2500, 1.200,50)
            const amountRegex = /([-+]?\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})|[-+]?\s?\d+(?:\.\d{2})?)/g;
            const matches = line.match(amountRegex);

            if (matches) {
                // Prendiamo l'ultimo match che solitamente è l'importo nell'estratto conto
                let valStr = matches[matches.length - 1].replace(/\s/g, '');

                // Normalizzazione formato italiano (1.234,56 -> 1234.56)
                if (valStr.includes(',') && valStr.includes('.')) {
                    valStr = valStr.replace(/\./g, '').replace(',', '.');
                } else if (valStr.includes(',')) {
                    valStr = valStr.replace(',', '.');
                }

                const amount = parseFloat(valStr);

                if (!isNaN(amount) && amount !== 0) {
                    // La descrizione è tutto ciò che rimane nella riga togliendo l'importo
                    let desc = line.replace(matches[matches.length - 1], '').trim();
                    desc = desc.replace(/^\d{2}\/\d{2}\/\d{4}/, '').trim(); // Togliamo eventuale data iniziale

                    const category = categorizeExpense(desc.toLowerCase(), amount);
                    if (category) {
                        categories[category] += Math.abs(amount);
                        items.push({ desc: desc || "Movimento senza descrizione", amount, category });
                        count++;
                    }
                }
            }
        });

        return { categories, items, count };
    }

    function renderSmartImportReview(items) {
        smartImportResultsList.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.padding = '8px 0';
            div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            div.style.fontSize = '0.9rem';

            const isPositive = item.amount > 0;
            const color = isPositive ? 'var(--success)' : 'white';
            const catName = categoryNames[item.category] || 'Extra';

            div.innerHTML = `
                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 10px;">
                    <span style="color: var(--text-muted); font-size: 0.75rem; display: block; text-transform: uppercase;">${catName}</span>
                    ${item.desc}
                </div>
                <div style="font-weight: 600; color: ${color};">
                    ${isPositive ? '+' : ''}${currency.format(item.amount)}
                </div>
            `;
            smartImportResultsList.appendChild(div);
        });
    }

    // Inizializza lo stato dell'app
    checkAuthStatus();
});
