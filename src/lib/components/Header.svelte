<script lang="ts">
	import { useClerkContext } from 'svelte-clerk';

	const clerkContext = useClerkContext();
</script>

<nav class="flex items-center justify-between px-8 py-4 shadow">
	<div class="flex items-center gap-4">
		<a href="/">Spot</a>
	</div>
	<div>
		{#if clerkContext.auth.userId}
			<button
				onclick={() => {
					clerkContext.clerk?.signOut();
				}}>Sign Out</button
			>
		{:else}
			<button
				onclick={() => {
					clerkContext.clerk?.openSignIn();
				}}>Sign In</button
			>
		{/if}
	</div>
</nav>
