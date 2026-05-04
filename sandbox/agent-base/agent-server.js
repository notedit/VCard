import { WebSocketServer } from 'ws';
import { createCard, proposeSuggestion } from './tools/index.js';

const wss = new WebSocketServer({ port: 7000 });

wss.on('connection', ws => {
  ws.on('message', raw => {
    const msg = JSON.parse(String(raw));
    if (msg.cmd === 'plan') {
      const card = createCard(0, 'cover', `${msg.topic}｜封面`, '自动生成示例');
      ws.send(JSON.stringify({ event: 'card', data: card }));
      const suggestion = proposeSuggestion(card.id, 'structure', '建议补一张清单卡', { insertAfter: 0 });
      ws.send(JSON.stringify({ event: 'suggestion', data: suggestion }));
      ws.send(JSON.stringify({ event: 'done' }));
    }
  });
});

console.log('agent-base ws://localhost:7000');
