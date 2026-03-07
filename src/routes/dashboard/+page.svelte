<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { goto } from "$app/navigation";
    import { createWebHaptics } from "web-haptics/svelte";
    import NumberFlow from "@number-flow/svelte";

    const haptic = createWebHaptics();
    onDestroy(() => haptic.destroy());

    interface ClassInfo {
        oid: string;
        name: string;
        term: string;
        teacher: string;
        room: string;
        grade: string | null;
    }

    type Tab =
        | "home"
        | "transcript"
        | "info"
        | "groups"
        | "calendar"
        | "reports"
        | "locker"
        | "about";

    const tabs: { key: Tab; label: string }[] = [
        { key: "home", label: "Overview" },
        { key: "transcript", label: "Transcript" },
        { key: "info", label: "Profile" },
        { key: "groups", label: "Groups" },
        { key: "calendar", label: "Calendar" },
        { key: "reports", label: "Reports" },
        { key: "locker", label: "Locker" },
        { key: "about", label: "About" },
    ];

    type TranscriptSubTab = "courses" | "graduation";
    let transcriptSubTab = $state<TranscriptSubTab>("courses");

    let classes = $state<ClassInfo[]>([]);
    let loading = $state(true);
    let tab = $state<Tab>("home");
    let studentInfo = $state<Record<string, string>>({});
    let groups = $state<string[][]>([]);
    interface CalendarEvent {
        name: string;
        section: string;
        date: string;
        type: "assignment" | "event";
    }

    interface CalendarData {
        month: string;
        events: CalendarEvent[];
    }

    let calendarData = $state<CalendarData | null>(null);
    let calendarNav = $state(false);

    async function navCalendar(dir: "prev" | "next") {
        calendarNav = true;
        try {
            const res = await fetch(`/api/calendar?dir=${dir}`);
            if (res.ok) calendarData = await res.json();
        } finally {
            calendarNav = false;
        }
    }
    let locker = $state<string[][]>([]);

    interface TranscriptEntry {
        year: string;
        grade: string;
        course: string;
        finalGrade: string;
        credit: string;
    }
    let transcript = $state<TranscriptEntry[] | null>(null);

    interface GradRequirement {
        code: string;
        description: string;
        required: string;
        completed: string;
        status: string;
    }
    interface GradSummary {
        program: string;
        requiredTotal: string;
        completedTotal: string;
        requirements: GradRequirement[];
    }
    let graduation = $state<GradSummary | null>(null);

    interface Report {
        name: string;
        size: string;
        date: string;
        creator: string;
        description: string;
        oid: string;
    }
    let reports = $state<Report[] | null>(null);
    let tabLoading = $state(false);

    // --- Streak logic ---
    let streak = $state(0);
    let streakReady = $state(false);
    let streakBumped = $state(false);
    let todayDow = $state(0); // 0=Sun, 1=Mon, ...
    let streakDays = $state<boolean[]>([]); // last 7 days, Mon–Sun

    function getDateStr(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function computeStreak() {
        const now = new Date();
        const todayStr = getDateStr(now);
        todayDow = now.getDay();

        const stored = localStorage.getItem("streak_data");
        let data: { lastDate: string; count: number; history: string[] } =
            stored
                ? JSON.parse(stored)
                : { lastDate: "", count: 0, history: [] };

        if (data.lastDate === todayStr) {
            // Already visited today
            streak = data.count;
        } else {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getDateStr(yesterday);

            if (data.lastDate === yesterdayStr) {
                // Consecutive day
                data.count += 1;
            } else {
                // Streak broken — restart at 1
                data.count = 1;
                data.history = [];
            }
            data.lastDate = todayStr;
            if (!data.history.includes(todayStr)) {
                data.history.push(todayStr);
            }
            // Keep only last 30 days of history
            data.history = data.history.slice(-30);
            localStorage.setItem("streak_data", JSON.stringify(data));
            streakBumped = true;
            // Animate: start from previous value, then bump
            streak = data.count - 1;
            setTimeout(() => {
                streak = data.count;
                haptic.trigger("success");
            }, 600);
        }

        // Build week view (Mon–Sun)
        const weekDays: boolean[] = [];
        // Find the Monday of the current week
        const monday = new Date(now);
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(now.getDate() + diff);

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            weekDays.push(data.history.includes(getDateStr(d)));
        }
        streakDays = weekDays;
        streakReady = true;
    }

    // --- PWA install prompt ---
    let deferredPrompt = $state<any>(null);
    let showInstallBanner = $state(false);
    let isIos = $state(false);

    function dismissInstall() {
        showInstallBanner = false;
        localStorage.setItem("pwa_dismissed", Date.now().toString());
    }

    async function installPwa() {
        if (!deferredPrompt) return;
        haptic.trigger("medium");
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            haptic.trigger("success");
        }
        deferredPrompt = null;
        showInstallBanner = false;
    }

    onMount(async () => {
        computeStreak();

        // PWA: check if already installed or dismissed recently
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches
            || (navigator as any).standalone === true;
        const dismissed = localStorage.getItem("pwa_dismissed");
        const dismissedRecently = dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000;

        if (!isStandalone && !dismissedRecently) {
            // iOS detection
            const ua = navigator.userAgent;
            isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

            if (isIos) {
                showInstallBanner = true;
            } else {
                window.addEventListener("beforeinstallprompt", (e: Event) => {
                    e.preventDefault();
                    deferredPrompt = e;
                    showInstallBanner = true;
                });
            }
        }

        const res = await fetch("/api/classes");
        if (!res.ok) {
            goto("/");
            return;
        }
        classes = await res.json();
        loading = false;
    });

    async function loadTab(t: Tab) {
        if (tab === t) return;
        haptic.trigger("selection");

        const update = () => { tab = t; };
        if (document.startViewTransition) {
            document.startViewTransition(update);
        } else {
            update();
        }

        tabLoading = true;
        try {
            if (t === "info" && !Object.keys(studentInfo).length) {
                const res = await fetch("/api/student");
                if (res.ok) studentInfo = await res.json();
            } else if (t === "groups" && !groups.length) {
                const res = await fetch("/api/groups");
                if (res.ok) groups = await res.json();
            } else if (t === "calendar" && !calendarData) {
                const res = await fetch("/api/calendar");
                if (res.ok) calendarData = await res.json();
            } else if (t === "transcript") {
                const fetches: Promise<void>[] = [];
                if (transcript === null) {
                    fetches.push(fetch("/api/transcript").then(async (res) => {
                        if (res.ok) transcript = await res.json();
                    }));
                }
                if (graduation === null) {
                    fetches.push(fetch("/api/graduation").then(async (res) => {
                        if (res.ok) graduation = await res.json();
                    }));
                }
                await Promise.all(fetches);
            } else if (t === "reports" && reports === null) {
                const res = await fetch("/api/reports");
                if (res.ok) reports = await res.json();
            } else if (t === "locker" && !locker.length) {
                const res = await fetch("/api/locker");
                if (res.ok) locker = await res.json();
            }
        } finally {
            tabLoading = false;
        }
    }

    function gradeColor(grade: string | null): string {
        if (!grade) return "text-stone-600";
        const num = parseFloat(grade);
        if (isNaN(num)) return "text-amber-accent";
        if (num >= 86) return "text-sage";
        if (num >= 73) return "text-amber-accent";
        if (num >= 50) return "text-ochre";
        return "text-terracotta";
    }

    function gradeBg(grade: string | null): string {
        if (!grade) return "bg-stone-800/30";
        const num = parseFloat(grade);
        if (isNaN(num)) return "bg-amber-accent/5";
        if (num >= 86) return "bg-sage/5";
        if (num >= 73) return "bg-amber-accent/5";
        if (num >= 50) return "bg-ochre/5";
        return "bg-terracotta/5";
    }

    function gradeBorder(grade: string | null): string {
        if (!grade) return "border-stone-800";
        const num = parseFloat(grade);
        if (isNaN(num)) return "border-amber-accent/20";
        if (num >= 86) return "border-sage/20";
        if (num >= 73) return "border-amber-accent/20";
        if (num >= 50) return "border-ochre/20";
        return "border-terracotta/20";
    }

    function getTimeGreeting(): string {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        return "Good evening";
    }

    $effect(() => {
        if (!loading && classes.length) {
            // derived stats
        }
    });
