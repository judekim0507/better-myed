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
	let showLogin = $state(false);
	let shaderContainer = $state<HTMLDivElement | null>(null);
	let animationId: number | null = null;
	let renderer: any = null;
	let threeScript: HTMLScriptElement | null = null;

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
		if (!shaderContainer || !(window as any).THREE) return;
		const THREE = (window as any).THREE;
		shaderContainer.innerHTML = '';

		const camera = new THREE.Camera();
		camera.position.z = 1;
		const scene = new THREE.Scene();
		const geometry = new THREE.PlaneBufferGeometry(2, 2);

		const uniforms = {
			time: { type: 'f', value: 1.0 },
			resolution: { type: 'v2', value: new THREE.Vector2() },
		};

		const material = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
			fragmentShader: `
				precision highp float;
				uniform vec2 resolution;
				uniform float time;

				float random(in float x) { return fract(sin(x)*1e4); }

				void main(void) {
					vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
					vec2 fMosaicScal = vec2(4.0, 2.0);
					vec2 vScreenSize = vec2(256, 256);
					uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
					uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

					float t = time * 0.06 + random(uv.x) * 0.4;
					float lineWidth = 0.0008;

					vec3 color = vec3(0.0);
					for(int j = 0; j < 3; j++){
						for(int i = 0; i < 5; i++){
							color[j] += lineWidth * float(i*i) / abs(fract(t - 0.01*float(j) + float(i)*0.01)*1.0 - length(uv));
						}
					}
					gl_FragColor = vec4(color[2], color[1], color[0], 1.0);
				}
			`,
		});

		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		renderer = new THREE.WebGLRenderer();
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		shaderContainer.appendChild(renderer.domElement);

		function onResize() {
			if (!shaderContainer || !renderer) return;
			const rect = shaderContainer.getBoundingClientRect();
			renderer.setSize(rect.width, rect.height);
			uniforms.resolution.value.x = renderer.domElement.width;
			uniforms.resolution.value.y = renderer.domElement.height;
		}
		onResize();
		window.addEventListener('resize', onResize);

		function animate() {
			animationId = requestAnimationFrame(animate);
			uniforms.time.value += 0.05;
			renderer.render(scene, camera);
		}
		animate();
	}

	onMount(() => {
		threeScript = document.createElement('script');
		threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/89/three.min.js';
		threeScript.onload = () => initShader();
		document.head.appendChild(threeScript);
	});

	onDestroy(() => {
		if (animationId) cancelAnimationFrame(animationId);
		if (renderer) renderer.dispose();
		if (threeScript && threeScript.parentNode) threeScript.parentNode.removeChild(threeScript);
	});
</script>

<svelte:head>
	<title>BETTER-MYED — A Faster MyEducation BC Interface</title>
</svelte:head>

