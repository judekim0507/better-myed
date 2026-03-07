<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { createWebHaptics } from 'web-haptics/svelte';
	import WhatIf from '$lib/WhatIf.svelte';

	const haptic = createWebHaptics();
	onDestroy(() => haptic.destroy());

	interface Assignment {
		name: string;
		due: string;
		pct: string;
		score: string;
		feedback: string;
	}

	interface AttendanceRecord {
		date: string;
		code: string;
		reason: string;
	}

	interface TermMark {
		category: string;
		terms: Record<string, string>;
	}

	interface ClassDetail {
		termMarks: TermMark[];
		finalGrade: string;
	}

	type Tab = 'overview' | 'attendance';

	let assignments = $state<Assignment[]>([]);
	let attendance = $state<AttendanceRecord[]>([]);
	let classDetail = $state<ClassDetail | null>(null);
	let loading = $state(true);
	let tabLoading = $state(false);
	let error = $state('');
	let tab = $state<Tab>('overview');

	let className = $state('');
	let whatIfOpen = $state(false);

	// Swipe gesture state
	let touchStartX = 0;
	let touchStartY = 0;
	let touchDeltaX = $state(0);
	let swiping = $state(false);
	const SWIPE_THRESHOLD = 50;
	const tabs: Tab[] = ['overview', 'attendance'];

	function onTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		touchDeltaX = 0;
		swiping = false;
	}

	function onTouchMove(e: TouchEvent) {
		const dx = e.touches[0].clientX - touchStartX;
		const dy = e.touches[0].clientY - touchStartY;
		// Only swipe if horizontal movement dominates
		if (!swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
			swiping = true;
		}
		if (swiping) {
			e.preventDefault();
			touchDeltaX = dx;
		}
	}

	function onTouchEnd() {
		if (swiping && Math.abs(touchDeltaX) > SWIPE_THRESHOLD) {
			const currentIdx = tabs.indexOf(tab);
			if (touchDeltaX < 0 && currentIdx < tabs.length - 1) {
				switchTab(tabs[currentIdx + 1]);
			} else if (touchDeltaX > 0 && currentIdx > 0) {
				switchTab(tabs[currentIdx - 1]);
			}
		}
		touchDeltaX = 0;
		swiping = false;
	}

	function pctColor(pct: string): string {
		if (!pct) return 'text-stone-600';
		const num = parseInt(pct);
		if (isNaN(num)) return 'text-stone-400';
		if (num >= 86) return 'text-sage';
		if (num >= 73) return 'text-amber-accent';
		if (num >= 50) return 'text-ochre';
		return 'text-terracotta';
	}

	function pctBg(pct: string): string {
		if (!pct) return 'bg-stone-800';
		const num = parseInt(pct);
		if (isNaN(num)) return 'bg-stone-800';
		if (num >= 86) return 'bg-sage/10';
		if (num >= 73) return 'bg-amber-accent/10';
		if (num >= 50) return 'bg-ochre/10';
		return 'bg-terracotta/10';
	}

	onMount(async () => {
		const url = new URL(window.location.href);
		className = url.searchParams.get('name') || '';

		const oid = $page.params.oid;
		const assignRes = await fetch(`/api/classes/${oid}/assignments`);
		if (!assignRes.ok) {
			error = 'Failed to load assignments';
			loading = false;
			return;
		}
		assignments = await assignRes.json();
		loading = false;

		// Fetch detail after assignments (class must be selected first)
		const detailRes = await fetch(`/api/classes/${oid}/detail`);
		if (detailRes.ok) {
			classDetail = await detailRes.json();
		}
	});

	async function switchTab(t: Tab) {
		if (tab === t) return;
		haptic.trigger('selection');
		tab = t;
		if (t === 'attendance' && !attendance.length) {
			tabLoading = true;
			try {
				const oid = $page.params.oid;
				const res = await fetch(`/api/classes/${oid}/attendance`);
				if (res.ok) attendance = await res.json();
			} finally {
				tabLoading = false;
			}
		}
	}
</script>

