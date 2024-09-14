// Importing required modules
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// Creating an Express application instance
const app = express();
const PORT = 3001;

// Enable CORS
app.use(cors({
  credentials: true,
  origin: 'http://localhost:4200'
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

// Enable cookies
app.use(cookieParser());


// Connect to MongoDB database
const url = 'mongodb://localhost:27017';
const dbName = 'ecommerce';
mongoose.connect(`${url}/${dbName}`)
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// Define a schema for the User collection
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    min: 3,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    min: 6,
  },
  password: {
    type: String,
    required: true,
    min: 6,
  }
});

// Create a User model based on the schema
const User = mongoose.model('User', userSchema);

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware for JWT validation
// const verifyToken = (req, res, next) => {
//   const token = req.cookies.jwt_token
//   if (!token) {
//     return res.status(401).json({ message: 'Unauthorized' });
//   }

//   jwt.verify(token, 'secret', (err, decoded) => {
//     if (err) {
//       return res.status(401).json({ message: 'Unauthorized' });
//     }
//     req.user = decoded;
//     next();
//   });
// };

// Route to register a new user
app.post('/register', async (req, res) => {
  try {
    // Check if the email already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create a new user
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword
    });
    
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.log({...error})
    res.status(500).json({ message: error._message || 'Internal server error' });
  }
});

// Route to authenticate and log in a user
app.post('/login', async (req, res) => {
  try {
    // Check if the email exists
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, 'secret');
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });
    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ message: error._message || 'Internal server error' });
  }
});

app.post('/logout', (req, res) => {
  res.cookie('jwt', '', { 
    httpOnly: true, 
    secure: true,  // if using https
    sameSite: 'Strict', 
    expires: new Date(0)  // Setting cookie expiration to a past date
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});