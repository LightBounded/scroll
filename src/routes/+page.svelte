<script lang="ts">
	import { sendWSGameMessage, type WSGameMessage } from '$lib/ws';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { cn } from '$lib';
	import { SignOutButton, useClerkContext } from 'svelte-clerk';
	import { redirect } from '@sveltejs/kit';
	import { goto } from '$app/navigation';

	const { data }: PageProps = $props();

	let players = $state<string[]>([]);
	let currentPlayerPosition = $derived.by(() => players.indexOf(data.user.id));
	$inspect(players);

	const socket = new WebSocket('ws://localhost:8080');

	const clerkCtx = useClerkContext();

	onMount(() => {
		// Listen for messages
		socket.addEventListener('message', function (event) {
			const payload = event.data;
			const json: WSGameMessage = JSON.parse(payload);

			switch (json.event) {
				case 'lobbyState': {
					players = json.players;
					break;
				}
				case 'playerJoin': {
					players.push(json.player);
					break;
				}
				case 'playerLeave': {
					const index = players.indexOf(json.player);
					if (index !== -1) {
						players.splice(index, 1);
					}
					break;
				}
				case 'playerSkip': {
					// Swap the positions of the skipper and player being skipped
					const skipperIndex = players.indexOf(json.skipper);
					const skippeeIndex = players.indexOf(json.skipped);
					if (skipperIndex !== -1 && skippeeIndex !== -1) {
						players[skipperIndex] = json.skipped;
						players[skippeeIndex] = json.skipper;
					}
					break;
				}
			}
		});

		// Connection opened
		socket.addEventListener('open', function (event) {
			console.log('Connection opened');
			sendWSGameMessage(socket, {
				event: 'playerJoin',
				player: data.user.id
			});
		});

		// Connection closed
		socket.addEventListener('close', function (event) {
			console.log('Connection closed');
		});

		// Connection error
		socket.addEventListener('error', function (event) {
			console.log('Connection error');
		});

		return () => {
			// Close the connection when the component is destroyed
			sendWSGameMessage(socket, {
				event: 'playerLeave',
				player: data.user.id
			});
			socket.close();
		};
	});
</script>

<main class="relative mx-auto max-w-xl p-4">
	<h1 class="mb-2">Players</h1>
	<ul class="flex flex-col gap-4">
		{#each players as player}
			<li
				class={cn('h-96 rounded-md border border-gray-400 p-4', {
					'border-blue-500 ring-2 ring-blue-500': player === data.user.id
				})}
			>
				{player}
			</li>
		{/each}
	</ul>
	<button
		onclick={() => {
			// Get current players position

			let nextPlayerPosition =
				currentPlayerPosition + 1 >= players.length ? 0 : currentPlayerPosition + 1;

			sendWSGameMessage(socket, {
				event: 'playerSkip',
				skipper: data.user.id,
				skipped: players[nextPlayerPosition]
			});
		}}
		class="fixed right-0 bottom-4 left-0 mx-auto w-60 cursor-pointer rounded-md bg-blue-500 px-4 py-3 font-bold text-white transition-colors duration-200 outline-none focus-within:ring-2 focus-within:ring-blue-300 hover:bg-blue-500/90"
		>Skip</button
	>
	<button
		onclick={async () => {
			try {
				await clerkCtx.clerk?.signOut();
			} catch (e) {
				if (e instanceof Error) alert(e.message);
			}
			goto('/sign-in');
		}}
		class="fixed top-4 right-4 mx-auto cursor-pointer rounded-md bg-blue-500 px-4 py-3 text-sm font-bold text-white transition-colors duration-200 outline-none focus-within:ring-2 focus-within:ring-blue-300 hover:bg-blue-500/90"
		>Sign Out</button
	>
</main>
