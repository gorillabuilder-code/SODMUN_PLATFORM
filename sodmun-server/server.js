import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your Vite frontend URL
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// --- OPENROUTER API PROXY (SODDY BOT) ---
app.post('/api/soddy', async (req, res) => {
  try {
    const { messages } = req.body;
    
    // Inject a system prompt so Soddy knows who it is
    const systemPrompt = {
      role: "system",
      content: "You are Soddy, the official AI assistant for SODMUN (Model UN). You are an expert in MUN Rules of Procedure. Be concise, helpful, and formal but friendly."
    };

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: "google/gemini-2.5-flash", // Fast, great for text
      messages: [systemPrompt, ...messages]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data.choices[0].message);
  } catch (error) {
    console.error("Soddy Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Soddy is currently unavailable." });
  }
});

// --- SOCKET.IO (LIVE RESOLUTIONS & CHAT) ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a specific room (Committee or Bloc)
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  // Handle live typing in Resolutions
  socket.on('edit_resolution', (data) => {
    // data = { roomId: 'resolution_1', content: '...' }
    // Broadcast to everyone in the room EXCEPT the sender
    socket.to(data.roomId).emit('resolution_updated', data.content);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`SODMUN Server running on port ${PORT}`));