<script lang="ts">
	import { onMount } from 'svelte';
	import NumberFlow from '@number-flow/svelte';

	interface Assignment {
		name: string;
		score: string;
		pct: string;
	}

	interface EditableScore {
		name: string;
		numerator: number;
		denominator: number;
		originalNumerator: number;
		originalDenominator: number;
		hasScore: boolean;
	}

	let {
		assignments,
		open = $bindable(false),
	}: {
		assignments: Assignment[];
		open: boolean;
	} = $props();

	let scores = $state<EditableScore[]>([]);
	let closing = $state(false);

	// Mobile drag state
	let dragY = $state(0);
	let isDragging = $state(false);
	let dragStartY = 0;
	let dragStartTime = 0;
	let panelHeight = 0;

	// Desktop vs mobile
	let isMobile = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(max-width: 767px)');
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => isMobile = e.matches;
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	$effect(() => {
		if (open) {
			closing = false;
			document.body.style.overflow = 'hidden';
			scores = assignments.map((a) => {
				if (a.score && a.score.includes('/')) {
					const [num, den] = a.score.split('/').map((s) => parseFloat(s.trim()));
					if (!isNaN(num) && !isNaN(den) && den > 0) {
						return { name: a.name, numerator: num, denominator: den, originalNumerator: num, originalDenominator: den, hasScore: true };
					}
				}
				return { name: a.name, numerator: 0, denominator: 0, originalNumerator: 0, originalDenominator: 0, hasScore: false };
			});
		}
	});

	function close() {
		if (closing) return;
		closing = true;
		document.body.style.overflow = '';
		setTimeout(() => {
			open = false;
			closing = false;
			dragY = 0;
		}, isMobile ? 200 : 150);
	}

	function reset() {
		scores = scores.map((s) => ({ ...s, numerator: s.originalNumerator }));
	}

	// Touch handlers — drag anywhere on the panel, but only if scrolled to top
	function onPanelTouchStart(e: TouchEvent) {
		const scrollContainer = (e.currentTarget as HTMLElement).querySelector('.whatif-scroll');
		if (scrollContainer && scrollContainer.scrollTop > 0) return;
		isDragging = true;
		dragStartY = e.touches[0].clientY;
		dragStartTime = Date.now();
		dragY = 0;
		const panel = e.currentTarget as HTMLElement;
		panelHeight = panel.offsetHeight;
	}

	function onPanelTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		const delta = e.touches[0].clientY - dragStartY;
		if (delta < 0) { dragY = 0; return; }
		dragY = delta;
		// Prevent scroll while dragging down
		e.preventDefault();
	}

	function onPanelTouchEnd() {
		if (!isDragging) return;
		isDragging = false;
		const elapsed = Date.now() - dragStartTime;
		const velocity = dragY / Math.max(elapsed, 1);
		if (dragY > panelHeight * 0.3 || velocity > 0.5) {
			close();
		} else {
			dragY = 0;
		}
	}

	let simulatedAvg = $derived.by(() => {
		const graded = scores.filter((s) => s.hasScore && s.denominator > 0);
		if (!graded.length) return null;
		return Math.round(graded.reduce((sum, s) => sum + (s.numerator / s.denominator) * 100, 0) / graded.length);
	});

	let originalAvg = $derived.by(() => {
		const graded = scores.filter((s) => s.hasScore && s.originalDenominator > 0);
		if (!graded.length) return null;
		return Math.round(graded.reduce((sum, s) => sum + (s.originalNumerator / s.originalDenominator) * 100, 0) / graded.length);
	});

	let diff = $derived(simulatedAvg !== null && originalAvg !== null ? simulatedAvg - originalAvg : 0);
	let hasChanges = $derived(scores.some((s) => s.hasScore && s.numerator !== s.originalNumerator));

	function pctColor(num: number): string {
		if (num >= 86) return 'text-sage';
		if (num >= 73) return 'text-amber-accent';
		if (num >= 50) return 'text-ochre';
		return 'text-terracotta';
	}

	function pctBarColor(num: number): string {
		if (num >= 86) return 'bg-sage';
		if (num >= 73) return 'bg-amber-accent';
		if (num >= 50) return 'bg-ochre';
		return 'bg-terracotta';
	}

	function updateScore(index: number, value: string) {
		const num = parseFloat(value);
		if (!isNaN(num) && num >= 0) {
			scores[index].numerator = Math.min(num, scores[index].denominator * 2);
		}
	}
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && open) close(); }} />