<div class="min-h-screen bg-stone-950 text-stone-100 overflow-hidden page-enter">
	<!-- Hero Section -->
	<section class="relative min-h-screen flex flex-col">
		<!-- Shader background -->
		<div class="absolute inset-0 opacity-20" bind:this={shaderContainer}></div>
		<!-- Gradient overlays to ensure text readability -->
		<div class="absolute inset-0 bg-stone-950/40 z-[1]"></div>
		<div class="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-stone-950 to-transparent z-[1]"></div>

		<!-- Nav -->
		<nav class="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
			<span class="font-brand font-800 text-sm tracking-tight">BETTER-MYED</span>
			<div class="flex items-center gap-6">
				<a
					href="https://github.com/judekim0507/better-myed"
					target="_blank"
					rel="noopener noreferrer"
					class="text-[11px] font-mono text-stone-500 hover:text-stone-300 transition-colors duration-150 hidden sm:block"
				>GitHub</a>
				<button
					onclick={() => { showLogin = true; haptic.trigger('light'); document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' }); }}
					class="text-[11px] font-mono font-600 text-stone-950 bg-stone-100 px-4 py-2 hover:bg-white transition-colors duration-150 cursor-pointer"
				>
					Sign in
				</button>
			</div>
		</nav>

		<!-- Hero content -->
		<div class="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center w-full">
			<div class="stagger-in max-w-3xl mx-auto w-full">
				<div class="inline-flex items-center gap-2 px-3 py-1.5 border border-stone-800 bg-stone-900/50 backdrop-blur-sm mb-8">
					<span class="w-1.5 h-1.5 bg-sage animate-pulse" style="border-radius: 50% !important;"></span>
					<span class="text-[11px] font-mono text-stone-400">Open source & free forever</span>
				</div>

				<h1 class="font-brand font-800 text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tighter leading-[1.1] mb-6">
					MyEd,<br/><span class="text-stone-500">but better.</span>
				</h1>

				<p class="text-stone-400 text-base sm:text-lg md:text-xl max-w-xl mx-auto leading-relaxed mb-10 font-light">
					A faster, cleaner interface for MyEducation BC.<br class="hidden sm:block"/>
					Your grades, transcript, and schedule — beautifully redesigned.
				</p>

				<div class="flex flex-col sm:flex-row items-center justify-center gap-3">
					<button
						onclick={() => { showLogin = true; haptic.trigger('medium'); document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' }); }}
						class="group px-8 py-3.5 bg-white text-stone-950 font-display font-600 text-sm tracking-wide transition-all duration-150 hover:bg-stone-100 active:scale-[0.98] cursor-pointer"
					>
						Get started
					</button>
					<a
						href="https://github.com/judekim0507/better-myed"
						target="_blank"
						rel="noopener noreferrer"
						class="px-8 py-3.5 border border-stone-800 text-stone-300 font-display font-500 text-sm tracking-wide hover:border-stone-600 hover:text-stone-100 transition-all duration-150"
					>
						View source
					</a>
				</div>
			</div>
		</div>

		<!-- Scroll indicator -->
		<div class="relative z-10 flex justify-center pb-8">
			<div class="w-px h-12 bg-gradient-to-b from-stone-700 to-transparent"></div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="relative z-10 px-6 md:px-12 py-24 md:py-32">
		<div class="max-w-5xl mx-auto">
			<div class="stagger-in text-center mb-16 md:mb-24">
				<p class="text-[10px] font-mono text-amber-accent uppercase tracking-widest mb-4">Why switch</p>
				<h2 class="font-brand font-800 text-3xl md:text-4xl tracking-tight">Everything MyEd should be.</h2>
			</div>

			<div class="grid md:grid-cols-3 gap-[1px] bg-stone-800/50">
				{#each [
					{ title: 'Instant grades', desc: 'See all your classes, assignments, and percentages at a glance. No more clicking through 5 pages.', mono: '0.3s' },
					{ title: 'What If?', desc: 'Simulate grade changes with a live calculator. Drag sliders to see how assignments affect your final.', mono: 'A → A+' },
					{ title: 'Transcript', desc: 'Your full course history and graduation progress in one clean view with progress tracking.', mono: '80cr' },
					{ title: 'Report cards', desc: 'Published reports download instantly as PDFs. No broken Java applets or blank pages.', mono: 'PDF' },
					{ title: 'Calendar', desc: 'Assignments and events on a real calendar grid. Navigate months without page reloads.', mono: 'MAR' },
					{ title: 'Mobile-first', desc: 'Designed for your phone. Install as an app, get haptic feedback, use it like a native experience.', mono: 'PWA' },
				] as feature, i}
					<div class="stagger-in bg-stone-950 p-6 md:p-8 group" style="animation-delay: {i * 50}ms">
						<span class="text-[10px] font-mono text-stone-600 mb-4 block">{feature.mono}</span>
						<h3 class="font-display font-600 text-stone-100 text-base mb-2">{feature.title}</h3>
						<p class="text-stone-500 text-sm leading-relaxed">{feature.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Login Section -->
	<section id="login-section" class="px-6 md:px-12 py-24 md:py-32">
		<div class="max-w-[400px] mx-auto">
			<div class="stagger-in text-center mb-10">
				<h2 class="font-brand font-800 text-2xl md:text-3xl tracking-tight mb-3">Sign in</h2>
				<p class="text-stone-500 text-sm">Use your MyEducation BC credentials.</p>
			</div>

			<form
				onsubmit={(e) => { e.preventDefault(); handleLogin(); }}
				class="stagger-in"
				style="animation-delay: 60ms"
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
						class="w-full px-4 py-3 bg-stone-900/50 border text-stone-100 text-sm placeholder-stone-700 outline-none transition-colors duration-150 {focused === 'user' ? 'border-stone-100' : 'border-stone-800 hover:border-stone-700'}"
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
						class="w-full px-4 py-3 bg-stone-900/50 border text-stone-100 text-sm placeholder-stone-700 outline-none transition-colors duration-150 {focused === 'pass' ? 'border-stone-100' : 'border-stone-800 hover:border-stone-700'}"
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
					<div class="px-4 py-3.5 bg-stone-100 text-stone-950 font-display font-600 text-sm tracking-wide text-center transition-all duration-150 {loading ? 'opacity-70' : 'group-hover:bg-white group-active:scale-[0.98]'}">
						{#if loading}
							<span class="flex items-center justify-center gap-2">
								<span class="w-3 h-3 border-2 border-stone-950/30 border-t-stone-950 animate-spin" style="border-radius: 50% !important;"></span>
								Signing in
							</span>
						{:else}
							Sign in →
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
