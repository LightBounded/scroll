<main class="mx-auto flex w-3xl flex-col gap-8 p-8">
	{#each new Array(5) as _, i}
		<div class="grid h-96 w-full place-items-center rounded-lg border">
			<h2>Page {i + 1}</h2>
		</div>
	{/each}
</main>
