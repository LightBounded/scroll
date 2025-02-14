<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { ClerkProvider } from 'svelte-clerk';

	const { children }: { children: Snippet } = $props();
</script>

<ClerkProvider>
	<Header />
	{@render children()}
</ClerkProvider>
