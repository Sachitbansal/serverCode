const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game state
let gameState = {
  students: [],
  currentQuestion: null,
  questionIndex: 0,
  quizStarted: false,
  answers: {},
  leaderboard: []
};

// Socket connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Student joins quiz
  socket.on('join-quiz', (data) => {
    const student = {
      id: socket.id,
      name: data.name,
      score: 0,
      connected: true
    };
    
    gameState.students.push(student);
    gameState.leaderboard.push(student);
    
    socket.emit('joined-quiz', student);
    io.emit('student-joined', student);
    
    console.log(`Student ${data.name} joined the quiz`);
  });

  // Examiner starts quiz
  socket.on('start-quiz', (data) => {
    gameState.quizStarted = true;
    gameState.currentQuestion = data.question;
    gameState.questionIndex = data.questionIndex;
    gameState.answers = {};
    
    io.emit('quiz-started', {
      question: data.question,
      questionIndex: data.questionIndex
    });
    
    console.log('Quiz started with question:', data.question.question);
  });

  // Next question
  socket.on('next-question', (data) => {
    gameState.currentQuestion = data.question;
    gameState.questionIndex = data.questionIndex;
    gameState.answers = {};
    
    io.emit('next-question', {
      question: data.question,
      questionIndex: data.questionIndex
    });
    
    console.log('Next question:', data.question.question);
  });

  // Student submits answer
  socket.on('submit-answer', (data) => {
    const student = gameState.students.find(s => s.id === socket.id);
    if (student && !gameState.answers[socket.id]) {
      gameState.answers[socket.id] = data;
      
      // Update student score
      if (data.correct) {
        student.score += data.points;
      }
      
      // Update leaderboard
      gameState.leaderboard = gameState.students
        .filter(s => s.connected)
        .sort((a, b) => b.score - a.score);
      
      // Send result back to student
      socket.emit('answer-result', {
        correct: data.correct,
        score: student.score,
        points: data.points
      });
      
      // Broadcast updated leaderboard
      io.emit('leaderboard-update', gameState.leaderboard);
      
      console.log(`${student.name} answered: ${data.answer} (${data.correct ? 'Correct' : 'Wrong'}) - ${data.points} points`);
    }
  });

  // Show results
  socket.on('show-results', () => {
    io.emit('show-results');
    io.emit('leaderboard-update', gameState.leaderboard);
  });

  // Quiz ended
  socket.on('quiz-ended', () => {
    io.emit('quiz-ended');
    io.emit('leaderboard-update', gameState.leaderboard);
    console.log('Quiz ended');
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const studentIndex = gameState.students.findIndex(s => s.id === socket.id);
    if (studentIndex !== -1) {
      const student = gameState.students[studentIndex];
      student.connected = false;
      console.log(`Student ${student.name} disconnected`);
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});