export type WSGameMessage = 
  | { event: 'playerJoin', player: string }
  | { event: 'playerLeave', player: string }
  | { event: 'playerSkip', skipper: string, skipped: string };

export function sendWSGameMessage(ws: WebSocket, wsGameMessage: WSGameMessage) {
  ws.send(JSON.stringify(wsGameMessage));
}

