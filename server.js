import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const rooms = new Map();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_,res)=>res.json({ok:true}));
function code(){return Math.random().toString(36).slice(2,6).toUpperCase()}
function newRoom(){let c; do{c=code()}while(rooms.has(c)); return {code:c,players:[],ball:{x:.5,y:.5,vx:.008,vy:.003},score:[0,0],started:false};}
function state(r){return {players:r.players.map(p=>({id:p.id,x:p.x,y:p.y,side:p.side,name:p.name})),ball:r.ball,score:r.score,started:r.started};}
function resetBall(r,dir=1){r.ball={x:.5,y:.5,vx:.008*dir,vy:(Math.random()-.5)*.006};}
io.on('connection',socket=>{
 socket.on('create',({name='Player 1'}={})=>{const r=newRoom();r.players.push({id:socket.id,x:.08,y:.5,side:0,name});socket.join(r.code);socket.data.room=r.code;socket.data.side=0;socket.emit('joined',{code:r.code,side:0,state:state(r)});});
 socket.on('join',({code,name='Player 2'}={})=>{const r=rooms.get(String(code||'').toUpperCase()); if(!r)return socket.emit('errorMsg','Room not found.'); if(r.players.length>=2)return socket.emit('errorMsg','Room is full.'); r.players.push({id:socket.id,x:.92,y:.5,side:1,name});socket.join(r.code);socket.data.room=r.code;socket.data.side=1;r.started=true;resetBall(r,1);io.to(r.code).emit('joined',{code:r.code,side:1,state:state(r)});io.to(r.code).emit('state',state(r));});
 socket.on('input',({dy=0,hit=false}={})=>{const r=rooms.get(socket.data.room);if(!r)return;const p=r.players.find(x=>x.id===socket.id);if(!p)return;p.y=Math.max(.15,Math.min(.85,p.y+dy*.045)); if(hit) p.lastHit=Date.now();io.to(r.code).emit('state',state(r));});
 socket.on('restart',()=>{const r=rooms.get(socket.data.room);if(!r||r.players.length<2)return;r.score=[0,0];r.started=true;r.players.forEach((p,i)=>p.y=.5);resetBall(r,Math.random()<.5?-1:1);io.to(r.code).emit('state',state(r));});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.room);if(!r)return;r.players=r.players.filter(p=>p.id!==socket.id);r.started=false;io.to(r.code).emit('opponentLeft');if(!r.players.length)rooms.delete(r.code);else io.to(r.code).emit('state',state(r));});
});
setInterval(()=>{for(const r of rooms.values()){if(!r.started||r.players.length<2)continue;const b=r.ball;b.x+=b.vx;b.y+=b.vy;if(b.y<.08||b.y>.92)b.vy*=-1;const p1=r.players[0],p2=r.players[1];if(b.vx<0&&b.x<.13&&Math.abs(b.y-p1.y)<.18){b.vx=Math.abs(b.vx)*1.03;b.x=.14;b.vy=(b.y-p1.y)*.025;}if(b.vx>0&&b.x>.87&&Math.abs(b.y-p2.y)<.18){b.vx=-Math.abs(b.vx)*1.03;b.x=.86;b.vy=(b.y-p2.y)*.025;}if(b.x<0){r.score[1]++; if(r.score[1]>=5){r.started=false;io.to(r.code).emit('state',state(r));io.to(r.code).emit('winner',1);}else resetBall(r,1);}if(b.x>1){r.score[0]++; if(r.score[0]>=5){r.started=false;io.to(r.code).emit('state',state(r));io.to(r.code).emit('winner',0);}else resetBall(r,-1);}io.to(r.code).emit('state',state(r));}}
},30);
const PORT=process.env.PORT||3000;httpServer.listen(PORT,()=>console.log(`Tennis Duel running on ${PORT}`));
