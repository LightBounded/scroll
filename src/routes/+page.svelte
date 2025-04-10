<script lang="ts">
	import { sendWSGameMessage, type WSGameMessage, type Stats, type LeaderboardEntry } from '$lib/ws';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { cn } from '$lib';
	import { useClerkContext } from 'svelte-clerk';
	import { goto } from '$app/navigation';

	const { data }: PageProps = $props();

	let players = $state<string[]>([]);
	let playerStats = $state<Stats | null>(null);
	let skipFailedMessage = $state<string | null>(null);
	let currentPlayerPosition = $derived.by(() => players.indexOf(data.user.id));
	// Add leaderboard to track highest cycles for each player
	let leaderboard = $state<LeaderboardEntry[]>([]);
	$inspect(players);

	let socket: WebSocket;

	const clerkCtx = useClerkContext();

	// Format user display name based on available data
	function getDisplayName(playerId: string): string {
		// Check if we have a playerName from the leaderboard
		const entry = leaderboard.find(e => e.playerId === playerId);
		if (entry && entry.playerName && entry.playerName !== playerId) {
			return entry.playerName;
		}
		
		// For the current user, use their actual name from Clerk profile
		if (playerId === data.user.id) {
			// Prioritize username first for consistency
			if (data.user.username) return data.user.username;
			
			const firstName = data.user.firstName;
			const lastName = data.user.lastName;
			
			if (firstName && lastName) return `${firstName} ${lastName}`;
			if (firstName) return firstName;
			if (data.user.emailAddresses && data.user.emailAddresses.length > 0) {
				return data.user.emailAddresses[0].emailAddress.split('@')[0];
			}
			return 'You';
		}
		
		// For test players, create a friendly name
		if (playerId.startsWith('test-player-')) {
			const num = playerId.replace('test-player-', '');
			return `Test Player ${num}`;
		}
		
		// Fallback display name
		return playerId;
	}

	// TEST FUNCTION: Populate with test data
	function populateTestData(numPlayers = 25) {
		// Clear existing data
		players = [];
		leaderboard = [];
		
		// Add current user as first player
		players.push(data.user.id);
		
		// Add random test players
		for (let i = 1; i < numPlayers; i++) {
			const playerId = `test-player-${i}`;
			players.push(playerId);
			
			// Add to leaderboard with random cycle counts
			const randomCycles = Math.floor(Math.random() * 50) + 1;
			leaderboard.push({ playerId, cycles: randomCycles });
		}
		
		// Sort leaderboard
		leaderboard = leaderboard.sort((a, b) => b.cycles - a.cycles);
		
		// Create test player stats
		playerStats = {
			Position: 0,
			Money: 15000,
			Income: 1200,
			SkipCost: 5000,
			Cycles: 3
		};
		
		// Add current player to leaderboard
		updateLeaderboard(data.user.id, playerStats.Cycles);
	}

	// Helper function to update the leaderboard
	function updateLeaderboard(playerId: string, cycles: number) {
		const existingEntry = leaderboard.find(entry => entry.playerId === playerId);
		
		if (existingEntry) {
			// Update if the new cycle count is higher
			if (cycles > existingEntry.cycles) {
				existingEntry.cycles = cycles;
				// Sort the leaderboard by cycles in descending order (highest first)
				leaderboard = leaderboard.sort((a, b) => b.cycles - a.cycles);
			}
		} else {
			// Add new entry
			leaderboard = [...leaderboard, {playerId, cycles}].sort((a, b) => b.cycles - a.cycles);
		}
	}

	// Request a leaderboard update periodically
	function setupLeaderboardRefresh() {
		// Request leaderboard updates every 30 seconds
		const intervalId = setInterval(() => {
			if (socket.readyState === WebSocket.OPEN) {
				sendWSGameMessage(socket, { event: 'requestLeaderboard' });
			}
		}, 30000);

		// Clear interval when component is destroyed
		return () => clearInterval(intervalId);
	}

	// Animation transitions
	function slideIn(node: HTMLElement, { delay = 0, duration = 300 }) {
		return {
			delay,
			duration,
			css: (t: number) => {
				const eased = t * t;
				return `
					transform: translateY(${(1 - eased) * 20}px);
					opacity: ${eased};
				`;
			}
		};
	}

	// Format currency with commas
	function formatCurrency(amount: number): string {
		return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	onMount(() => {
		socket = new WebSocket('ws://localhost:8080');
		 // Check URL for test parameter
		const url = new URL(window.location.href);
		const isTestMode = url.searchParams.get('test') === 'true';
		
		if (isTestMode) {
			// Populate with test data instead of connecting to WebSocket
			populateTestData(25);
			return; // Skip WebSocket setup
		}

		// Listen for messages
		socket.addEventListener('message', function (event) {
			const payload = event.data;
			const json: WSGameMessage = JSON.parse(payload);

			switch (json.event) {
				case 'lobbyState': {
					players = json.players;
					playerStats = json.stats;
					 // If server provides leaderboard data, use it
					if (json.leaderboard) {
						leaderboard = json.leaderboard;
					}
					// Otherwise add current player to leaderboard
					else if (playerStats) {
						updateLeaderboard(data.user.id, playerStats.Cycles);
						// Request server-wide leaderboard data
						sendWSGameMessage(socket, { event: 'requestLeaderboard' });
					}
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
				case 'statsUpdate': {
					playerStats = json.stats;
					// Update leaderboard when stats change
					if (playerStats) {
						updateLeaderboard(data.user.id, playerStats.Cycles);
						// Broadcast updated cycles to server
						sendWSGameMessage(socket, {
							event: 'requestLeaderboard'
						});
					}
					break;
				}
				case 'leaderboardUpdate': {
					// Update leaderboard with server data
					leaderboard = json.leaderboard;
					break;
				}
				case 'skipFailed': {
					skipFailedMessage = json.message;
					// Clear the message after 3 seconds
					setTimeout(() => {
						skipFailedMessage = null;
					}, 3000);
					break;
				}
			}
		});

		// Connection opened
		socket.addEventListener('open', function (event) {
			console.log('Connection opened');
			
			// Get a username to send to the server
			let username = '';
			if (data.user.username) {
				username = data.user.username;
			} else if (data.user.firstName && data.user.lastName) {
				username = `${data.user.firstName} ${data.user.lastName}`;
			} else if (data.user.firstName) {
				username = data.user.firstName;
			} else if (data.user.emailAddresses && data.user.emailAddresses.length > 0) {
				username = data.user.emailAddresses[0].emailAddress.split('@')[0];
			}
			
			// Send player join with username
			sendWSGameMessage(socket, {
				event: 'playerJoin',
				player: data.user.id,
				playerName: username
			});

			// Setup periodic leaderboard refresh
			const cleanup = setupLeaderboardRefresh();
			return () => cleanup();
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
			if (!isTestMode) {
				sendWSGameMessage(socket, {
					event: 'playerLeave',
					player: data.user.id
				});
				socket.close();
			}
		};
	});
</script>

<main class="relative p-4 min-h-screen bg-slate-0">
	<div class="mx-auto max-w-6xl flex flex-col md:flex-row gap-6">
	<!-- Main content column -->
	<div class="flex-grow">
		<h1 class="text-2xl font-bold mb-4 text-slate-700">Player Queue</h1>
		
		<div class="flex flex-col md:flex-row gap-6">
			<!-- Stats and Players Column -->
			<div class="flex-grow flex flex-col gap-6">
				{#if playerStats}
					<div class="p-6 bg-white rounded-lg shadow-sm border border-slate-200 transition-all duration-300 hover:shadow-md">
						<h2 class="text-xl font-semibold mb-3 text-slate-700 flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-1.146-.32-2.217-.868-3.127A5 5 0 0010 11z" clip-rule="evenodd" />
							</svg>
							Your Stats
						</h2>
						<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
							<div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
								<div class="text-xs uppercase text-slate-500 font-semibold">Position</div>
								<div class="text-lg font-bold text-slate-700">{playerStats.Position + 1}</div>
							</div>
							<div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
								<div class="text-xs uppercase text-slate-500 font-semibold">Money</div>
								<div class="text-lg font-bold text-slate-700">${formatCurrency(playerStats.Money)}</div>
							</div>
							<div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
								<div class="text-xs uppercase text-slate-500 font-semibold">Income</div>
								<div class="text-lg font-bold text-slate-700">+${formatCurrency(playerStats.Income)}<span class="text-xs font-normal">/10sec</span></div>
							</div>
							<div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
								<div class="text-xs uppercase text-slate-500 font-semibold">Skip Cost</div>
								<div class="text-lg font-bold text-slate-700">${formatCurrency(playerStats.SkipCost)}</div>
							</div>
							<div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
								<div class="text-xs uppercase text-slate-500 font-semibold">Cycles</div>
								<div class="text-lg font-bold text-slate-700">{playerStats.Cycles}</div>
							</div>
						</div>
					</div>
				{/if}

				{#if skipFailedMessage}
					<div transition:slideIn={{ duration: 300 }} class="p-4 bg-red-50 text-red-800 rounded-lg border border-red-200 shadow-sm flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
						</svg>
						{skipFailedMessage}
					</div>
				{/if}
				
				<!-- Players List moved into the stats column -->
				{#if players.length === 0}
					<div class="flex flex-col items-center justify-center p-12 bg-white rounded-lg border border-slate-200 shadow-sm">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-300 mb-4" viewBox="0 0 20 20" fill="currentColor">
							<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
						</svg>
						<p class="text-slate-500 text-lg">Waiting for players to join...</p>
					</div>
				{:else}
					<ul class="flex flex-col gap-4">
						{#each players as player, index}
							<li
								class={cn('bg-white rounded-lg border p-4 shadow-sm transition-all duration-200 hover:shadow-md', {
									'border-slate-400 ring-1 ring-slate-300 bg-slate-50': player === data.user.id,
									'border-slate-200': player !== data.user.id
								})}
								transition:slideIn={{ delay: index * 50 }}
							>
								<div class="flex justify-between items-center">
									<div class="flex items-center gap-3">
										<div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-sm border border-slate-200">
											{index + 1}
										</div>
										<div class="font-medium truncate max-w-[150px] md:max-w-xs" title={player}>
											{getDisplayName(player)}
										</div>
										{#if player === data.user.id}
											<span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">You</span>
										{/if}
									</div>
									{#if player === data.user.id && playerStats}
										<div class="flex items-center text-sm text-slate-600 font-medium">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
												<path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
												<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd" />
											</svg>
											${formatCurrency(playerStats.Income)}/10sec
										</div>
									{/if}
								</div>
								
								{#if index === (currentPlayerPosition + 1) % players.length}
									<div class="mt-2 flex justify-end">
										<div class="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-full flex items-center border border-slate-200">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
												<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" />
											</svg>
											Next in queue
										</div>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			
			<!-- Leaderboard (separate column) -->
			<div class="w-full md:w-80 md:flex-shrink-0 md:block">
				<div class="w-full">
					<div class="p-6 bg-white rounded-lg border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md">
						<h2 class="text-xl font-semibold mb-4 text-slate-700 flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
							</svg>
							Cycles Leaderboard
						</h2>
						<div class="overflow-hidden rounded-lg border border-slate-200">
							{#if leaderboard.length === 0}
								<div class="p-8 text-center text-slate-500 bg-slate-50">
									<p>No cycle data yet</p>
								</div>
							{:else}
								<div class="max-h-[60vh] overflow-y-auto">
									<table class="w-full text-sm">
										<thead class="bg-slate-50 sticky top-0">
											<tr>
												<th class="px-4 py-3 text-left text-slate-700 font-semibold">Rank</th>
												<th class="px-4 py-3 text-left text-slate-700 font-semibold">Player</th>
												<th class="px-4 py-3 text-left text-slate-700 font-semibold">Cycles</th>
											</tr>
										</thead>
										<tbody>
											{#each leaderboard as entry, i}
												<tr class={cn("border-t border-slate-200 transition-colors", {
													"bg-slate-50": entry.playerId === data.user.id,
													"hover:bg-slate-50": entry.playerId !== data.user.id
												})}>
													<td class="px-4 py-3 font-medium">
														<div class="flex items-center">
															{#if i === 0}
																<span class="font-bold text-slate-800">#1</span>
															{:else if i === 1}
																<span class="font-bold text-slate-700">#2</span>
															{:else if i === 2}
																<span class="font-bold text-slate-600">#3</span>
															{:else}
																#{i + 1}
															{/if}
														</div>
													</td>
													<td class="px-4 py-3 truncate max-w-[100px]" title={entry.playerId}>
														<span class={entry.playerId === data.user.id ? "font-medium" : ""}>
															{getDisplayName(entry.playerId)}
														</span>
														{#if entry.playerId === data.user.id}
															<span class="ml-1 inline-block w-2 h-2 bg-slate-400 rounded-full"></span>
														{/if}
													</td>
													<td class="px-4 py-3 font-medium">{entry.cycles}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	
	<button
		onclick={() => {
			if (!playerStats || players.length <= 1) return;
			
			let nextPlayerPosition =
				currentPlayerPosition + 1 >= players.length ? 0 : currentPlayerPosition + 1;

			// Only allow skip if player has enough money
			if (playerStats.Money >= playerStats.SkipCost) {
				sendWSGameMessage(socket, {
					event: 'playerSkip',
					skipper: data.user.id,
					skipped: players[nextPlayerPosition]
				});
			} else {
				skipFailedMessage = "You don't have enough money to skip!";
				setTimeout(() => {
					skipFailedMessage = null;
				}, 3000);
			}
		}}
		class="fixed right-0 bottom-6 left-0 mx-auto w-64 h-14 cursor-pointer rounded-full bg-slate-700 px-6 py-4 font-bold text-white shadow-lg transition-all duration-200 outline-none focus-within:ring-2 focus-within:ring-slate-300 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
		disabled={!playerStats || playerStats.Money < playerStats.SkipCost || players.length <= 1}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd" />
			<path fill-rule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd" />
		</svg>
		Skip (${formatCurrency(playerStats?.SkipCost || 0)})
	</button>
	
	<button
		onclick={async () => {
			try {
				await clerkCtx.clerk?.signOut();
			} catch (e) {
				if (e instanceof Error) alert(e.message);
			}
			goto('/sign-in');
		}}
		class="fixed top-4 right-4 cursor-pointer rounded-full bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 outline-none focus-within:ring-2 focus-within:ring-slate-300 hover:shadow-sm hover:bg-slate-50 flex items-center gap-1"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
		</svg>
		Sign Out
	</button>
	</div>
</main>
