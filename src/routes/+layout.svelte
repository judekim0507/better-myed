<script lang="ts">
    import "./layout.css";
    import { dev } from "$app/environment";
    import { injectAnalytics } from "@vercel/analytics/sveltekit";

    injectAnalytics({ mode: dev ? "development" : "production" });

    let { children } = $props();
</script>

<svelte:head>
    <title>BETTER-MYED — A Faster MyEducation BC Interface</title>
    <meta
        name="description"
        content="A faster, cleaner interface for MyEducation BC (MyEd). Check grades, transcript, graduation progress, assignments, attendance, and report cards — beautifully redesigned for students."
    />
    <meta name="keywords" content="MyEducation BC, MyEd, Better MyEd, BC student portal, grades, transcript, graduation, report cards, assignments, attendance, schedule" />
    <meta property="og:title" content="BETTER-MYED — A Faster MyEducation BC Interface" />
    <meta
        property="og:description"
        content="A faster, cleaner interface for MyEducation BC. Check grades, transcript, graduation progress, and report cards — beautifully redesigned."
    />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/og.png" />
    <meta property="og:site_name" content="BETTER-MYED" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="BETTER-MYED — A Faster MyEducation BC Interface" />
    <meta
        name="twitter:description"
        content="A faster, cleaner interface for MyEducation BC. Check grades, transcript, graduation progress, and report cards."
    />
    <meta name="twitter:image" content="/og.png" />
</svelte:head>
{@render children()}

<footer class="relative bg-stone-950 pt-6 pb-8">
    <div class="max-w-6xl mx-auto px-4 md:px-6">
        <div
            class="h-px bg-gradient-to-r from-transparent via-stone-800 to-transparent mb-6"
        ></div>
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 text-[11px] text-stone-600">
                <a
                    href="https://judekim.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono tracking-wide hover:text-amber-accent transition-colors duration-200"
                >
                    Jude Kim
                </a>
                <span class="text-stone-800">—</span>
                <span
                    class="text-stone-700 font-mono tracking-wider text-[10px]"
                    >2026</span
                >
            </div>
            <a
                href="https://github.com/judekim0507/better-myed"
                target="_blank"
                rel="noopener noreferrer"
                class="text-stone-700 hover:text-amber-accent transition-colors duration-200"
            >
                <svg
                    class="w-3.5 h-3.5"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                    />
                </svg>
            </a>
        </div>
    </div>
</footer>