{#if open || closing}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50">
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="absolute inset-0 bg-black/50 backdrop-blur-[6px] transition-opacity duration-200"
			style="opacity: {closing ? 0 : isDragging ? Math.max(0, 1 - dragY / (panelHeight || 400)) : 1}"
			onclick={close}
		></div>

		{#if isMobile}
			<!-- MOBILE: Bottom sheet with drag -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="whatif-sheet absolute bottom-0 left-0 right-0 max-h-[85vh] flex flex-col"
				class:whatif-sheet-in={!closing && !isDragging && dragY === 0}
				class:whatif-sheet-out={closing}
				style={isDragging || dragY > 0 ? `transform: translateY(${dragY}px); transition: none;` : !closing ? '' : ''}
				ontouchstart={onPanelTouchStart}
				ontouchmove={onPanelTouchMove}
				ontouchend={onPanelTouchEnd}
			>
				<!-- Handle -->
				<div class="flex justify-center pt-2.5 pb-1.5 shrink-0">
					<div class="w-8 h-[3px] bg-stone-700/60"></div>
				</div>

				{@render sheetContent()}
			</div>
		{:else}
			<!-- DESKTOP: Centered modal -->
			<div
				class="whatif-modal absolute inset-0 flex items-center justify-center p-8"
				class:whatif-modal-in={!closing}
				class:whatif-modal-out={closing}
			>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="w-full max-w-lg max-h-[80vh] flex flex-col" onclick={(e) => e.stopPropagation()}>
					{@render sheetContent()}
				</div>
			</div>
		{/if}
	</div>
{/if}

{#snippet sheetContent()}
	<!-- Header -->
	<div class="px-5 md:px-6 pt-2 pb-4 shrink-0">
		<div class="flex items-center justify-between mb-4">
			<div>
				<h2 class="font-display font-600 text-base text-stone-100 tracking-tight">What If?</h2>
				<p class="text-[10px] font-mono text-stone-600 mt-0.5 uppercase tracking-wider">Grade simulator</p>
			</div>
			<div class="flex items-center gap-2">
				{#if hasChanges}
					<button onclick={reset} class="text-[10px] font-mono uppercase tracking-wider text-stone-500 hover:text-stone-200 transition-colors cursor-pointer px-2 py-1 border border-stone-800 hover:border-stone-600">Reset</button>
				{/if}
				<button onclick={close} class="text-stone-600 hover:text-stone-200 transition-colors p-1 cursor-pointer">
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
				</button>
			</div>
		</div>

		<!-- Grade display -->
		<div class="flex items-end gap-3">
			{#if simulatedAvg !== null}
				<span class="whatif-grade {pctColor(simulatedAvg)}"><NumberFlow value={simulatedAvg} /></span>
				<span class="text-xl font-mono {pctColor(simulatedAvg)} opacity-40 mb-0.5">%</span>
			{:else}
				<span class="text-3xl font-mono text-stone-700">--</span>
			{/if}
			{#if diff !== 0}
				<div class="mb-1 px-2 py-0.5 {diff > 0 ? 'text-sage bg-sage/10' : 'text-terracotta bg-terracotta/10'}">
					<span class="text-[11px] font-mono font-600">{diff > 0 ? '+' : ''}<NumberFlow value={diff} /></span>
				</div>
			{/if}
		</div>

		<!-- Progress bar -->
		{#if simulatedAvg !== null}
			<div class="mt-3.5 h-[3px] bg-stone-900 relative overflow-hidden">
				<div class="absolute inset-y-0 left-0 transition-all duration-500 ease-out {pctBarColor(simulatedAvg)}" style="width: {Math.min(simulatedAvg, 100)}%"></div>
				{#if originalAvg !== null && hasChanges}
					<div class="absolute top-[-2px] bottom-[-2px] w-[2px] bg-stone-300/40 transition-all duration-300" style="left: {Math.min(originalAvg, 100)}%"></div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="h-px bg-stone-800/50"></div>

	<!-- Scrollable list -->
	<div class="whatif-scroll flex-1 overflow-y-auto overscroll-contain">
		<div class="px-5 md:px-6 py-1">
			{#each scores as score, i}
				{#if score.hasScore}
					<div class="py-3 border-b border-stone-800/20">
						<div class="flex items-center justify-between gap-4 mb-2">
							<span class="text-[13px] text-stone-300 truncate flex-1 {score.numerator !== score.originalNumerator ? 'text-stone-100' : ''}">{score.name}</span>
							<div class="flex items-center gap-0.5 shrink-0">
								<input type="number" value={score.numerator} oninput={(e) => updateScore(i, e.currentTarget.value)} class="whatif-input w-12 text-right" min="0" max={score.denominator * 2} step="0.5" />
								<span class="text-stone-700 font-mono text-[11px] px-0.5">/</span>
								<span class="text-stone-600 font-mono text-[11px]">{score.denominator}</span>
							</div>
						</div>
						<div class="flex items-center gap-3">
							<input type="range" min="0" max={score.denominator} step="0.5" value={score.numerator} oninput={(e) => updateScore(i, e.currentTarget.value)} class="whatif-slider flex-1" />
							<span class="text-[11px] font-mono w-9 text-right tabular-nums {pctColor(score.denominator > 0 ? Math.round((score.numerator / score.denominator) * 100) : 0)} {score.numerator !== score.originalNumerator ? 'font-600' : 'opacity-50'}">{score.denominator > 0 ? Math.round((score.numerator / score.denominator) * 100) : 0}%</span>
						</div>
						{#if score.numerator !== score.originalNumerator}
							<div class="mt-1 text-[10px] font-mono text-stone-600 flex items-center gap-1.5">
								<span class="w-1 h-1 bg-amber-accent/50"></span>
								was {score.originalNumerator}/{score.originalDenominator}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
			{#if scores.filter((s) => !s.hasScore).length > 0}
				<div class="py-4 text-center">
					<span class="text-[10px] font-mono text-stone-700">{scores.filter((s) => !s.hasScore).length} ungraded excluded</span>
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<style>
	/* Mobile sheet */
	.whatif-sheet {
		background: var(--color-stone-950);
		border-top: 1px solid rgba(200, 164, 85, 0.08);
		box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(200, 164, 85, 0.04);
		transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
		will-change: transform;
	}
	.whatif-sheet-in {
		animation: sheet-in 0.28s cubic-bezier(0.2, 0, 0, 1) forwards;
	}
	.whatif-sheet-out {
		animation: sheet-out 0.2s cubic-bezier(0.4, 0, 1, 1) forwards;
	}
	@keyframes sheet-in {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
	@keyframes sheet-out {
		from { transform: translateY(0); }
		to { transform: translateY(100%); }
	}

	/* Desktop modal */
	.whatif-modal > div {
		background: var(--color-stone-950);
		border: 1px solid rgba(200, 164, 85, 0.08);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.03);
	}
	.whatif-modal-in > div {
		animation: modal-in 0.2s cubic-bezier(0.2, 0, 0, 1) forwards;
	}
	.whatif-modal-out > div {
		animation: modal-out 0.15s cubic-bezier(0.4, 0, 1, 1) forwards;
	}
	@keyframes modal-in {
		from { opacity: 0; transform: scale(0.96) translateY(8px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}
	@keyframes modal-out {
		from { opacity: 1; transform: scale(1) translateY(0); }
		to { opacity: 0; transform: scale(0.96) translateY(8px); }
	}

	/* Grade number */
	.whatif-grade {
		font-family: var(--font-mono);
		font-size: 2.75rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	/* Inputs */
	.whatif-input {
		background: transparent;
		border: 1px solid var(--color-stone-800);
		color: var(--color-stone-200);
		font-family: var(--font-mono);
		font-size: 12px;
		padding: 3px 5px;
		outline: none;
		transition: border-color 0.15s;
		-moz-appearance: textfield;
	}
	.whatif-input::-webkit-inner-spin-button,
	.whatif-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.whatif-input:focus {
		border-color: var(--color-amber-accent);
	}

	/* Slider */
	.whatif-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 2px;
		background: var(--color-stone-800);
		outline: none;
		cursor: pointer;
	}
	.whatif-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		background: var(--color-amber-accent);
		border: 2px solid var(--color-stone-950);
		cursor: pointer;
		transition: transform 0.1s ease, box-shadow 0.1s ease;
	}
	.whatif-slider::-webkit-slider-thumb:hover {
		transform: scale(1.25);
		box-shadow: 0 0 8px rgba(200, 164, 85, 0.4);
	}
	.whatif-slider::-webkit-slider-thumb:active {
		transform: scale(1.4);
		box-shadow: 0 0 12px rgba(200, 164, 85, 0.5);
	}
	.whatif-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		background: var(--color-amber-accent);
		border: 2px solid var(--color-stone-950);
		cursor: pointer;
	}

	@supports (padding-bottom: env(safe-area-inset-bottom)) {
		.whatif-sheet {
			padding-bottom: env(safe-area-inset-bottom);
		}
	}
</style>