</script>

<svelte:head>
    <title>Dashboard — BETTER-MYED</title>
</svelte:head>

<div
    class="min-h-screen bg-stone-950 text-stone-100 page-enter overflow-x-hidden"
>
    <!-- Header -->
    <header class="border-b border-stone-800/80">
        <div
            class="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between"
        >
            <span
                class="font-brand font-700 text-stone-200 text-sm tracking-tight"
                >BETTER-MYED</span
            >
            <button
                onclick={async () => {
                    await fetch("/api/logout", { method: "POST" });
                    goto("/");
                }}
                class="text-[11px] font-mono text-stone-500 uppercase tracking-wider hover:text-stone-300 transition-colors duration-150 cursor-pointer"
            >
                Sign out
            </button>
        </div>
    </header>

    <!-- PWA Install Banner — thin top strip -->
    {#if showInstallBanner}
        <div class="bg-amber-accent/5 px-4 md:px-6 py-1.5">
            <div class="max-w-6xl mx-auto flex items-center justify-center gap-3 text-[11px] font-mono">
                {#if isIos}
                    <span class="text-stone-400">Tap <svg class="inline w-3 h-3 text-amber-accent -mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> → <span class="text-stone-200">Add to Home Screen</span></span>
                {:else}
                    <span class="text-stone-400">Install as app for instant access</span>
                    <button
                        onclick={installPwa}
                        class="text-amber-accent hover:text-amber-accent/80 transition-colors cursor-pointer underline underline-offset-2"
                    >Install</button>
                {/if}
                <button
                    onclick={dismissInstall}
                    class="text-stone-600 hover:text-stone-400 transition-colors cursor-pointer ml-1"
                    aria-label="Dismiss"
                >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
    {/if}

    <!-- Navigation -->
    <nav class="border-b border-stone-800/80 bg-stone-950 sticky top-0 z-10">
        <div class="max-w-6xl mx-auto px-4 md:px-6 flex overflow-x-auto">
            {#each tabs as t}
                <button
                    onclick={() => loadTab(t.key)}
                    class="relative px-4 md:px-5 py-3.5 text-sm whitespace-nowrap transition-colors duration-150 cursor-pointer group
						{tab === t.key ? 'text-stone-100' : 'text-stone-500 hover:text-stone-300'}"
                >
                    {t.label}
                    <div
                        class="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-accent transition-all duration-200
							{tab === t.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-20'}"
                    ></div>
                </button>
            {/each}
        </div>
    </nav>

    <!-- Content -->
    <main class="max-w-6xl mx-auto px-4 md:px-6">
        {#if loading}
            <!-- Dashboard skeleton -->
            <section
                class="pt-10 pb-8 md:pt-14 md:pb-10 border-b border-stone-800/50"
            >
                <div class="h-3 w-24 bg-stone-900 skeleton mb-4"></div>
                <div class="h-7 w-48 bg-stone-900 skeleton mb-3"></div>
                <div
                    class="h-3.5 w-36 bg-stone-900 skeleton"
                    style="animation-delay: 100ms"
                ></div>
            </section>
            <section class="py-6 border-b border-stone-800/50">
                <div
                    class="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-stone-800/40"
                >
                    {#each Array(4) as _, i}
                        <div class="bg-stone-950 p-4 md:p-5">
                            <div
                                class="h-2.5 w-14 bg-stone-900 skeleton mb-3"
                                style="animation-delay: {i * 50}ms"
                            ></div>
                            <div
                                class="h-6 w-10 bg-stone-900 skeleton"
                                style="animation-delay: {i * 50 + 25}ms"
                            ></div>
                        </div>
                    {/each}
                </div>
            </section>
            <section class="py-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="h-2.5 w-16 bg-stone-900 skeleton"></div>
                </div>
                <div class="hidden md:block border border-stone-800">
                    <div
                        class="px-5 py-3 bg-stone-900 border-b border-stone-800"
                    >
                        <div class="h-2.5 w-full bg-stone-800 skeleton"></div>
                    </div>
                    {#each Array(5) as _, i}
                        <div
                            class="px-5 py-4 border-b border-stone-800/40 flex items-center gap-6"
                        >
                            <div
                                class="h-3.5 flex-1 bg-stone-900 skeleton"
                                style="animation-delay: {i * 60}ms"
                            ></div>
                            <div
                                class="h-3 w-24 bg-stone-900 skeleton"
                                style="animation-delay: {i * 60 + 20}ms"
                            ></div>
                            <div
                                class="h-3 w-12 bg-stone-900 skeleton"
                                style="animation-delay: {i * 60 + 40}ms"
                            ></div>
                            <div
                                class="h-5 w-10 bg-stone-900 skeleton"
                                style="animation-delay: {i * 60 + 60}ms"
                            ></div>
                        </div>
                    {/each}
                </div>
                <div class="md:hidden grid gap-[1px] bg-stone-800/50">
                    {#each Array(4) as _, i}
                        <div class="bg-stone-950 px-4 py-4 space-y-2.5">
                            <div
                                class="flex items-center justify-between gap-4"
                            >
                                <div
                                    class="h-3.5 flex-1 bg-stone-900 skeleton"
                                    style="animation-delay: {i * 60}ms"
                                ></div>
                                <div
                                    class="h-5 w-10 bg-stone-900 skeleton"
                                    style="animation-delay: {i * 60 + 30}ms"
                                ></div>
                            </div>
                            <div
                                class="h-2.5 w-40 bg-stone-900 skeleton"
                                style="animation-delay: {i * 60 + 60}ms"
                            ></div>
                        </div>
                    {/each}
                </div>
            </section>
        {:else if tabLoading}
            <section class="py-6 md:py-8">
                <div class="mb-6 flex items-center gap-3">
                    <div class="h-2 w-24 bg-stone-900 skeleton"></div>
                    <div class="h-px flex-1 bg-stone-800/60"></div>
                </div>
                <div class="grid gap-[1px] bg-stone-800/50">
                    {#each Array(5) as _, i}
                        <div class="bg-stone-950 px-4 md:px-5 py-4">
                            <div class="flex items-center justify-between gap-4">
                                <div class="flex-1 space-y-2">
                                    <div class="h-3 w-3/4 bg-stone-900 skeleton" style="animation-delay: {i * 60}ms"></div>
                                    <div class="h-2 w-1/2 bg-stone-900/60 skeleton" style="animation-delay: {i * 60 + 30}ms"></div>
                                </div>
                                <div class="h-5 w-12 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 50}ms"></div>
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        {:else}
        <div style="view-transition-name: tab-content">
        {#if tab === "home"}
            {@const gradedClasses = classes.filter(
                (c) => c.grade && !isNaN(parseFloat(c.grade)),
            )}
            {@const avgGrade = gradedClasses.length
                ? Math.round(
                      gradedClasses.reduce(
                          (s, c) => s + parseFloat(c.grade!),
                          0,
                      ) / gradedClasses.length,
                  )
                : null}
            {@const highestClass = gradedClasses.length
                ? gradedClasses.reduce((a, b) =>
                      parseFloat(a.grade!) > parseFloat(b.grade!) ? a : b,
                  )
                : null}

            <!-- Hero / greeting -->
            <section
                class="pt-10 pb-8 md:pt-14 md:pb-10 border-b border-stone-800/50"
            >
                <div class="flex items-start justify-between gap-6">
                    <div class="stagger-in">
                        <p
                            class="text-[11px] font-mono text-stone-500 uppercase tracking-wider mb-3"
                        >
                            {getTimeGreeting()}
                        </p>
                        <h1
                            class="font-display font-700 text-2xl md:text-3xl text-stone-50 tracking-tight mb-2"
                        >
                            Your overview
                        </h1>
                        <p class="text-stone-500 text-sm">
                            {classes.length} class{classes.length !== 1
                                ? "es"
                                : ""} this term
                            {#if avgGrade !== null}
                                <span class="text-stone-700 mx-1">·</span>
                                <span class={gradeColor(String(avgGrade))}>
                                    {avgGrade}% average
                                </span>
                            {/if}
                        </p>
                    </div>

                    <!-- Streak -->
                    {#if streakReady}
                        <div
                            class="stagger-in shrink-0"
                            style="animation-delay: 120ms"
                        >
                            <div class="streak-container relative">
                                <!-- Ambient glow -->
                                <div
                                    class="streak-glow"
                                    class:streak-glow-hot={streak >= 3}
                                ></div>

                                <div
                                    class="relative flex flex-col items-end gap-3"
                                >
                                    <!-- Fire + Number -->
                                    <div class="flex items-center gap-2">
                                        <!-- Animated fire -->
                                        <div
                                            class="streak-flame-wrap"
                                            class:streak-flame-lit={streak >= 1}
                                        >
                                            <svg
                                                class="streak-flame"
                                                width="30"
                                                height="38"
                                                viewBox="0 0 30 38"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <defs>
                                                    <linearGradient
                                                        id="flameOuter"
                                                        x1="15"
                                                        y1="2"
                                                        x2="15"
                                                        y2="36"
                                                        gradientUnits="userSpaceOnUse"
                                                    >
                                                        <stop
                                                            offset="0"
                                                            stop-color="#FF9600"
                                                        />
                                                        <stop
                                                            offset="0.55"
                                                            stop-color="#FF6B00"
                                                        />
                                                        <stop
                                                            offset="1"
                                                            stop-color="#E83A00"
                                                        />
                                                    </linearGradient>
                                                    <linearGradient
                                                        id="flameInner"
                                                        x1="15"
                                                        y1="14"
                                                        x2="15"
                                                        y2="33"
                                                        gradientUnits="userSpaceOnUse"
                                                    >
                                                        <stop
                                                            offset="0"
                                                            stop-color="#FFCC00"
                                                        />
                                                        <stop
                                                            offset="0.5"
                                                            stop-color="#FFAA00"
                                                        />
                                                        <stop
                                                            offset="1"
                                                            stop-color="#FF7A00"
                                                        />
                                                    </linearGradient>
                                                    <linearGradient
                                                        id="flameCore"
                                                        x1="15"
                                                        y1="20"
                                                        x2="15"
                                                        y2="31"
                                                        gradientUnits="userSpaceOnUse"
                                                    >
                                                        <stop
                                                            offset="0"
                                                            stop-color="#FFF2C4"
                                                        />
                                                        <stop
                                                            offset="1"
                                                            stop-color="#FFD644"
                                                        />
                                                    </linearGradient>
                                                </defs>
                                                <!-- Outer body -->
                                                <path
                                                    class="flame-outer"
                                                    d="M15 2C15 2 8.5 9 6 15.5C3.5 22 4.2 27 6.5 30.5C9 34.3 12 36 15 36C18 36 21 34.3 23.5 30.5C25.8 27 26.5 22 24 15.5C21.5 9 15 2 15 2Z"
                                                    fill="url(#flameOuter)"
                                                />
                                                <!-- Inner body -->
                                                <path
                                                    class="flame-inner"
                                                    d="M15 14C15 14 10.5 19.5 10 24C9.6 27.5 11.5 31 15 33C18.5 31 20.4 27.5 20 24C19.5 19.5 15 14 15 14Z"
                                                    fill="url(#flameInner)"
                                                />
                                                <!-- Hot core -->
                                                <path
                                                    class="flame-core"
                                                    d="M15 21C15 21 12.5 24.5 12.5 26.5C12.5 28.5 13.6 30 15 30C16.4 30 17.5 28.5 17.5 26.5C17.5 24.5 15 21 15 21Z"
                                                    fill="url(#flameCore)"
                                                />
                                            </svg>
                                        </div>

                                        <div class="flex items-baseline gap-1">
                                            <span
                                                class="streak-number {streak >=
                                                7
                                                    ? 'streak-fire'
                                                    : streak >= 3
                                                      ? 'text-[#FF9600]'
                                                      : 'text-stone-300'}"
                                            >
                                                <NumberFlow value={streak} />
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Week dots (Mon–Sun) -->
                                    <div class="flex items-center gap-[6px]">
                                        {#each ["M", "T", "W", "T", "F", "S", "S"] as label, i}
                                            {@const isActive = streakDays[i]}
                                            {@const isToday =
                                                i ===
                                                (todayDow === 0
                                                    ? 6
                                                    : todayDow - 1)}
                                            <div
                                                class="flex flex-col items-center gap-1"
                                            >
                                                <div
                                                    class="streak-dot w-[7px] h-[7px] transition-all duration-500
                                                        {isActive
                                                        ? 'streak-dot-active'
                                                        : 'bg-stone-800'}
                                                        {isToday && !isActive
                                                        ? 'ring-1 ring-stone-700 ring-offset-1 ring-offset-stone-950'
                                                        : ''}
                                                        {isToday && isActive
                                                        ? 'ring-1 ring-[#FF9600]/40 ring-offset-1 ring-offset-stone-950'
                                                        : ''}"
                                                    style="transition-delay: {i *
                                                        70}ms; {isActive
                                                        ? 'background: #FF9600;'
                                                        : ''}"
                                                ></div>
                                                <span
                                                    class="text-[7px] font-mono {isToday
                                                        ? 'text-stone-400'
                                                        : 'text-stone-700'}"
                                                    >{label}</span
                                                >
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </section>

            <!-- Stats strip -->
            {#if gradedClasses.length}
                <section class="py-6 border-b border-stone-800/50">
                    <div
                        class="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-stone-800/40 stagger-in"
                        style="animation-delay: 80ms"
                    >
                        <div class="bg-stone-950 p-4 md:p-5">
                            <p
                                class="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-2"
                            >
                                Classes
                            </p>
                            <p
                                class="font-mono font-600 text-xl text-stone-100"
                            >
                                {classes.length}
                            </p>
                        </div>
                        <div class="bg-stone-950 p-4 md:p-5">
                            <p
                                class="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-2"
                            >
                                Graded
                            </p>
                            <p
                                class="font-mono font-600 text-xl text-stone-100"
                            >
                                {gradedClasses.length}
                            </p>
                        </div>
                        <div class="bg-stone-950 p-4 md:p-5">
                            <p
                                class="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-2"
                            >
                                Average
                            </p>
                            <p
                                class="font-mono font-600 text-xl {gradeColor(
                                    String(avgGrade),
                                )}"
                            >
                                {avgGrade}%
                            </p>
                        </div>
                        <div class="bg-stone-950 p-4 md:p-5">
                            <p
                                class="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-2"
                            >
                                Highest
                            </p>
                            <p
                                class="font-mono font-600 text-xl {gradeColor(
                                    highestClass?.grade ?? null,
                                )}"
                            >
                                {highestClass?.grade ?? "--"}
                            </p>
                        </div>
                    </div>
                </section>
            {/if}

            <!-- Classes -->
            <section class="py-6">
                <div
                    class="flex items-center justify-between mb-4 stagger-in"
                    style="animation-delay: 140ms"
                >
                    <h2
                        class="text-[11px] font-mono font-500 text-stone-400 uppercase tracking-wider"
                    >
                        Classes
                    </h2>
                    <span class="text-[11px] font-mono text-stone-600"
                        >{classes.length}</span
                    >
                </div>

                <!-- Desktop: table-style rows -->
                <div class="hidden md:block border border-stone-800">
                    <!-- Header row -->
                    <div
                        class="grid grid-cols-[1fr_160px_80px_80px] gap-0 px-5 py-2.5 bg-stone-900 border-b border-stone-800 text-[10px] font-mono text-stone-500 uppercase tracking-wider"
                    >
                        <span>Course</span>
                        <span>Instructor</span>
                        <span>Room</span>
                        <span class="text-right">Grade</span>
                    </div>
                    {#each classes as cls, i}
                        <a
                            href="/class/{cls.oid}?name={encodeURIComponent(
                                cls.name,
                            )}"
                            onclick={() => haptic.trigger("light")}
                            class="stagger-in grid grid-cols-[1fr_160px_80px_80px] gap-0 px-5 py-3.5 border-b border-stone-800/40 hover:bg-stone-900/50 transition-colors duration-100 group"
                            style="animation-delay: {160 + i * 35}ms"
                        >
                            <span class="flex items-center gap-3 min-w-0">
                                <span
                                    class="text-sm text-stone-200 font-500 truncate group-hover:text-stone-50 transition-colors"
                                    >{cls.name}</span
                                >
                                <span
                                    class="text-[10px] font-mono text-stone-600 uppercase shrink-0"
                                    >{cls.term}</span
                                >
                            </span>
                            <span
                                class="text-xs text-stone-500 self-center truncate"
                                >{cls.teacher}</span
                            >
                            <span
                                class="text-xs font-mono text-stone-500 self-center"
                                >{cls.room}</span
                            >
                            <span class="text-right self-center">
                                {#if cls.grade}
                                    <span
                                        class="inline-block whitespace-nowrap px-2 py-0.5 font-mono text-xs font-600 {gradeColor(
                                            cls.grade,
                                        )} {gradeBg(
                                            cls.grade,
                                        )} border {gradeBorder(cls.grade)}"
                                    >
                                        {cls.grade}
                                    </span>
                                {:else}
                                    <span
                                        class="font-mono text-stone-700 text-xs"
                                        >--</span
                                    >
                                {/if}
                            </span>
                        </a>
                    {/each}
                </div>

                <!-- Mobile: cards -->
                <div class="md:hidden grid gap-[1px] bg-stone-800/50">
                    {#each classes as cls, i}
                        <a
                            href="/class/{cls.oid}?name={encodeURIComponent(
                                cls.name,
                            )}"
                            onclick={() => haptic.trigger("light")}
                            class="stagger-in block bg-stone-950 px-4 py-3.5 active:bg-stone-900 transition-colors duration-100"
                            style="animation-delay: {160 + i * 35}ms"
                        >
                            <div
                                class="flex items-start justify-between gap-3 mb-1.5"
                            >
                                <h3
                                    class="font-display font-600 text-sm text-stone-100 leading-snug"
                                >
                                    {cls.name}
                                </h3>
                                {#if cls.grade}
                                    <span
                                        class="shrink-0 px-2 py-0.5 font-mono text-xs font-600 {gradeColor(
                                            cls.grade,
                                        )} {gradeBg(
                                            cls.grade,
                                        )} border {gradeBorder(cls.grade)}"
                                    >
                                        {cls.grade}
                                    </span>
                                {:else}
                                    <span
                                        class="shrink-0 font-mono text-stone-700 text-xs"
                                        >--</span
                                    >
                                {/if}
                            </div>
                            <div
                                class="flex items-center gap-2 text-[11px] text-stone-500"
                            >
                                <span>{cls.teacher}</span>
                                <span class="text-stone-700">·</span>
                                <span>Rm {cls.room}</span>
                                <span class="text-stone-700">·</span>
                                <span class="font-mono text-stone-600"
                                    >{cls.term}</span
                                >
                            </div>
                        </a>
                    {/each}
                </div>

                {#if !classes.length}
                    <div class="py-24 text-center">
                        <p class="text-stone-600 font-mono text-sm">
                            No classes found
                        </p>
                    </div>
                {/if}
            </section>
        {:else if tab === "info"}
            <section class="py-8">
                <div class="border border-stone-800">
                    <div
                        class="px-5 py-3 bg-stone-900 border-b border-stone-800"
                    >
                        <h2
                            class="text-[11px] font-mono font-500 text-stone-400 uppercase tracking-wider"
                        >
                            Student Details
                        </h2>
                    </div>
                    <!-- Desktop: key-value rows -->
                    <div class="hidden md:block divide-y divide-stone-800/50">
                        {#each Object.entries(studentInfo) as [key, value], i}
                            <div
                                class="stagger-in px-5 py-3.5 flex items-start gap-6 hover:bg-stone-900/50 transition-colors duration-100"
                                style="animation-delay: {i * 30}ms"
                            >
                                <span
                                    class="text-[11px] font-mono text-stone-500 uppercase tracking-wider w-44 shrink-0 pt-0.5"
                                    >{key}</span
                                >
                                <span class="text-sm text-stone-200"
                                    >{value}</span
                                >
                            </div>
                        {/each}
                    </div>
                    <!-- Mobile: stacked -->
                    <div class="md:hidden divide-y divide-stone-800/50">
                        {#each Object.entries(studentInfo) as [key, value], i}
                            <div
                                class="stagger-in px-4 py-3"
                                style="animation-delay: {i * 30}ms"
                            >
                                <p
                                    class="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-1"
                                >
                                    {key}
                                </p>
                                <p class="text-sm text-stone-200">{value}</p>
                            </div>
                        {/each}
                    </div>
                    {#if !Object.keys(studentInfo).length}
                        <div class="py-16 text-center">
                            <p class="text-stone-600 font-mono text-sm">
                                No student info available
                            </p>
                        </div>
                    {/if}
                </div>
            </section>
        {:else if tab === "groups"}
            <section class="py-8">
                <div class="grid gap-[1px] bg-stone-800/50">
                    {#each groups as group, i}
                        <div
                            class="stagger-in bg-stone-950 px-4 md:px-5 py-3.5 text-sm text-stone-300"
                            style="animation-delay: {i * 40}ms"
                        >
                            {group.filter(Boolean).join(" · ")}
                        </div>
                    {/each}
                </div>
                {#if !groups.length}
                    <div class="py-24 text-center">
                        <p class="text-stone-600 font-mono text-sm">
                            No groups
                        </p>
                    </div>
                {/if}
            </section>
        {:else if tab === "calendar"}
            <section class="py-6 md:py-8">
                {#if calendarData}
                    {@const month = calendarData.month}
                    {@const events = calendarData.events}
                    {@const eventsByDate = events.reduce(
                        (map, e) => {
                            (map[e.date] = map[e.date] || []).push(e);
                            return map;
                        },
                        {} as Record<string, CalendarEvent[]>,
                    )}
                    {@const monthMatch = month.match(/(\w+),?\s*(\d{4})/)}
                    {@const monthNames = [
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                    ]}
                    {@const monthIdx = monthMatch
                        ? monthNames.indexOf(monthMatch[1])
                        : 0}
                    {@const year = monthMatch ? parseInt(monthMatch[2]) : 2026}
                    {@const firstDay = new Date(year, monthIdx, 1).getDay()}
                    {@const daysInMonth = new Date(
                        year,
                        monthIdx + 1,
                        0,
                    ).getDate()}
                    {@const today = new Date()}
                    {@const isCurrentMonth =
                        today.getFullYear() === year &&
                        today.getMonth() === monthIdx}

                    <!-- Month navigation -->
                    <div class="flex items-center justify-between mb-6">
                        <button
                            onclick={() => navCalendar("prev")}
                            disabled={calendarNav}
                            class="px-3 py-1.5 text-stone-500 hover:text-stone-200 transition-colors duration-150 cursor-pointer disabled:opacity-30"
                        >
                            <span class="text-xs font-mono">&larr; Prev</span>
                        </button>
                        <div class="text-center">
                            <h2
                                class="font-display font-600 text-lg text-stone-200"
                            >
                                {month || "Calendar"}
                            </h2>
                        </div>
                        <button
                            onclick={() => navCalendar("next")}
                            disabled={calendarNav}
                            class="px-3 py-1.5 text-stone-500 hover:text-stone-200 transition-colors duration-150 cursor-pointer disabled:opacity-30"
                        >
                            <span class="text-xs font-mono">Next &rarr;</span>
                        </button>
                    </div>

                    <!-- Calendar grid -->
                    <div
                        class="border border-stone-800 overflow-hidden {calendarNav
                            ? 'opacity-40'
                            : ''} transition-opacity duration-200"
                    >
                        <!-- Day headers -->
                        <div
                            class="grid grid-cols-7 bg-stone-900 border-b border-stone-800"
                        >
                            {#each ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as day}
                                <div
                                    class="py-2 text-center text-[10px] font-mono text-stone-500 uppercase tracking-wider"
                                >
                                    {day}
                                </div>
                            {/each}
                        </div>

                        <!-- Date cells -->
                        <div class="grid grid-cols-7">
                            {#each Array(firstDay) as _, i}
                                <div
                                    class="min-h-[70px] md:min-h-[90px] border-b border-r border-stone-800/40 bg-stone-950/50"
                                ></div>
                            {/each}
                            {#each Array(daysInMonth) as _, i}
                                {@const day = i + 1}
                                {@const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
                                {@const dayEvents = eventsByDate[dateStr] || []}
                                {@const isToday =
                                    isCurrentMonth && today.getDate() === day}
                                {@const isWeekend =
                                    (firstDay + i) % 7 === 0 ||
                                    (firstDay + i) % 7 === 6}
                                <div
                                    class="min-h-[70px] md:min-h-[90px] border-b border-r border-stone-800/40 p-1 md:p-1.5 {isWeekend
                                        ? 'bg-stone-950/50'
                                        : 'bg-stone-950'} hover:bg-stone-900/40 transition-colors duration-100 group"
                                >
                                    <div
                                        class="flex items-center justify-between mb-0.5"
                                    >
                                        <span
                                            class="text-[11px] font-mono {isToday
                                                ? 'text-amber-accent font-700'
                                                : 'text-stone-500'} {isToday
                                                ? 'bg-amber-accent/10 px-1.5 py-0.5'
                                                : ''}">{day}</span
                                        >
                                        {#if dayEvents.length > 0}
                                            <span
                                                class="hidden md:inline text-[9px] font-mono text-stone-700"
                                                >{dayEvents.length}</span
                                            >
                                        {/if}
                                    </div>
                                    <div class="space-y-0.5">
                                        {#each dayEvents.slice(0, 3) as event}
                                            <div
                                                class="px-1 py-0.5 text-[9px] md:text-[10px] leading-tight truncate {event.type ===
                                                'assignment'
                                                    ? 'text-sage bg-sage/8'
                                                    : 'text-amber-accent bg-amber-accent/8'}"
                                                title="{event.name} — {event.section}"
                                            >
                                                {event.name}
                                            </div>
                                        {/each}
                                        {#if dayEvents.length > 3}
                                            <div
                                                class="text-[9px] font-mono text-stone-600 px-1"
                                            >
                                                +{dayEvents.length - 3} more
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                            {#each Array((7 - ((firstDay + daysInMonth) % 7)) % 7) as _}
                                <div
                                    class="min-h-[70px] md:min-h-[90px] border-b border-r border-stone-800/40 bg-stone-950/50"
                                ></div>
                            {/each}
                        </div>
                    </div>

                    <!-- Event list below calendar -->
                    {#if events.length}
                        <div class="mt-6 overflow-hidden">
                            <h3
                                class="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-3"
                            >
                                Events this month
                            </h3>
                            <div class="grid gap-[1px] bg-stone-800/50">
                                {#each events as event, i}
                                    <div
                                        class="stagger-in bg-stone-950 px-4 md:px-5 py-3 flex items-start gap-3 min-w-0"
                                        style="animation-delay: {i * 25}ms"
                                    >
                                        <span
                                            class="w-1.5 h-1.5 mt-1.5 shrink-0 {event.type ===
                                            'assignment'
                                                ? 'bg-sage'
                                                : 'bg-amber-accent'}"
                                        ></span>
                                        <div class="min-w-0 flex-1">
                                            <div
                                                class="text-sm text-stone-200 font-500 truncate"
                                            >
                                                {event.name}
                                            </div>
                                            <div
                                                class="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-stone-500 min-w-0"
                                            >
                                                <span class="shrink-0"
                                                    >{event.date}</span
                                                >
                                                {#if event.section}
                                                    <span
                                                        class="text-stone-700 shrink-0"
                                                        >·</span
                                                    >
                                                    <span class="truncate"
                                                        >{event.section}</span
                                                    >
                                                {/if}
                                            </div>
                                        </div>
                                        <span
                                            class="text-[9px] font-mono uppercase tracking-wider shrink-0 px-1.5 py-0.5 {event.type ===
                                            'assignment'
                                                ? 'text-sage bg-sage/10'
                                                : 'text-amber-accent bg-amber-accent/10'}"
                                            >{event.type}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if !events.length}
                        <div class="mt-6 py-12 text-center">
                            <p class="text-stone-600 font-mono text-sm">
                                No events this month
                            </p>
                        </div>
                    {/if}
                {:else}
                    <div class="py-24 text-center">
                        <p class="text-stone-600 font-mono text-sm">
                            No calendar data
                        </p>
                    </div>
                {/if}
            </section>
        {:else if tab === "transcript"}
            <section class="py-6 md:py-8">
                <!-- Sub-tabs -->
                <div class="flex gap-0 mb-6 border-b border-stone-800">
                    {#each [{ key: "courses", label: "Courses" }, { key: "graduation", label: "Graduation" }] as st}
                        <button
                            onclick={() => { haptic.trigger("selection"); transcriptSubTab = st.key as TranscriptSubTab; }}
                            class="relative px-4 py-2.5 text-xs font-mono transition-colors duration-150 {transcriptSubTab === st.key ? 'text-stone-100' : 'text-stone-500 hover:text-stone-300'}"
                        >
                            {st.label}
                            {#if transcriptSubTab === st.key}
                                <div class="absolute bottom-0 left-0 right-0 h-px bg-stone-100"></div>
                            {/if}
                        </button>
                    {/each}
                </div>

                {#if transcriptSubTab === "courses"}
                    {#if transcript && transcript.length}
                        {@const byYear = transcript.reduce((map, e) => {
                            const key = e.year + ' — Grade ' + e.grade;
                            (map[key] = map[key] || []).push(e);
                            return map;
                        }, {} as Record<string, TranscriptEntry[]>)}
                        {@const totalCredits = transcript.reduce((s, e) => s + parseFloat(e.credit || '0'), 0)}

                        <!-- Summary -->
                        <div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 md:gap-6 text-xs font-mono text-stone-500">
                            <span>{transcript.length} course{transcript.length !== 1 ? 's' : ''}</span>
                            <span class="text-stone-700">·</span>
                            <span>{totalCredits} credits</span>
                            <span class="text-stone-700">·</span>
                            <span>{Object.keys(byYear).length} year{Object.keys(byYear).length !== 1 ? 's' : ''}</span>
                        </div>

                        <div class="space-y-6">
                            {#each Object.entries(byYear) as [yearLabel, courses], yi}
                                <div class="stagger-in" style="animation-delay: {yi * 80}ms">
                                    <!-- Year header -->
                                    <div class="flex items-center gap-3 mb-3">
                                        <h3 class="text-[11px] font-mono font-600 text-stone-400 uppercase tracking-wider whitespace-nowrap">{yearLabel}</h3>
                                        <div class="h-px flex-1 bg-stone-800/60"></div>
                                        <span class="text-[10px] font-mono text-stone-600">{courses.reduce((s, c) => s + parseFloat(c.credit || '0'), 0)} cr</span>
                                    </div>

                                    <!-- Desktop table -->
                                    <div class="hidden md:block border border-stone-800">
                                        <div class="grid grid-cols-[1fr_80px_80px] gap-0 px-5 py-2.5 bg-stone-900 border-b border-stone-800 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                                            <span>Course</span>
                                            <span class="text-right">Final</span>
                                            <span class="text-right">Credit</span>
                                        </div>
                                        {#each courses as entry, i}
                                            <div
                                                class="stagger-in grid grid-cols-[1fr_80px_80px] gap-0 px-5 py-3 border-b border-stone-800/40 hover:bg-stone-900/40 transition-colors duration-100"
                                                style="animation-delay: {yi * 80 + i * 25}ms"
                                            >
                                                <span class="text-sm text-stone-200 font-500 truncate pr-4">{entry.course}</span>
                                                <span class="text-right self-center">
                                                    {#if entry.finalGrade}
                                                        <span class="inline-block whitespace-nowrap px-2 py-0.5 font-mono text-xs font-600 {gradeColor(entry.finalGrade)} {gradeBg(entry.finalGrade)} border {gradeBorder(entry.finalGrade)}">{entry.finalGrade}</span>
                                                    {:else}
                                                        <span class="font-mono text-stone-700 text-xs">—</span>
                                                    {/if}
                                                </span>
                                                <span class="text-right text-xs font-mono text-stone-400 self-center">{entry.credit}</span>
                                            </div>
                                        {/each}
                                    </div>

                                    <!-- Mobile cards -->
                                    <div class="md:hidden grid gap-[1px] bg-stone-800/50">
                                        {#each courses as entry, i}
                                            <div
                                                class="stagger-in bg-stone-950 px-4 py-3.5"
                                                style="animation-delay: {yi * 80 + i * 25}ms"
                                            >
                                                <div class="flex items-start justify-between gap-3 mb-1.5">
                                                    <span class="text-sm text-stone-200 font-500 leading-snug">{entry.course}</span>
                                                    {#if entry.finalGrade}
                                                        <span class="shrink-0 whitespace-nowrap px-2 py-0.5 font-mono text-xs font-600 {gradeColor(entry.finalGrade)} {gradeBg(entry.finalGrade)} border {gradeBorder(entry.finalGrade)}">{entry.finalGrade}</span>
                                                    {:else}
                                                        <span class="shrink-0 font-mono text-stone-700 text-xs">—</span>
                                                    {/if}
                                                </div>
                                                <div class="text-[11px] font-mono text-stone-500">
                                                    {entry.credit} credits
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else if transcript && !transcript.length}
                        <div class="py-24 text-center">
                            <p class="text-stone-600 font-mono text-sm">No transcript records</p>
                        </div>
                    {:else}
                        <div class="py-24 text-center">
                            <p class="text-stone-600 font-mono text-sm">No transcript data</p>
                        </div>
                    {/if}
                {:else if transcriptSubTab === "graduation"}
                    {#if graduation}
                        {@const pctNum = graduation.requiredTotal && graduation.completedTotal
                            ? Math.round((parseFloat(graduation.completedTotal) / parseFloat(graduation.requiredTotal)) * 100)
                            : 0}

                        <!-- Program header -->
                        <div class="stagger-in mb-8">
                            <p class="text-[10px] font-mono text-amber-accent uppercase tracking-widest mb-3">Graduation Progress</p>
                            <h2 class="font-display font-700 text-xl md:text-2xl text-stone-50 tracking-tight mb-4">{graduation.program || 'Graduation Summary'}</h2>

                            <!-- Progress bar -->
                            <div class="mb-4">
                                <div class="flex items-baseline justify-between mb-2">
                                    <span class="text-xs font-mono text-stone-500">{graduation.completedTotal} / {graduation.requiredTotal} credits</span>
                                    <span class="text-xs font-mono font-600 {pctNum >= 100 ? 'text-sage' : pctNum >= 50 ? 'text-amber-accent' : 'text-stone-400'}">{pctNum}%</span>
                                </div>
                                <div class="h-[6px] bg-stone-800 overflow-hidden">
                                    <div
                                        class="h-full transition-all duration-1000 ease-out {pctNum >= 100 ? 'bg-sage' : pctNum >= 50 ? 'bg-amber-accent' : 'bg-stone-500'}"
                                        style="width: {pctNum}%"
                                    ></div>
                                </div>
                            </div>
                        </div>

                        <!-- Requirements grid -->
                        {#if graduation.requirements.length}
                            <div class="grid gap-[1px] bg-stone-800/50">
                                {#each graduation.requirements as req, i}
                                    {@const pct = parseInt(req.status) || 0}
                                    {@const isComplete = pct >= 100}
                                    <div
                                        class="stagger-in bg-stone-950 px-4 md:px-5 py-4 group"
                                        style="animation-delay: {i * 30}ms"
                                    >
                                        <div class="flex items-start justify-between gap-3 mb-2">
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-2 mb-0.5">
                                                    <span class="text-[10px] font-mono text-stone-600 uppercase tracking-wider shrink-0">{req.code}</span>
                                                    {#if isComplete}
                                                        <span class="text-[9px] font-mono text-sage bg-sage/10 px-1.5 py-0.5 shrink-0">DONE</span>
                                                    {/if}
                                                </div>
                                                <h4 class="text-sm text-stone-200 font-500 leading-snug">{req.description}</h4>
                                            </div>
                                            <span class="shrink-0 whitespace-nowrap px-2 py-0.5 font-mono text-xs font-600 {isComplete ? 'text-sage bg-sage/5 border border-sage/20' : pct > 0 ? 'text-amber-accent bg-amber-accent/5 border border-amber-accent/20' : 'text-stone-500 bg-stone-800/30 border border-stone-800'}">
                                                {req.status || '0%'}
                                            </span>
                                        </div>

                                        <!-- Mini progress bar -->
                                        <div class="flex items-center gap-3">
                                            <div class="flex-1 h-[3px] bg-stone-800 overflow-hidden">
                                                <div
                                                    class="h-full transition-all duration-700 ease-out {isComplete ? 'bg-sage' : pct > 0 ? 'bg-amber-accent' : 'bg-stone-700'}"
                                                    style="width: {pct}%; transition-delay: {i * 30 + 200}ms"
                                                ></div>
                                            </div>
                                            <span class="text-[10px] font-mono text-stone-600 whitespace-nowrap shrink-0">
                                                {req.completed || '0'} / {req.required || '0'}
                                            </span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="py-12 text-center">
                                <p class="text-stone-600 font-mono text-sm">No graduation requirements found</p>
                            </div>
                        {/if}
                    {:else}
                        <div class="py-24 text-center">
                            <p class="text-stone-600 font-mono text-sm">No graduation data</p>
                        </div>
                    {/if}
                {/if}
            </section>

        {:else if tab === "reports"}
            <section class="py-8">
                {#if reports && reports.length}
                    <div class="border border-stone-800">
                        <div
                            class="px-5 py-3 bg-stone-900 border-b border-stone-800"
                        >
                            <h2
                                class="text-[11px] font-mono font-500 text-stone-400 uppercase tracking-wider"
                            >
                                Published Reports
                            </h2>
                        </div>
                        {#each reports as report, i}
                            <a
                                href="/api/reports?oid={encodeURIComponent(
                                    report.oid,
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="stagger-in flex items-start gap-4 px-5 py-4 border-b border-stone-800/40 hover:bg-stone-900/50 transition-colors duration-100 group"
                                style="animation-delay: {i * 40}ms"
                            >
                                <!-- PDF icon -->
                                <div
                                    class="shrink-0 w-9 h-11 bg-terracotta/10 border border-terracotta/20 flex items-center justify-center mt-0.5"
                                >
                                    <span
                                        class="text-[9px] font-mono font-700 text-terracotta uppercase"
                                        >PDF</span
                                    >
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div
                                        class="text-sm text-stone-200 font-500 group-hover:text-stone-50 transition-colors truncate"
                                    >
                                        {report.name}
                                    </div>
                                    {#if report.description}
                                        <div
                                            class="text-xs text-stone-500 mt-0.5 truncate"
                                        >
                                            {report.description}
                                        </div>
                                    {/if}
                                    <div
                                        class="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-stone-600"
                                    >
                                        {#if report.date}
                                            <span>{report.date}</span>
                                        {/if}
                                        {#if report.creator}
                                            <span class="text-stone-700">·</span
                                            >
                                            <span>{report.creator}</span>
                                        {/if}
                                        {#if report.size}
                                            <span class="text-stone-700">·</span
                                            >
                                            <span>{report.size}</span>
                                        {/if}
                                    </div>
                                </div>
                                <!-- Download arrow -->
                                <div
                                    class="shrink-0 self-center text-stone-700 group-hover:text-stone-400 transition-colors"
                                >
                                    <svg
                                        class="w-4 h-4"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        ><path d="M12 5v14M5 12l7 7 7-7" /></svg
                                    >
                                </div>
                            </a>
                        {/each}
                    </div>
                {:else}
                    <div class="py-24 text-center">
                        <p class="text-stone-600 font-mono text-sm">
                            No published reports
                        </p>
                    </div>
                {/if}
            </section>
        {:else if tab === "locker"}
            <section class="py-8">
                <div class="grid gap-[1px] bg-stone-800/50">
                    {#each locker as file, i}
                        <div
                            class="stagger-in bg-stone-950 px-4 md:px-5 py-3.5 text-sm text-stone-300 flex items-center gap-3"
                            style="animation-delay: {i * 40}ms"
                        >
                            <span class="text-[10px] text-stone-600">▤</span>
                            {file.filter(Boolean).join(" · ")}
                        </div>
                    {/each}
                </div>
                {#if !locker.length}
                    <div class="py-24 text-center">
                        <p class="text-stone-600 font-mono text-sm">
                            Locker is empty
                        </p>
                    </div>
                {/if}
            </section>
        {:else if tab === "about"}
            <section class="py-10 md:py-16 max-w-[600px]">
                <!-- Hero -->
                <div class="stagger-in mb-16 md:mb-20">
                    <p
                        class="text-[10px] font-mono text-amber-accent uppercase tracking-widest mb-4"
                    >
                        About
                    </p>
                    <h2
                        class="font-brand font-800 text-2xl md:text-3xl text-stone-50 tracking-tight leading-tight mb-5"
                    >
                        MyEd costs $95.4M.<br />This costs $0.
                    </h2>
                    <p class="text-stone-500 text-sm leading-relaxed">
                        BETTER-MYED reverse-engineers the Aspen servlet and
                        wraps it in an interface that actually works. Your
                        grades, assignments, attendance, and schedule — without
                        using MyEd.
                    </p>
                </div>

                <!-- Why this exists -->
                <div
                    class="stagger-in mb-14 md:mb-18"
                    style="animation-delay: 60ms"
                >
                    <div class="flex items-center gap-4 mb-6">
                        <span
                            class="font-mono text-[10px] text-stone-700 uppercase tracking-widest"
                            >01</span
                        >
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3
                        class="font-display font-600 text-stone-200 text-base mb-4"
                    >
                        Why this exists
                    </h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-4">
                        The BC government spent <span class="text-stone-300"
                            >$95.4 million</span
                        > on MyEducation BC (Follett Aspen). What they shipped is
                        (probably more than) a decade-old Java Struts app with server-rendered
                        HTML tables, no mobile support, and a UI that looks like it
                        was last updated when Internet Explorer 6 was the standard.
                    </p>
                    <p class="text-stone-500 text-sm leading-relaxed mb-4">
                        It barely functions on desktop — on mobile, it's
                        completely unusable, as it is not responsive.
                    </p>
                    <p
                        class="text-stone-600 text-xs leading-relaxed mb-6 italic"
                    >
                        For reference, ArriveCAN — a national app — was $60
                        million.
                    </p>
                    <div class="grid grid-cols-3 gap-[1px] bg-stone-800/40">
                        <div class="bg-stone-950 p-4">
                            <p
                                class="font-mono font-700 text-lg text-amber-accent mb-1"
                            >
                                $95.4M
                            </p>
                            <p
                                class="text-[10px] font-mono text-stone-600 uppercase tracking-wider"
                            >
                                Taxpayer cost
                            </p>
                        </div>
                        <div class="bg-stone-950 p-4">
                            <p
                                class="font-mono font-700 text-lg text-stone-200 mb-1"
                            >
                                0
                            </p>
                            <p
                                class="text-[10px] font-mono text-stone-600 uppercase tracking-wider"
                            >
                                Mobile support
                            </p>
                        </div>
                        <div class="bg-stone-950 p-4">
                            <p
                                class="font-mono font-700 text-lg text-stone-200 mb-1"
                            >
                                0
                            </p>
                            <p
                                class="text-[10px] font-mono text-stone-600 uppercase tracking-wider"
                            >
                                Public API
                            </p>
                        </div>
                    </div>
                </div>

                <!-- How it works -->
                <div
                    class="stagger-in mb-14 md:mb-18"
                    style="animation-delay: 120ms"
                >
                    <div class="flex items-center gap-4 mb-6">
                        <span
                            class="font-mono text-[10px] text-stone-700 uppercase tracking-widest"
                            >02</span
                        >
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3
                        class="font-display font-600 text-stone-200 text-base mb-4"
                    >
                        How it works
                    </h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-6">
                        Your credentials authenticate directly with MyEd's REST
                        API. No middleman databases, no data storage. Everything
                        is proxied server-side and parsed in real-time.
                    </p>
                    <div class="border border-stone-800">
                        {#each [{ step: "01", text: "Credentials hit MyEd's REST API → JWT" }, { step: "02", text: "JWT exchanged for a Struts session via SSO" }, { step: "03", text: "SvelteKit routes proxy requests, parse HTML → JSON" }, { step: "04", text: "Frontend never talks to MyEd directly — no CORS" }] as item, i}
                            <div
                                class="flex items-start gap-4 px-4 py-3.5 {i < 3
                                    ? 'border-b border-stone-800/50'
                                    : ''}"
                            >
                                <span
                                    class="font-mono text-[10px] text-amber-dim mt-0.5 shrink-0"
                                    >{item.step}</span
                                >
                                <span class="text-sm text-stone-400"
                                    >{item.text}</span
                                >
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Stack -->
                <div
                    class="stagger-in mb-14 md:mb-18"
                    style="animation-delay: 180ms"
                >
                    <div class="flex items-center gap-4 mb-6">
                        <span
                            class="font-mono text-[10px] text-stone-700 uppercase tracking-widest"
                            >03</span
                        >
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3
                        class="font-display font-600 text-stone-200 text-base mb-4"
                    >
                        Stack
                    </h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-5">
                        No database. Sessions in httpOnly cookies, credentials
                        encrypted with AES-256-GCM.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        {#each ["SvelteKit", "Svelte 5", "Tailwind v4", "Bun", "Cheerio", "AES-256-GCM"] as tech}
                            <span
                                class="px-3 py-1.5 border border-stone-800 text-[11px] font-mono text-stone-500 hover:border-stone-700 hover:text-stone-300 transition-colors duration-150"
                            >
                                {tech}
                            </span>
                        {/each}
                    </div>
                </div>

                <!-- Disclaimer -->
                <div
                    class="stagger-in mb-14 md:mb-18"
                    style="animation-delay: 240ms"
                >
                    <div class="flex items-center gap-4 mb-6">
                        <span
                            class="font-mono text-[10px] text-stone-700 uppercase tracking-widest"
                            >04</span
                        >
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3
                        class="font-display font-600 text-stone-200 text-base mb-4"
                    >
                        Disclaimer
                    </h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-3">
                        Not affiliated with the BC Ministry of Education,
                        Follett, or MyEducation BC. This is an independent
                        wrapper that uses your own credentials to access your
                        own data. Credentials are encrypted at rest and never
                        stored in plaintext.
                    </p>
                    <p class="text-stone-600 text-xs italic">
                        Pls don't block this, Aspen (you may use the code tho
                        lol).
                    </p>
                </div>

                <!-- Credit -->
                <div class="stagger-in" style="animation-delay: 300ms">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <div
                        class="flex flex-col md:flex-row md:items-center justify-between gap-5"
                    >
                        <div>
                            <h3
                                class="font-display font-600 text-stone-200 text-base mb-1"
                            >
                                Built by Jude Kim
                            </h3>
                            <p class="text-stone-600 text-xs">
                                Because students deserve better.
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <a
                                href="https://judekim.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-3 py-1.5 border border-stone-800 text-[11px] font-mono text-stone-500 hover:border-amber-accent hover:text-amber-accent transition-colors duration-150"
                            >
                                Website
                            </a>
                            <a
                                href="https://github.com/judekim0507/better-myed"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-3 py-1.5 border border-stone-800 text-[11px] font-mono text-stone-500 hover:border-amber-accent hover:text-amber-accent transition-colors duration-150"
                            >
                                GitHub
                            </a>
                            <a
                                href="https://judekim.com/support"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-3 py-1.5 border border-amber-accent/30 bg-amber-accent/5 text-[11px] font-mono text-amber-accent hover:bg-amber-accent/10 hover:border-amber-accent/50 transition-colors duration-150"
                            >
                                Support
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        {/if}
        </div>
        {/if}
    </main>
</div>

<style>
    /* ---- Streak ---- */

    .streak-number {
        font-family: var(--font-mono);
        font-size: 2.25rem;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.05em;
    }

    /* Gradient text for 7+ */
    .streak-fire {
        background: linear-gradient(
            180deg,
            #ffcc00 0%,
            #ff8c00 50%,
            #ff4400 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    /* Ambient glow */
    .streak-glow {
        position: absolute;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -55%);
        width: 100px;
        height: 100px;
        background: radial-gradient(
            circle,
            rgba(255, 150, 0, 0.03) 0%,
            transparent 70%
        );
        pointer-events: none;
        transition: all 0.6s ease;
    }
    .streak-glow-hot {
        width: 140px;
        height: 140px;
        background: radial-gradient(
            circle,
            rgba(255, 150, 0, 0.1) 0%,
            rgba(255, 68, 0, 0.04) 50%,
            transparent 70%
        );
        animation: glowPulse 3s ease-in-out infinite;
    }

    @keyframes glowPulse {
        0%,
        100% {
            opacity: 0.6;
            transform: translate(-50%, -55%) scale(1);
        }
        50% {
            opacity: 1;
            transform: translate(-50%, -55%) scale(1.1);
        }
    }

    /* ---- Flame SVG ---- */

    .streak-flame-wrap {
        opacity: 0.12;
        filter: saturate(0);
        transition:
            opacity 0.5s ease,
            filter 0.5s ease;
    }
    .streak-flame-lit {
        opacity: 1;
        filter: saturate(1);
    }

    .streak-flame {
        filter: drop-shadow(0 2px 10px rgba(255, 107, 0, 0.35));
    }
    .streak-flame-lit .streak-flame {
        animation: flameFlicker 2.5s ease-in-out infinite;
    }

    @keyframes flameFlicker {
        0%,
        100% {
            transform: scaleX(1) scaleY(1) rotate(0deg);
        }
        20% {
            transform: scaleX(0.97) scaleY(1.02) rotate(-0.5deg);
        }
        40% {
            transform: scaleX(1.01) scaleY(0.98) rotate(0.5deg);
        }
        60% {
            transform: scaleX(0.98) scaleY(1.015) rotate(-0.3deg);
        }
        80% {
            transform: scaleX(1.01) scaleY(0.99) rotate(0.3deg);
        }
    }

    /* Flame layers breathe independently */
    .flame-outer {
        animation: flameBreathOuter 2s ease-in-out infinite alternate;
        transform-origin: center bottom;
    }
    @keyframes flameBreathOuter {
        0% {
            opacity: 0.92;
        }
        100% {
            opacity: 1;
        }
    }

    .flame-inner {
        animation: flameBreathInner 1.4s ease-in-out infinite alternate;
        transform-origin: center bottom;
    }
    @keyframes flameBreathInner {
        0% {
            opacity: 0.88;
            transform: scaleY(1);
        }
        100% {
            opacity: 1;
            transform: scaleY(1.03);
        }
    }

    .flame-core {
        animation: flameCoreGlow 0.9s ease-in-out infinite alternate;
        transform-origin: center bottom;
    }
    @keyframes flameCoreGlow {
        0% {
            opacity: 0.85;
        }
        100% {
            opacity: 1;
        }
    }

    /* Dot bloom */
    .streak-dot-active {
        box-shadow: 0 0 5px rgba(255, 150, 0, 0.3);
    }
</style>
