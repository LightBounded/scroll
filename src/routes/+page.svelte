<script lang="ts">
	import { sendWSGameMessage, type WSGameMessage } from '$lib/ws';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const players = $state<string[]>([]);
	$inspect(players);

	onMount(() => {
		// Establish a connection to the server
		const socket = new WebSocket('ws://localhost:8080');

		// Listen for messages
		socket.addEventListener('message', function (event) {
			const payload = event.data;
			const json: WSGameMessage = JSON.parse(payload);

			console.log('Received message', json);

			switch (json.event) {
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
			socket.close();
		};
	});
</script>

<main>
	<h1>Players</h1>
	<ul>
		{#each players as player}
			<li>{player}</li>
		{/each}
	</ul>
</main>
