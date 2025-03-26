<script lang="ts">
	import { sendWSGameMessage, type WSGameMessage } from '$lib/ws';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import clsx from 'clsx';

	const { data }: PageProps = $props();

	let players = $state<string[]>([]);
	$inspect(players);

	onMount(() => {
		// Establish a connection to the server
		const socket = new WebSocket('ws://localhost:8080');

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
					// TODO: Implement
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

<main class="mx-auto max-w-xl p-4">
	<h1 class="mb-2">Players</h1>
	<ul class="flex flex-col gap-4">
		{#each players as player}
			<li
				class={clsx('h-96 rounded-md border p-4', {
					'border-blue-500 ring-2 ring-blue-500': player === data.user.id
				})}
			>
				{player}
			</li>
		{/each}
	</ul>
</main>
