<script lang="ts">
    import "./layout.css";
    import { dev } from "$app/environment";
    import { onNavigate } from "$app/navigation";
    import { injectAnalytics } from "@vercel/analytics/sveltekit";

    injectAnalytics({ mode: dev ? "development" : "production" });

    let { children } = $props();

    onNavigate((navigation) => {
        if (!document.startViewTransition) return;
        return new Promise((resolve) => {
            document.startViewTransition(async () => {
                resolve();
                await navigation.complete;
            });
        });
    });
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
        <div class="flex items-center justify-center">
            <div class="flex items-center gap-3 text-[11px] text-stone-600">
                <span class="font-mono tracking-wide">BETTER-MYED</span>
                <span class="text-stone-800">—</span>
                <span
                    class="text-stone-700 font-mono tracking-wider text-[10px]"
                    >2026</span
                >
            </div>
        </div>
    </div>
</footer>
