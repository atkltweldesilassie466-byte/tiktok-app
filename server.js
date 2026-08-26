const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// የ MongoDB ዳታቤዝ ግንኙነት
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Successfully Connected!'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Schema እና Model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  coins: { type: Number, default: 10 }
});

const taskSchema = new mongoose.Schema({
  url: { type: String, required: true },
  videoId: { type: String, required: true },
  budget: { type: Number, required: true },
  maxCompletions: { type: Number, required: true },
  completedCount: { type: Number, default: 0 },
  rewardPerWatch: { type: Number, default: 10 },
  completedBy: [{ type: String }]
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);

// አጭር ወይም ረጅም ሊንክን ወደ Video ID የመቀየር ተግባር
async function resolveTikTokVideoId(url) {
  let match = url.match(/(\d{15,20})/);
  if (match) return match[1];

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });
    const finalUrl = response.url;
    match = finalUrl.match(/(\d{15,20})/);
    return match ? match[1] : null;
  } catch (err) {
    console.error('URL Resolve Error:', err);
    return null;
  }
}

// APIs
app.post('/api/register', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "እባክዎን ኢሜይል ያስገቡ!" });

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, coins: 10 });
      await user.save();
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "የሰርቨር ስህተት ተፈጥሯል!" });
  }
});

app.get('/api/user', async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    if (!user) return res.json({ loggedIn: false });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "መረጃ ማግኘት አልተቻለም!" });
  }
});

app.post('/api/add-task', async (req, res) => {
  try {
    const { email, url, budget } = req.body;
    if (budget < 100) return res.status(400).json({ error: "ቪዲዮ ለመለቀቅ ቢያንስ 100 ኮይን ያስፈልጋል!" });

    // አጭር ሊንክ ከሆነ ወደ Video ID መቀየር
    const videoId = await resolveTikTokVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: "ትክክለኛ የቲክቶክ ቪዲዮ ሊንክ ማግኘት አልተቻለም! እባክዎን ሊንኩን ያረጋግጡ።" });
    }

    const user = await User.findOne({ email });
    if (!user || user.coins < budget) {
      return res.status(400).json({ error: "በቂ ኮይን የለዎትም!" });
    }

    user.coins -= budget;
    await user.save();

    const newTask = new Task({
      url,
      videoId,
      budget,
      maxCompletions: budget * 2,
      rewardPerWatch: 10
    });
    await newTask.save();

    res.json({ success: true, coins: user.coins });
  } catch (err) {
    res.status(500).json({ error: "ቪዲዮውን መለቀቅ አልተቻለም!" });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({ $expr: { $lt: ["$completedCount", "$maxCompletions"] } });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "ስራዎችን ማግኘት አልተቻለም!" });
  }
});

app.post('/api/complete-task', async (req, res) => {
  try {
    const { email, taskId } = req.body;
    const task = await Task.findById(taskId);
    const user = await User.findOne({ email });

    if (!task || !user) return res.status(404).json({ error: "መረጃው አልተገኘም!" });

    if (task.completedBy.includes(email)) {
      return res.status(400).json({ error: "ይህንን ቪዲዮ ቀደም ብለው ተመልከተዋል!" });
    }

    if (task.completedCount >= task.maxCompletions) {
      return res.status(400).json({ error: "የዚህ ቪዲዮ የስራ ቦታ አልቋል!" });
    }

    task.completedCount += 1;
    task.completedBy.push(email);
    await task.save();

    user.coins += task.rewardPerWatch;
    await user.save();

    res.json({ success: true, coins: user.coins });
  } catch (err) {
    res.status(500).json({ error: "ስራውን ማጠናቀቅ አልተቻለም!" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
