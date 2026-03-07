declare module 'web-haptics/svelte' {
	export function createWebHaptics(): {
		trigger: (type?: 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' | 'selection') => void;
		destroy: () => void;
	};
}