<svelte:head>
	{#if className}
		<title>{className} — BETTER-MYED</title>
	{/if}
</svelte:head>

<div class="min-h-screen bg-stone-950 text-stone-100 page-enter overflow-x-hidden">
	<!-- Header -->
	<header class="border-b border-stone-800/80">
		<div class="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4 min-w-0">
			<a
				href="/dashboard"
				class="flex items-center gap-2 text-stone-500 hover:text-stone-200 transition-colors duration-150 cursor-pointer press group shrink-0"
			>
				<span class="text-xs group-hover:-translate-x-0.5 transition-transform duration-150">←</span>
				<span class="text-[11px] font-mono uppercase tracking-wider">Back</span>
			</a>
			<div class="w-px h-4 bg-stone-800 shrink-0"></div>
			{#if className}
				<h1 class="font-display font-600 text-sm text-stone-200 truncate">{className}</h1>
			{:else}
				<h1 class="font-display font-600 text-sm text-stone-200">Class Detail</h1>
			{/if}
		</div>
	</header>

	<!-- Tabs -->
	<nav class="border-b border-stone-800/80 bg-stone-950 sticky top-0 z-10">
		<div class="max-w-6xl mx-auto px-4 md:px-6 flex items-center">
			{#each [{ key: 'overview', label: 'Overview' }, { key: 'attendance', label: 'Attendance' }] as t}
				<button
					onclick={() => switchTab(t.key as Tab)}
					class="relative press px-4 md:px-5 py-3.5 text-sm whitespace-nowrap transition-colors duration-150 cursor-pointer group
						{tab === t.key ? 'text-stone-100' : 'text-stone-500 hover:text-stone-300'}"
				>
					{t.label}
					<div
						class="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-accent transition-all duration-200
							{tab === t.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-20'}"
					></div>
				</button>
			{/each}
			{#if !loading && assignments.some((a) => a.score && a.score.includes('/'))}
				<button
					onclick={() => { haptic.trigger('medium'); whatIfOpen = true; }}
					class="ml-auto press px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-accent hover:text-amber-accent/80 transition-colors duration-150 cursor-pointer"
				>
					What If?
				</button>
			{/if}
		</div>
	</nav>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<main
		class="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 swipe-content"
		ontouchstart={onTouchStart}
		ontouchmove={onTouchMove}
		ontouchend={onTouchEnd}
		style="transform: translateX({swiping ? Math.max(-80, Math.min(80, touchDeltaX * 0.4)) : 0}px); transition: {swiping ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'};"
	>
		{#if loading || tabLoading}
			<!-- Skeleton loader -->
			<div class="space-y-0">
				<!-- Summary skeleton -->
				<div class="mb-6 flex items-center gap-4">
					<div class="h-3 w-24 bg-stone-900 skeleton"></div>
					<div class="h-3 w-16 bg-stone-900 skeleton" style="animation-delay: 50ms"></div>
					<div class="h-3 w-20 bg-stone-900 skeleton" style="animation-delay: 100ms"></div>
				</div>
				<!-- Table skeleton (desktop) -->
				<div class="hidden md:block border border-stone-800">
					<div class="px-5 py-3 bg-stone-900 border-b border-stone-800">
						<div class="h-2.5 w-full bg-stone-800 skeleton"></div>
					</div>
					{#each Array(6) as _, i}
						<div class="px-5 py-4 border-b border-stone-800/40 flex items-center gap-6">
							<div class="h-3 flex-1 bg-stone-900 skeleton" style="animation-delay: {i * 60}ms"></div>
							<div class="h-3 w-16 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 20}ms"></div>
							<div class="h-3 w-10 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 40}ms"></div>
						</div>
					{/each}
				</div>
				<!-- Card skeleton (mobile) -->
				<div class="md:hidden grid gap-[1px] bg-stone-800/50">
					{#each Array(5) as _, i}
						<div class="bg-stone-950 px-4 py-4 space-y-3">
							<div class="flex items-center justify-between gap-4">
								<div class="h-3.5 flex-1 bg-stone-900 skeleton" style="animation-delay: {i * 60}ms"></div>
								<div class="h-5 w-10 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 30}ms"></div>
							</div>
							<div class="h-2.5 w-28 bg-stone-900 skeleton" style="animation-delay: {i * 60 + 60}ms"></div>
						</div>
					{/each}
				</div>
			</div>
		{:else if error}
			<div class="py-24 text-center">
				<div class="inline-flex items-center gap-2 px-4 py-2 border border-terracotta/30 text-terracotta text-sm">
					<span class="w-1.5 h-1.5 bg-terracotta"></span>
					{error}
				</div>
			</div>
		{:else if tab === 'overview'}
			<!-- Term marks -->
			{#if classDetail && (classDetail.termMarks.length || classDetail.finalGrade)}
				{@const allTerms = [...new Set(classDetail.termMarks.flatMap((m) => Object.keys(m.terms)))]}
				{@const colTemplate = `1fr ${allTerms.map(() => '80px').join(' ')}`}

				<!-- Desktop table -->
				<div class="hidden md:block mb-6 border border-stone-800">
					<div class="grid gap-0 px-5 py-2.5 bg-stone-900 border-b border-stone-800 text-[10px] font-mono text-stone-500 uppercase tracking-wider" style="grid-template-columns: {colTemplate}">
						<span>Category</span>
						{#each allTerms as term}
							<span class="text-right">{term}</span>
						{/each}
					</div>
					{#each classDetail.termMarks as mark, i}
						<div
							class="stagger-in grid gap-0 px-5 py-3 border-b border-stone-800/40 hover:bg-stone-900/40 transition-colors duration-100 items-center"
							style="grid-template-columns: {colTemplate}; animation-delay: {i * 25}ms"
						>
							<span class="text-sm text-stone-200 font-500 truncate pr-4">{mark.category}</span>
							{#each allTerms as term}
								<span class="text-right">
									{#if mark.terms[term]}
										<span class="inline-block px-2 py-0.5 font-mono text-xs font-600 text-stone-200 bg-stone-800">{mark.terms[term]}</span>
									{:else}
										<span class="text-stone-700 font-mono text-xs">--</span>
									{/if}
								</span>
							{/each}
						</div>
					{/each}
					{#if classDetail.finalGrade}
						<div class="px-5 py-3 flex items-center justify-between">
							<span class="text-sm text-stone-400 font-500">Final Grade</span>
							<span class="px-2.5 py-1 font-mono text-sm font-600 text-amber-accent bg-amber-accent/10">{classDetail.finalGrade}</span>
						</div>
					{/if}
				</div>

				<!-- Mobile term marks -->
				<div class="md:hidden mb-6 border border-stone-800">
					<div class="px-4 py-2.5 bg-stone-900 border-b border-stone-800">
						<span class="text-[10px] font-mono font-500 text-stone-500 uppercase tracking-wider">Term Marks</span>
					</div>
					{#each classDetail.termMarks as mark, i}
						<div class="stagger-in px-4 py-3 border-b border-stone-800/40" style="animation-delay: {i * 25}ms">
							<span class="text-sm text-stone-200 font-500 block mb-2">{mark.category}</span>
							<div class="flex flex-wrap gap-2">
								{#each Object.entries(mark.terms) as [term, value]}
									<div class="flex items-center gap-1.5 bg-stone-900/60 px-2.5 py-1.5 border border-stone-800/60">
										<span class="text-[10px] font-mono text-stone-500 uppercase">{term}</span>
										<span class="text-xs font-mono font-600 text-stone-200">{value}</span>
									</div>
								{/each}
							</div>
						</div>
					{/each}
					{#if classDetail.finalGrade}
						<div class="px-4 py-3 flex items-center justify-between">
							<span class="text-sm text-stone-400 font-500">Final Grade</span>
							<span class="px-2.5 py-1 font-mono text-sm font-600 text-amber-accent bg-amber-accent/10">{classDetail.finalGrade}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Summary bar -->
			{#if assignments.length}
				{@const graded = assignments.filter((a) => a.pct && !isNaN(parseInt(a.pct)))}
				{@const avg = graded.length ? Math.round(graded.reduce((s, a) => s + parseInt(a.pct), 0) / graded.length) : null}
				<div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 md:gap-6 text-xs font-mono text-stone-500">
					<span>{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</span>
					<span class="text-stone-700">·</span>
					<span>{graded.length} graded</span>
					{#if avg !== null}
						<span class="text-stone-700">·</span>
						<span class="{pctColor(String(avg))}">avg {avg}%</span>
					{/if}
				</div>
			{/if}

			<!-- Desktop table -->
			<div class="hidden md:block border border-stone-800">
				<div class="grid grid-cols-[1fr_100px_70px_120px_1fr] gap-0 px-5 py-2.5 bg-stone-900 border-b border-stone-800 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
					<span>Assignment</span>
					<span>Due</span>
					<span class="text-right">%</span>
					<span class="text-right">Score</span>
					<span class="pl-5">Feedback</span>
				</div>

				{#each assignments as a, i}
					<div
						class="stagger-in grid grid-cols-[1fr_100px_70px_120px_1fr] gap-0 px-5 py-3 border-b border-stone-800/40 hover:bg-stone-900/40 transition-colors duration-100 group"
						style="animation-delay: {i * 25}ms"
					>
						<span class="text-sm text-stone-200 font-500 pr-4 truncate group-hover:text-stone-50 transition-colors duration-100">
							{a.name}
						</span>
						<span class="text-xs font-mono text-stone-500 self-center">
							{a.due || '--'}
						</span>
						<span class="text-right self-center">
							{#if a.pct}
								<span class="inline-block px-2 py-0.5 font-mono text-xs font-600 {pctColor(a.pct)} {pctBg(a.pct)}">
									{a.pct}
								</span>
							{:else}
								<span class="text-stone-700 font-mono text-xs">--</span>
							{/if}
						</span>
						<span class="text-right text-xs font-mono text-stone-400 self-center">
							{a.score || '--'}
						</span>
						<span class="pl-5 text-xs text-stone-500 self-center truncate" title={a.feedback}>
							{#if a.feedback}
								<span class="inline-flex items-center gap-1.5">
									<span class="w-1 h-1 bg-amber-dim shrink-0"></span>
									{a.feedback}
								</span>
							{/if}
						</span>
					</div>
				{/each}
			</div>

			<!-- Mobile cards -->
			<div class="md:hidden grid gap-[1px] bg-stone-800/50">
				{#each assignments as a, i}
					<div
						class="stagger-in press bg-stone-950 px-4 py-3.5 active:bg-stone-900 transition-colors duration-100"
						style="animation-delay: {i * 25}ms"
					>
						<div class="flex items-start justify-between gap-3 mb-2">
							<span class="text-sm text-stone-200 font-500 leading-snug">{a.name}</span>
							{#if a.pct}
								<span class="shrink-0 px-2 py-0.5 font-mono text-xs font-600 {pctColor(a.pct)} {pctBg(a.pct)}">
									{a.pct}
								</span>
							{:else}
								<span class="shrink-0 text-stone-700 font-mono text-xs">--</span>
							{/if}
						</div>
						<div class="flex items-center gap-3 text-[11px] font-mono text-stone-500">
							{#if a.due}
								<span>{a.due}</span>
							{/if}
							{#if a.score}
								<span class="text-stone-700">·</span>
								<span class="text-stone-400">{a.score}</span>
							{/if}
						</div>
						{#if a.feedback}
							<div class="mt-2 pt-2 border-t border-stone-800/50 flex items-start gap-1.5 text-xs text-stone-500">
								<span class="w-1 h-1 bg-amber-dim shrink-0 mt-1.5"></span>
								<span class="leading-relaxed">{a.feedback}</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if !assignments.length}
				<div class="py-24 text-center">
					<p class="text-stone-600 font-mono text-sm">No assignments yet</p>
				</div>
			{/if}

		{:else if tab === 'attendance'}
			{#if attendance.length}
				<!-- Desktop table -->
				<div class="hidden md:block border border-stone-800">
					<div class="grid grid-cols-[140px_80px_1fr] gap-0 px-5 py-2.5 bg-stone-900 border-b border-stone-800 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
						<span>Date</span>
						<span>Code</span>
						<span>Reason</span>
					</div>
					{#each attendance as record, i}
						<div
							class="stagger-in grid grid-cols-[140px_80px_1fr] gap-0 px-5 py-3 border-b border-stone-800/40 hover:bg-stone-900/40 transition-colors duration-100"
							style="animation-delay: {i * 25}ms"
						>
							<span class="text-xs font-mono text-stone-400">{record.date || '--'}</span>
							<span class="text-xs font-mono font-600 {record.code === 'A' ? 'text-terracotta' : record.code === 'L' || record.code === 'AL' ? 'text-ochre' : 'text-stone-400'}">
								{record.code || '--'}
							</span>
							<span class="text-xs text-stone-500 truncate">{record.reason || ''}</span>
						</div>
					{/each}
				</div>

				<!-- Mobile cards -->
				<div class="md:hidden grid gap-[1px] bg-stone-800/50">
					{#each attendance as record, i}
						<div
							class="stagger-in bg-stone-950 px-4 py-3.5"
							style="animation-delay: {i * 25}ms"
						>
							<div class="flex items-start justify-between gap-3 mb-1.5">
								<span class="text-sm text-stone-200 font-500">{record.date || '--'}</span>
								<span class="shrink-0 text-xs font-mono font-600 px-2 py-0.5 {record.code === 'A' ? 'text-terracotta bg-terracotta/10' : record.code === 'L' || record.code === 'AL' ? 'text-ochre bg-ochre/10' : 'text-stone-400 bg-stone-800'}">
									{record.code || '--'}
								</span>
							</div>
							{#if record.reason}
								<div class="text-[11px] font-mono text-stone-500">{record.reason}</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="py-24 text-center">
					<p class="text-stone-600 font-mono text-sm">No attendance records</p>
				</div>
			{/if}
		{/if}
	</main>

</div>

<WhatIf {assignments} bind:open={whatIfOpen} />
