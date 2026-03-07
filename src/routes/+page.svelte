<script lang="ts">
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onDestroy } from 'svelte';

	const haptic = createWebHaptics();
	onDestroy(() => haptic.destroy());

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let focused = $state<'user' | 'pass' | null>(null);
	let remember = $state(true);

	async function handleLogin() {
		error = '';
		loading = true;
		haptic.trigger('medium');
		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password, remember }),
			});
			if (!res.ok) {
				error = 'Invalid credentials';
				haptic.trigger('error');
				return;
			}
			haptic.trigger('success');
			window.location.href = '/dashboard';
		} catch {
			error = 'Connection failed';
			haptic.trigger('error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login — BETTER-MYED</title>
</svelte:head>

<div class="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden page-enter">
	<!-- Background texture — subtle crosshatch -->
	<div class="absolute inset-0 opacity-[0.025]" style="background-image: url('data:image/svg+xml,<svg width=&quot;60&quot; height=&quot;60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;><line x1=&quot;0&quot; y1=&quot;60&quot; x2=&quot;60&quot; y2=&quot;0&quot; stroke=&quot;white&quot; stroke-width=&quot;0.4&quot;/></svg>'); background-size: 60px 60px;"></div>

	<!-- Amber glow — positioned behind the form area -->
	<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-accent/[0.02]" style="filter: blur(120px);"></div>

	<div class="relative w-full max-w-[360px]">
		<!-- Brand -->
		<div class="mb-12 md:mb-16 stagger-in">
			<h1 class="font-brand font-800 text-2xl md:text-3xl text-stone-100 tracking-tight mb-3">BETTER-MYED</h1>
			<p class="text-stone-500 text-sm leading-relaxed">A cleaner interface for MyEducation BC. Made by <a href="https://judekim.com" target="_blank" rel="noopener noreferrer" class="text-stone-400 hover:text-amber-accent transition-colors duration-150">Jude</a>.</p>
		</div>

		<!-- Form -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleLogin();
			}}
			class="stagger-in"
			style="animation-delay: 80ms"
		>
			<!-- Login ID -->
			<div class="mb-5">
				<label for="username" class="block text-[11px] font-mono font-500 text-stone-500 uppercase tracking-wider mb-2">
					Login ID
				</label>
				<div class="relative">
					<input
						id="username"
						type="text"
						bind:value={username}
						onfocus={() => (focused = 'user')}
						onblur={() => (focused = null)}
						class="w-full px-4 py-3 bg-transparent border text-stone-100 text-sm placeholder-stone-700 outline-none transition-colors duration-150 {focused === 'user' ? 'border-amber-accent' : 'border-stone-800 hover:border-stone-700'}"
						placeholder="Student number"
						autocomplete="username"
						required
					/>
				</div>
			</div>

			<!-- Password -->
			<div class="mb-6">
				<label for="password" class="block text-[11px] font-mono font-500 text-stone-500 uppercase tracking-wider mb-2">
					Password
				</label>
				<div class="relative">
					<input
						id="password"
						type="password"
						bind:value={password}
						onfocus={() => (focused = 'pass')}
						onblur={() => (focused = null)}
						class="w-full px-4 py-3 bg-transparent border text-stone-100 text-sm placeholder-stone-700 outline-none transition-colors duration-150 {focused === 'pass' ? 'border-amber-accent' : 'border-stone-800 hover:border-stone-700'}"
						placeholder="Enter password"
						autocomplete="current-password"
						required
					/>
				</div>
			</div>

			<!-- Error -->
			{#if error}
				<div class="mb-5 px-4 py-3 border border-terracotta/30 bg-terracotta/5 text-terracotta text-sm flex items-center gap-2">
					<span class="w-1.5 h-1.5 bg-terracotta shrink-0"></span>
					{error}
				</div>
			{/if}

			<!-- Remember + Submit row -->
			<div class="flex items-center justify-between mb-8">
				<label class="flex items-center gap-2 cursor-pointer group">
					<div class="relative w-3.5 h-3.5 border {remember ? 'border-amber-accent bg-amber-accent' : 'border-stone-700 group-hover:border-stone-500'} transition-colors duration-150 flex items-center justify-center">
						{#if remember}
							<svg class="w-2 h-2 text-stone-950" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square">
								<path d="M2 6l3 3 5-5" />
							</svg>
						{/if}
					</div>
					<input type="checkbox" bind:checked={remember} onchange={() => haptic.trigger('light')} class="sr-only" />
					<span class="text-[11px] text-stone-600 group-hover:text-stone-400 transition-colors duration-150">Remember me</span>
				</label>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="group w-full cursor-pointer"
			>
				<div class="px-4 py-3.5 bg-amber-accent text-stone-950 font-display font-600 text-sm tracking-wide text-center transition-all duration-150 {loading ? 'opacity-70' : 'group-hover:bg-stone-100 group-active:scale-[0.98]'}">
					{#if loading}
						<span class="flex items-center justify-center gap-2">
							<span class="w-3 h-3 border-2 border-stone-950/30 border-t-stone-950 animate-spin" style="border-radius: 50% !important;"></span>
							Signing in
						</span>
					{:else}
						Sign in
					{/if}
				</div>
			</button>
		</form>

		<!-- Divider + tag -->
		<div class="mt-14 md:mt-20 flex items-center gap-4 stagger-in" style="animation-delay: 160ms">
			<div class="h-px flex-1 bg-stone-800/60"></div>
			<span class="text-[10px] font-mono text-stone-700 uppercase tracking-widest">Aspen / Follett</span>
			<div class="h-px flex-1 bg-stone-800/60"></div>
		</div>
	</div>
</div>
