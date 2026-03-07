<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onDestroy } from 'svelte';
	import NumberFlow from '@number-flow/svelte';

	const haptic = createWebHaptics();
	onDestroy(() => haptic.destroy());

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

	$effect(() => {
		if (open) {
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

	function reset() {
		haptic.trigger('light');
		scores = scores.map((s) => ({ ...s, numerator: s.originalNumerator }));
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

	function updateScore(index: number, value: string, fromSlider = false) {
		const num = parseFloat(value);
		if (!isNaN(num) && num >= 0) {
			const clamped = Math.min(num, scores[index].denominator * 2);
			if (fromSlider && clamped !== scores[index].numerator) {
				haptic.trigger('selection');
			}
			scores[index].numerator = clamped;
		}
	}
</script>

<Drawer.Root bind:open>
	<Drawer.Portal>
		<Drawer.Overlay class="whatif-overlay" />
		<Drawer.Content class="whatif-content">
			<!-- Handle -->
			<div class="flex justify-center pt-2.5 pb-1.5 shrink-0">
				<div class="w-8 h-[3px] bg-stone-700/60 rounded-full"></div>
			</div>

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
						<Drawer.Close class="text-stone-600 hover:text-stone-200 transition-colors p-1 cursor-pointer">
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
						</Drawer.Close>
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
									<input type="range" min="0" max={score.denominator} step="0.5" value={score.numerator} oninput={(e) => updateScore(i, e.currentTarget.value, true)} class="whatif-slider flex-1" />
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
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	:global([data-vaul-overlay].whatif-overlay) {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(6px);
		z-index: 50;
	}

	:global([data-vaul-drawer].whatif-content) {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		max-height: 85vh;
		background: var(--color-stone-950);
		border-top: 1px solid rgba(200, 164, 85, 0.08);
		box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(200, 164, 85, 0.04);
	}

	@media (min-width: 768px) {
		:global([data-vaul-drawer].whatif-content) {
			max-width: 32rem;
			left: 50%;
			transform: translateX(-50%);
			border-left: 1px solid rgba(200, 164, 85, 0.08);
			border-right: 1px solid rgba(200, 164, 85, 0.08);
			border-radius: 0;
		}
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

	/* Slider — fat touch target, thin visual track */
	.whatif-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 44px;
		background: transparent;
		outline: none;
		cursor: pointer;
		position: relative;
	}
	/* Thin visible track via pseudo on the container */
	.whatif-slider::-webkit-slider-runnable-track {
		height: 2px;
		background: var(--color-stone-800);
	}
	.whatif-slider::-moz-range-track {
		height: 2px;
		background: var(--color-stone-800);
		border: none;
	}
	.whatif-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		background: var(--color-amber-accent);
		border: 3px solid var(--color-stone-950);
		margin-top: -9px;
		cursor: pointer;
		transition: transform 0.1s ease, box-shadow 0.1s ease;
	}
	.whatif-slider::-webkit-slider-thumb:hover {
		transform: scale(1.2);
		box-shadow: 0 0 8px rgba(200, 164, 85, 0.4);
	}
	.whatif-slider::-webkit-slider-thumb:active {
		transform: scale(1.3);
		box-shadow: 0 0 12px rgba(200, 164, 85, 0.5);
	}
	.whatif-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		background: var(--color-amber-accent);
		border: 3px solid var(--color-stone-950);
		cursor: pointer;
	}

	@supports (padding-bottom: env(safe-area-inset-bottom)) {
		:global([data-vaul-drawer].whatif-content) {
			padding-bottom: env(safe-area-inset-bottom);
		}
	}
</style>
