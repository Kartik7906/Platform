const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const fs = require("fs");
const fsPromises = fs.promises;
const axios = require("axios");
const connectDB = require("./Config/database");
const cookieParser = require("cookie-parser");

dotenv.config();
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);


app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));

app.use(express.static(path.join(__dirname, '../client/dist')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/users", require("./Routes/UserRoute"));
app.use("/api/leaderboard", require("./Routes/LeaderboardRoute"));
app.use("/api/admin", require("./Routes/AdminRoutes"));
app.use("/api/profile", require("./Routes/ProfileRoute"));
app.use('/api/logout', require("./Routes/LogoutRoute"));

app.get('/', (req, res) => {
  res.send("Welcome to the backend server NodeJs!");
});

// Create a reference to the retail training collection
// This will use the existing mongoose connection
const getRetailTrainingCollection = () => {
  return mongoose.connection.db.collection('user_retail_training');
};

app.get('/api/debug/retail-training/:userId', async (req, res) => {
  try {
    const collection = getRetailTrainingCollection();
    const result = await collection.findOne({ user_id: req.params.userId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/profile/retail-training/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    // console.log(`Fetching retail training data for user ID: ${userId}`);
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const collection = getRetailTrainingCollection();
    
    // Log available collections to verify the collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    // console.log("Available collections:", collections.map(c => c.name));
    
    // Log document count to verify collection has data
    const count = await collection.countDocuments();
    // console.log(`Total documents in collection: ${count}`);
    
    // Find the document by user_id as string
    // console.log(`Searching for document with user_id: ${userId}`);
    const userData = await collection.findOne({ user_id: userId });
    
   
    
    
    if (!userData) {
      // console.log(`No retail training data found for user: ${userId}`);
      return res.json({ 
        user_id: userId,
        scenarios: [] 
      });
    }
    
    // Ensure the data structure is complete
    if (!userData.scenarios) {
      userData.scenarios = [];
    }
    
    // console.log(`Found ${userData.scenarios.length} scenarios for user`);
    
    // Return the document with minimal processing
    res.json(userData);
  } catch (error) {
    console.error('Error fetching retail training data:', error);
    res.status(500).json({ message: 'Server error retrieving retail training data' });
  }
});

// Removed the Gemini API configuration that was commented out

app.post("/api/chat", async (req, res) => {
  try {
    const { userMessage } = req.body;

    const response = await axios.post(GEMINI_URL, {
      contents: [{ parts: [{ text: userMessage }] }]
    });

    const botReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process that.";
    res.json({ botReply });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// General error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

// database connection and start server code here 
const startServer = async () => {
    try {
        await connectDB(MONGODB_URI);
        app.listen(PORT, () => {
            console.log(`Server running on port: ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};
startServer();
// end of database connection and start server code here 