export type Stats = {
	Income: number;
	SkipCost: number;
	Money: number;
	Position: number;
	Cycles: number;
};

export type LeaderboardEntry = {
	playerId: string;
	playerName?: string; // Add optional playerName field
	cycles: number;
};

export type WSGameMessage =
	| { event: 'playerJoin'; player: string; playerName?: string } // Add optional playerName
	| { event: 'playerLeave'; player: string }
	| { event: 'playerSkip'; skipper: string; skipped: string }
	| { event: 'lobbyState'; players: string[]; stats: Stats; leaderboard?: LeaderboardEntry[] }
	| { event: 'statsUpdate'; stats: Stats }
	| { event: 'leaderboardUpdate'; leaderboard: LeaderboardEntry[] }
	| { event: 'skipFailed'; message: string }
	| { event: 'requestLeaderboard' };

export function sendWSGameMessage(ws: WebSocket, wsGameMessage: WSGameMessage) {
	ws.send(JSON.stringify(wsGameMessage));
}
