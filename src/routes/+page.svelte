<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { createWebHaptics } from 'web-haptics/svelte';

	const haptic = createWebHaptics();
	onDestroy(() => haptic.destroy());

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let focused = $state<'user' | 'pass' | null>(null);
	let remember = $state(true);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let animationId: number | null = null;
	let gl: WebGLRenderingContext | null = null;
	let heroVisible = $state(false);
	let featuresVisible = $state(false);
	let loginVisible = $state(false);

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
			goto('/dashboard');
		} catch {
			error = 'Connection failed';
			haptic.trigger('error');
		} finally {
			loading = false;
		}
	}

	function initShader() {
		if (!canvas) return;
		gl = canvas.getContext('webgl');
		if (!gl) return;

		const vs = gl.createShader(gl.VERTEX_SHADER)!;
		gl.shaderSource(vs, `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`);
		gl.compileShader(vs);

		const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
		gl.shaderSource(fs, `
			precision highp float;
			uniform vec2 resolution;
			uniform float time;
			float random(in float x){return fract(sin(x)*1e4);}
			void main(){
				vec2 uv=(gl_FragCoord.xy*2.0-resolution.xy)/min(resolution.x,resolution.y);
				vec2 s=vec2(4,2),v=vec2(256);
				uv=floor(uv*v/s)/(v/s);
				float t=time*0.06+random(uv.x)*0.4,w=0.0008;
				vec3 c=vec3(0);
				for(int j=0;j<3;j++)for(int i=0;i<5;i++)
					c[j]+=w*float(i*i)/abs(fract(t-0.01*float(j)+float(i)*0.01)-length(uv));
				gl_FragColor=vec4(c[2],c[1],c[0],1);
			}
		`);
		gl.compileShader(fs);

		const prog = gl.createProgram()!;
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		gl.useProgram(prog);

		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(prog, 'p');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

		const uTime = gl.getUniformLocation(prog, 'time');
		const uRes = gl.getUniformLocation(prog, 'resolution');
		let time = 1.0;

		function onResize() {
			if (!canvas || !gl) return;
			const dpr = Math.min(window.devicePixelRatio, 2);
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			gl.viewport(0, 0, canvas.width, canvas.height);
		}
		onResize();
		window.addEventListener('resize', onResize);

		function animate() {
			animationId = requestAnimationFrame(animate);
			if (!gl) return;
			time += 0.05;
			gl.uniform1f(uTime, time);
			gl.uniform2f(uRes, canvas!.width, canvas!.height);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
		animate();
	}

	function observeVisibility(node: HTMLElement, callback: (visible: boolean) => void) {
		const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (prefersReduced) {
			callback(true);
			return { destroy: () => {} };
		}
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						callback(true);
						observer.unobserve(node);
					}
				});
			},
			{ threshold: 0.15 }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function showLogin() {
		haptic.trigger('medium');
		document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' });
	}

	onMount(() => {
		initShader();
		setTimeout(() => (heroVisible = true), 100);
	});

	onDestroy(() => {
		if (animationId) cancelAnimationFrame(animationId);
		if (gl) {
			const ext = gl.getExtension('WEBGL_lose_context');
			if (ext) ext.loseContext();
		}
	});

	const features = [
		{ title: 'Instant grades', desc: 'All classes, assignments, and percentages at a glance. No more clicking through 5 pages.', mono: '0.3s' },
		{ title: 'What-If calculator', desc: 'Simulate grade changes with live sliders. See exactly how each assignment affects your final.', mono: 'A+' },
		{ title: 'Transcript', desc: 'Full course history and graduation progress in one clean view with credit tracking.', mono: '80cr' },
		{ title: 'Report cards', desc: 'Published reports download instantly as PDFs. No broken Java applets or blank pages.', mono: 'PDF' },
		{ title: 'Calendar', desc: 'Assignments and events on a real calendar grid. Navigate months without page reloads.', mono: 'MAR' },
		{ title: 'Mobile-first', desc: 'Install as an app. Haptic feedback, offline support, and native-like experience on your phone.', mono: 'PWA' },
	];

