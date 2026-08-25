const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

let currentUser = null; 
let tasks = [];

// 1. ምዝገባ (Email Registration + 10 Free Coins)
app.post('/api/register', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "እባክዎን ኢሜይል ያስገቡ!" });
  }

  currentUser = {
    email: email,
    coins: 10
  };

  res.json({ success: true, user: currentUser });
});

// 2. የተጠቃሚ መረጃ ማሳወቂያ
app.get('/api/user', (req, res) => {
  res.json(currentUser || { loggedIn: false });
});

// 3. አዲስ ቪዲዮ መለቀቂያ (ከ 100 ኮይን ጀምሮ | 1 Coin = 2 Views)
app.post('/api/add-task', (req, res) => {
  if (!currentUser) {
    return res.status(401).json({ error: "መጀመሪያ ይግቡ!" });
  }

  const { url, budget } = req.body;

  if (budget < 100) {
    return res.status(400).json({ error: "ቪዲዮ ለመለቀቅ ቢያንስ 100 ኮይን ያስፈልጋል!" });
  }

  if (currentUser.coins < budget) {
    return res.status(400).json({ error: "በቂ ኮይን የለዎትም!" });
  }

  const maxCompletions = budget * 2; // 1 Coin = 2 Views
  currentUser.coins -= budget;

  const newTask = {
    id: Date.now(),
    url,
    budget,
    maxCompletions,
    completedCount: 0,
    rewardPerWatch: 10
  };

  tasks.push(newTask);
  res.json({ success: true, coins: currentUser.coins });
});

// 4. የነበሩ ስራዎች ዝርዝር
app.get('/api/tasks', (req, res) => {
  const activeTasks = tasks.filter(t => t.completedCount < t.maxCompletions);
  res.json(activeTasks);
});

// 5. ቪዲዮ አይቶ 10 ኮይን መቀበያ
app.post('/api/complete-task', (req, res) => {
  if (!currentUser) {
    return res.status(401).json({ error: "መጀመሪያ ይግቡ!" });
  }

  const { taskId } = req.body;
  const task = tasks.find(t => t.id === taskId);

  if (task && task.completedCount < task.maxCompletions) {
    task.completedCount += 1;
    currentUser.coins += task.rewardPerWatch;
    return res.json({ success: true, coins: currentUser.coins });
  }

  res.status(400).json({ error: "ስራው አልቋል ወይም አልተገኘም!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
