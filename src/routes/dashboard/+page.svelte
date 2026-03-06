<script lang="ts">
    import { onMount } from "svelte";

    interface ClassInfo {
        oid: string;
        name: string;
        term: string;
        teacher: string;
        room: string;
        grade: string | null;
    }

    type Tab = "home" | "info" | "groups" | "calendar" | "locker" | "about";

    const tabs: { key: Tab; label: string }[] = [
        { key: "home", label: "Overview" },
        { key: "info", label: "Profile" },
        { key: "groups", label: "Groups" },
        { key: "calendar", label: "Calendar" },
        { key: "locker", label: "Locker" },
        { key: "about", label: "About" },
    ];

    let classes = $state<ClassInfo[]>([]);
    let loading = $state(true);
    let tab = $state<Tab>("home");
    let studentInfo = $state<Record<string, string>>({});
    let groups = $state<string[][]>([]);
    let calendar = $state<string[]>([]);
    let locker = $state<string[][]>([]);
    let tabLoading = $state(false);

    onMount(async () => {
        const res = await fetch("/api/classes");
        if (!res.ok) {
            window.location.href = "/";
            return;
        }
        classes = await res.json();
        loading = false;
    });

    async function loadTab(t: Tab) {
        if (tab === t) return;
        tab = t;
        tabLoading = true;
        try {
            if (t === "info" && !Object.keys(studentInfo).length) {
                const res = await fetch("/api/student");
                if (res.ok) studentInfo = await res.json();
            } else if (t === "groups" && !groups.length) {
                const res = await fetch("/api/groups");
                if (res.ok) groups = await res.json();
            } else if (t === "calendar" && !calendar.length) {
                const res = await fetch("/api/calendar");
                if (res.ok) calendar = await res.json();
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

<div class="min-h-screen bg-stone-950 text-stone-100 page-enter">
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
                    window.location.href = "/";
                }}
                class="text-[11px] font-mono text-stone-500 uppercase tracking-wider hover:text-stone-300 transition-colors duration-150 cursor-pointer"
            >
                Sign out
            </button>
        </div>
    </header>

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
            <section class="pt-10 pb-8 md:pt-14 md:pb-10 border-b border-stone-800/50">
                <div class="h-3 w-24 bg-stone-900 skeleton mb-4"></div>
                <div class="h-7 w-48 bg-stone-900 skeleton mb-3"></div>
                <div class="h-3.5 w-36 bg-stone-900 skeleton" style="animation-delay: 100ms"></div>
            </section>
            <section class="py-6 border-b border-stone-800/50">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-stone-800/40">
                    {#each Array(4) as _, i}
                        <div class="bg-stone-950 p-4 md:p-5">
                            <div class="h-2.5 w-14 bg-stone-900 skeleton mb-3" style="animation-delay: {i * 50}ms"></div>
                            <div class="h-6 w-10 bg-stone-900 skeleton" style="animation-delay: {i * 50 + 25}ms"></div>
                        </div>
                    {/each}
                </div>
            </section>
            <section class="py-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="h-2.5 w-16 bg-stone-900 skeleton"></div>
                </div>
                <div class="hidden md:block border border-stone-800">
                    <div class="px-5 py-3 bg-stone-900 border-b border-stone-800">
                        <div class="h-2.5 w-full bg-stone-800 skeleton"></div>
                    </div>
                    {#each Array(5) as _, i}
                        <div class="px-5 py-4 border-b border-stone-800/40 flex items-center gap-6">
                            <div class="h-3.5 flex-1 bg-stone-900 skeleton" style="animation-delay: {i * 60}ms"></div>
                            <div class="h-3 w-24 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 20}ms"></div>
                            <div class="h-3 w-12 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 40}ms"></div>
                            <div class="h-5 w-10 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 60}ms"></div>
                        </div>
                    {/each}
                </div>
                <div class="md:hidden grid gap-[1px] bg-stone-800/50">
                    {#each Array(4) as _, i}
                        <div class="bg-stone-950 px-4 py-4 space-y-2.5">
                            <div class="flex items-center justify-between gap-4">
                                <div class="h-3.5 flex-1 bg-stone-900 skeleton" style="animation-delay: {i * 60}ms"></div>
                                <div class="h-5 w-10 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 30}ms"></div>
                            </div>
                            <div class="h-2.5 w-40 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 60}ms"></div>
                        </div>
                    {/each}
                </div>
            </section>
        {:else if tabLoading}
            <div class="py-24">
                <div class="w-32 h-[2px] mx-auto load-bar"></div>
            </div>
        {:else if tab === "home"}
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
                        {classes.length} class{classes.length !== 1 ? "es" : ""} this
                        term
                        {#if avgGrade !== null}
                            <span class="text-stone-700 mx-1">·</span>
                            <span class={gradeColor(String(avgGrade))}>
                                {avgGrade}% average
                            </span>
                        {/if}
                    </p>
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
                        class="grid grid-cols-[1fr_160px_80px_60px] gap-0 px-5 py-2.5 bg-stone-900 border-b border-stone-800 text-[10px] font-mono text-stone-500 uppercase tracking-wider"
                    >
                        <span>Course</span>
                        <span>Instructor</span>
                        <span>Room</span>
                        <span class="text-right">Grade</span>
                    </div>
                    {#each classes as cls, i}
                        <a
                            href="/class/{cls.oid}?name={encodeURIComponent(cls.name)}"
                            class="stagger-in grid grid-cols-[1fr_160px_80px_60px] gap-0 px-5 py-3.5 border-b border-stone-800/40 hover:bg-stone-900/50 transition-colors duration-100 group"
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
                                        class="inline-block px-2 py-0.5 font-mono text-xs font-600 {gradeColor(
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
                            href="/class/{cls.oid}?name={encodeURIComponent(cls.name)}"
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
            <section class="py-8">
                <div class="grid gap-[1px] bg-stone-800/50">
                    {#each calendar as event, i}
                        <div
                            class="stagger-in bg-stone-950 px-4 md:px-5 py-3.5 text-sm text-stone-300 flex items-center gap-3"
                            style="animation-delay: {i * 40}ms"
                        >
                            <span class="w-1 h-1 bg-amber-accent shrink-0"
                            ></span>
                            {event}
                        </div>
                    {/each}
                </div>
                {#if !calendar.length}
                    <div class="py-24 text-center">
                        <p class="text-stone-600 font-mono text-sm">
                            No upcoming events
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
                    <p class="text-[10px] font-mono text-amber-accent uppercase tracking-widest mb-4">About</p>
                    <h2 class="font-brand font-800 text-2xl md:text-3xl text-stone-50 tracking-tight leading-tight mb-5">
                        MyEd costs $95.4M.<br />This costs $0.
                    </h2>
                    <p class="text-stone-500 text-sm leading-relaxed">
                        BETTER-MYED reverse-engineers the Aspen servlet and wraps it in an interface that actually works. Your grades, assignments, attendance, and schedule — without using MyEd.
                    </p>
                </div>

                <!-- Why this exists -->
                <div class="stagger-in mb-14 md:mb-18" style="animation-delay: 60ms">
                    <div class="flex items-center gap-4 mb-6">
                        <span class="font-mono text-[10px] text-stone-700 uppercase tracking-widest">01</span>
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3 class="font-display font-600 text-stone-200 text-base mb-4">Why this exists</h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-4">
                        The BC government spent <span class="text-stone-300">$95.4 million</span> on MyEducation BC (Follett Aspen). What they shipped is (probably more than) a decade-old Java Struts app with server-rendered HTML tables, no mobile support, and a UI that looks like it was last updated when Internet Explorer 6 was the standard.
                    </p>
                    <p class="text-stone-500 text-sm leading-relaxed mb-4">
                        It barely functions on desktop — on mobile, it's completely unusable, as it is not responsive.
                    </p>
                    <p class="text-stone-600 text-xs leading-relaxed mb-6 italic">
                        For reference, ArriveCAN — a national app — was $60 million.
                    </p>
                    <div class="grid grid-cols-3 gap-[1px] bg-stone-800/40">
                        <div class="bg-stone-950 p-4">
                            <p class="font-mono font-700 text-lg text-amber-accent mb-1">$95.4M</p>
                            <p class="text-[10px] font-mono text-stone-600 uppercase tracking-wider">Taxpayer cost</p>
                        </div>
                        <div class="bg-stone-950 p-4">
                            <p class="font-mono font-700 text-lg text-stone-200 mb-1">0</p>
                            <p class="text-[10px] font-mono text-stone-600 uppercase tracking-wider">Mobile support</p>
                        </div>
                        <div class="bg-stone-950 p-4">
                            <p class="font-mono font-700 text-lg text-stone-200 mb-1">0</p>
                            <p class="text-[10px] font-mono text-stone-600 uppercase tracking-wider">Public API</p>
                        </div>
                    </div>
                </div>

                <!-- How it works -->
                <div class="stagger-in mb-14 md:mb-18" style="animation-delay: 120ms">
                    <div class="flex items-center gap-4 mb-6">
                        <span class="font-mono text-[10px] text-stone-700 uppercase tracking-widest">02</span>
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3 class="font-display font-600 text-stone-200 text-base mb-4">How it works</h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-6">
                        Your credentials authenticate directly with MyEd's REST API. No middleman databases, no data storage. Everything is proxied server-side and parsed in real-time.
                    </p>
                    <div class="border border-stone-800">
                        {#each [{ step: "01", text: "Credentials hit MyEd's REST API → JWT" }, { step: "02", text: "JWT exchanged for a Struts session via SSO" }, { step: "03", text: "SvelteKit routes proxy requests, parse HTML → JSON" }, { step: "04", text: "Frontend never talks to MyEd directly — no CORS" }] as item, i}
                            <div class="flex items-start gap-4 px-4 py-3.5 {i < 3 ? 'border-b border-stone-800/50' : ''}">
                                <span class="font-mono text-[10px] text-amber-dim mt-0.5 shrink-0">{item.step}</span>
                                <span class="text-sm text-stone-400">{item.text}</span>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Stack -->
                <div class="stagger-in mb-14 md:mb-18" style="animation-delay: 180ms">
                    <div class="flex items-center gap-4 mb-6">
                        <span class="font-mono text-[10px] text-stone-700 uppercase tracking-widest">03</span>
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3 class="font-display font-600 text-stone-200 text-base mb-4">Stack</h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-5">
                        No database. Sessions in httpOnly cookies, credentials encrypted with AES-256-GCM.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        {#each ["SvelteKit", "Svelte 5", "Tailwind v4", "Bun", "Cheerio", "AES-256-GCM"] as tech}
                            <span class="px-3 py-1.5 border border-stone-800 text-[11px] font-mono text-stone-500 hover:border-stone-700 hover:text-stone-300 transition-colors duration-150">
                                {tech}
                            </span>
                        {/each}
                    </div>
                </div>

                <!-- Disclaimer -->
                <div class="stagger-in mb-14 md:mb-18" style="animation-delay: 240ms">
                    <div class="flex items-center gap-4 mb-6">
                        <span class="font-mono text-[10px] text-stone-700 uppercase tracking-widest">04</span>
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <h3 class="font-display font-600 text-stone-200 text-base mb-4">Disclaimer</h3>
                    <p class="text-stone-500 text-sm leading-relaxed mb-3">
                        Not affiliated with the BC Ministry of Education, Follett, or MyEducation BC. This is an independent wrapper that uses your own credentials to access your own data. Credentials are encrypted at rest and never stored in plaintext.
                    </p>
                    <p class="text-stone-600 text-xs italic">
                        Pls don't block this, Aspen (you may use the code tho lol).
                    </p>
                </div>

                <!-- Credit -->
                <div class="stagger-in" style="animation-delay: 300ms">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="h-px flex-1 bg-stone-800/60"></div>
                    </div>
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div>
                            <h3 class="font-display font-600 text-stone-200 text-base mb-1">Built by Jude Kim</h3>
                            <p class="text-stone-600 text-xs">Because students deserve better.</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <a href="https://judekim.com" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 border border-stone-800 text-[11px] font-mono text-stone-500 hover:border-amber-accent hover:text-amber-accent transition-colors duration-150">
                                Website
                            </a>
                            <a href="https://github.com/judekim0507" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 border border-stone-800 text-[11px] font-mono text-stone-500 hover:border-amber-accent hover:text-amber-accent transition-colors duration-150">
                                GitHub
                            </a>
                            <a href="https://judekim.com/support" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 border border-amber-accent/30 bg-amber-accent/5 text-[11px] font-mono text-amber-accent hover:bg-amber-accent/10 hover:border-amber-accent/50 transition-colors duration-150">
                                Support
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        {/if}
    </main>
</div>