</script>

<svelte:head>
	<title>BETTER-MYED — A Faster MyEducation BC Interface</title>
</svelte:head>

<div class="min-h-screen bg-stone-950 text-stone-100 overflow-hidden">
	<!-- Grain overlay for texture -->
	<div class="grain"></div>

	<!-- Hero Section -->
	<section class="relative min-h-screen flex flex-col">
		<!-- Shader background -->
		<canvas class="absolute inset-0 w-full h-full opacity-30" bind:this={canvas}></canvas>
		<!-- Gradient overlays -->
		<div class="absolute inset-0 bg-stone-950/20 z-[1]"></div>
		<div class="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent z-[1]"></div>
		<!-- Radial glow behind hero text -->
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-amber-accent/[0.04] blur-[150px] z-[1] pointer-events-none"></div>

		<!-- Nav -->
		<nav class="relative z-10 flex items-center justify-between px-6 md:px-12 lg:px-16 py-6">
			<span class="font-brand font-800 text-xs tracking-tight text-stone-400">BETTER-MYED</span>
			<div class="flex items-center gap-6">
				<a
					href="https://github.com/judekim0507/better-myed"
					target="_blank"
					rel="noopener noreferrer"
					class="text-[11px] font-mono text-stone-600 hover:text-stone-300 transition-colors duration-200 hidden sm:flex items-center gap-1.5"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
						<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
					</svg>
					Source
				</a>
				<button
					onclick={() => { showLogin(); }}
					class="text-[11px] font-mono font-600 text-stone-950 bg-stone-100 px-4 py-2 hover:bg-white transition-colors duration-150 cursor-pointer"
				>
					Sign in
				</button>
			</div>
		</nav>

		<!-- Hero content -->
		<div class="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center w-full">
			<div class="max-w-5xl mx-auto w-full {heroVisible ? 'hero-entered' : 'hero-initial'}">
				<div class="inline-flex items-center gap-2 px-3 py-1.5 border border-stone-800/80 bg-stone-900/40 backdrop-blur-sm mb-10 hero-badge">
					<span class="w-1.5 h-1.5 bg-sage shrink-0 animate-pulse" style="border-radius: 50% !important;"></span>
					<span class="text-[11px] font-mono text-stone-500">Open source & free forever</span>
				</div>

				<h1 class="font-brand font-800 text-5xl sm:text-6xl md:text-7xl tracking-tighter leading-[1.05] mb-8 hero-title">
					MyEd,<br/><span class="hero-gradient-text">but better.</span>
				</h1>

				<p class="text-stone-400 text-lg sm:text-xl max-w-md mx-auto leading-relaxed mb-14 font-light hero-desc">
					Your grades, transcript, and schedule — faster and beautifully redesigned.
				</p>

				<div class="flex flex-col sm:flex-row items-center justify-center gap-3 hero-cta">
					<button
						onclick={() => { showLogin(); }}
						class="group relative px-10 py-4 bg-stone-100 text-stone-950 font-display font-600 text-sm tracking-wide transition-all duration-200 hover:bg-white active:scale-[0.98] cursor-pointer overflow-hidden"
					>
						<span class="relative z-10">Get started</span>
						<div class="absolute inset-0 bg-amber-accent/0 group-hover:bg-amber-accent/10 transition-colors duration-200"></div>
					</button>
					<a
						href="https://github.com/judekim0507/better-myed"
						target="_blank"
						rel="noopener noreferrer"
						class="px-10 py-4 border border-stone-800 text-stone-400 font-display font-500 text-sm tracking-wide hover:border-stone-600 hover:text-stone-200 transition-all duration-200 cursor-pointer"
					>
						View source
					</a>
				</div>
			</div>
		</div>

		<!-- Scroll indicator -->
		<div class="relative z-10 flex justify-center pb-10">
			<div class="flex flex-col items-center gap-3">
				<span class="text-[9px] font-mono text-stone-700 uppercase tracking-[0.2em]">Scroll</span>
				<div class="w-px h-10 bg-gradient-to-b from-stone-700 to-transparent scroll-line"></div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section
		class="relative z-10 px-6 md:px-12 lg:px-16 py-24 md:py-32"
		use:observeVisibility={(v) => (featuresVisible = v)}
	>
		<div class="max-w-5xl mx-auto">
			<div class="text-center mb-16 md:mb-24 {featuresVisible ? 'reveal' : 'reveal-initial'}">
				<p class="text-[10px] font-mono text-amber-accent uppercase tracking-[0.25em] mb-4">Features</p>
				<h2 class="font-brand font-800 text-3xl md:text-4xl lg:text-5xl tracking-tight">Everything MyEd should be.</h2>
			</div>

			<div class="grid md:grid-cols-3 gap-px bg-stone-800/30">
				{#each features as feature, i}
					<div
						class="feature-card group bg-stone-950 p-7 md:p-8 {featuresVisible ? 'reveal' : 'reveal-initial'}"
						style="transition-delay: {80 + i * 60}ms"
					>
						<div class="flex items-center justify-between mb-5">
							<span class="text-[10px] font-mono text-stone-700 group-hover:text-amber-accent transition-colors duration-300">{feature.mono}</span>
							<div class="w-6 h-px bg-stone-800 group-hover:bg-amber-accent/40 group-hover:w-10 transition-all duration-300"></div>
						</div>
						<h3 class="font-display font-600 text-stone-200 text-base mb-2.5 group-hover:text-stone-50 transition-colors duration-300">{feature.title}</h3>
						<p class="text-stone-500 text-sm leading-relaxed group-hover:text-stone-400 transition-colors duration-300">{feature.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Login Section -->
	<section
		id="login-section"
		class="px-6 md:px-12 lg:px-16 py-24 md:py-32 relative"
		use:observeVisibility={(v) => (loginVisible = v)}
	>
		<!-- Ambient glow behind login -->
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-accent/[0.03] blur-[120px] pointer-events-none"></div>

		<div class="max-w-[400px] mx-auto relative">
			<div class="text-center mb-10 {loginVisible ? 'reveal' : 'reveal-initial'}">
				<p class="text-[10px] font-mono text-amber-accent uppercase tracking-[0.25em] mb-4">Get started</p>
				<h2 class="font-brand font-800 text-2xl md:text-3xl tracking-tight mb-3">Sign in</h2>
				<p class="text-stone-500 text-sm">Use your MyEducation BC credentials.</p>
			</div>

			<form
				onsubmit={(e) => { e.preventDefault(); handleLogin(); }}
				class="{loginVisible ? 'reveal' : 'reveal-initial'}"
				style="transition-delay: 80ms"
			>
				<div class="mb-5">
					<label for="username" class="block text-[11px] font-mono font-500 text-stone-500 uppercase tracking-wider mb-2">
						Login ID
					</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						onfocus={() => (focused = 'user')}
						onblur={() => (focused = null)}
						class="w-full px-4 py-3 bg-stone-900/50 border text-stone-100 text-sm placeholder-stone-700 outline-none transition-all duration-200 {focused === 'user' ? 'border-stone-400 bg-stone-900/80' : 'border-stone-800 hover:border-stone-700'}"
						placeholder="Student number"
						autocomplete="username"
						required
					/>
				</div>

				<div class="mb-6">
					<label for="password" class="block text-[11px] font-mono font-500 text-stone-500 uppercase tracking-wider mb-2">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						onfocus={() => (focused = 'pass')}
						onblur={() => (focused = null)}
						class="w-full px-4 py-3 bg-stone-900/50 border text-stone-100 text-sm placeholder-stone-700 outline-none transition-all duration-200 {focused === 'pass' ? 'border-stone-400 bg-stone-900/80' : 'border-stone-800 hover:border-stone-700'}"
						placeholder="Enter password"
						autocomplete="current-password"
						required
					/>
				</div>

				{#if error}
					<div class="mb-5 px-4 py-3 border border-terracotta/30 bg-terracotta/5 text-terracotta text-sm flex items-center gap-2">
						<span class="w-1.5 h-1.5 bg-terracotta shrink-0"></span>
						{error}
					</div>
				{/if}

				<div class="flex items-center justify-between mb-8">
					<label class="flex items-center gap-2 cursor-pointer group">
						<div class="relative w-3.5 h-3.5 border {remember ? 'border-stone-100 bg-stone-100' : 'border-stone-700 group-hover:border-stone-500'} transition-colors duration-150 flex items-center justify-center">
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
					<div class="px-4 py-3.5 bg-stone-100 text-stone-950 font-display font-600 text-sm tracking-wide text-center transition-all duration-200 {loading ? 'opacity-70' : 'group-hover:bg-white group-hover:shadow-[0_0_30px_rgba(200,164,85,0.08)] group-active:scale-[0.98]'}">
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

			<div class="mt-10 flex items-center gap-4">
				<div class="h-px flex-1 bg-stone-800/60"></div>
				<span class="text-[10px] font-mono text-stone-700 uppercase tracking-widest">Aspen / Follett</span>
				<div class="h-px flex-1 bg-stone-800/60"></div>
			</div>
		</div>
	</section>
</div>

<style>
	/* Grain texture overlay */
	.grain {
		position: fixed;
		inset: 0;
		z-index: 100;
		pointer-events: none;
		opacity: 0.035;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
		background-repeat: repeat;
		background-size: 256px 256px;
	}

	/* Hero entrance animations */
	.hero-initial {
		opacity: 0;
	}

	.hero-entered .hero-badge {
		animation: heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
	}
	.hero-entered .hero-title {
		animation: heroFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
	}
	.hero-entered .hero-desc {
		animation: heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both;
	}
	.hero-entered .hero-cta {
		animation: heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
	}

	@keyframes heroFadeUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Gradient text for "but better" */
	.hero-gradient-text {
		background: linear-gradient(135deg, var(--color-stone-400) 0%, var(--color-amber-accent) 50%, var(--color-stone-500) 100%);
		background-size: 200% auto;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		animation: gradientShift 6s ease-in-out infinite alternate;
	}

	@keyframes gradientShift {
		0% { background-position: 0% center; }
		100% { background-position: 200% center; }
	}

	/* Scroll line animation */
	.scroll-line {
		animation: scrollPulse 2s ease-in-out infinite;
	}

	@keyframes scrollPulse {
		0%, 100% { opacity: 0.3; transform: scaleY(1); }
		50% { opacity: 0.8; transform: scaleY(1.2); }
	}

	/* Reveal animation for sections */
	.reveal-initial {
		opacity: 0;
		transform: translateY(16px);
	}

	.reveal {
		opacity: 1;
		transform: translateY(0);
		transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* Feature card hover */
	.feature-card {
		position: relative;
		transition: background-color 0.3s ease;
	}
	.feature-card::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, var(--color-amber-accent) 0%, transparent 60%);
		opacity: 0;
		transition: opacity 0.4s ease;
		pointer-events: none;
	}
	.feature-card:hover::before {
		opacity: 0.03;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.hero-entered .hero-badge,
		.hero-entered .hero-title,
		.hero-entered .hero-desc,
		.hero-entered .hero-cta {
			animation: none;
			opacity: 1;
		}
		.hero-gradient-text {
			animation: none;
		}
		.scroll-line {
			animation: none;
			opacity: 0.5;
		}
		.reveal-initial {
			opacity: 1;
			transform: none;
		}
	}
</style>
