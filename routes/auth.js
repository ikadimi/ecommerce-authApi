const express = require('express');
const router = express.Router();
const amqp = require('amqplib');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // Adjust path as necessary
const createResponse = require('../models/response.model');


function authenticateToken(req, res, next) {
    const token = req.cookies.jwt; // Read token from cookies
    if (token == null) return res.sendStatus(401); // No token
  
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403); // Invalid token
      req.user = user;
      next();
    });
}

async function publishEmail(mail) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      const channel = await connection.createChannel();
      const queue = 'email_queue';
  
      await channel.assertQueue(queue, { durable: true });
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(mail)), { persistent: true });
  
      console.log('Email request sent to queue');
      await channel.close();
      await connection.close();
    } catch (error) {
      console.error('Failed to send email request to queue:', error);
    }
}

router.get('/me', authenticateToken, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
    });
});

router.get('/user/:id', async (req, res) => {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ username: user.username, email: user.email });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email before logging in.' });
        }

        // Check if the password matches
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET);
        res.cookie('jwt', token, { httpOnly: true });

        res.status(200).json(createResponse(true, 'Login successful'));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/verify-email', async (req, res) => {
    const { token } = req.body;
    
    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find the user by email
      const user = await User.findOne({ email: decoded.email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid token or user does not exist' });
      }
  
      // Update the user's verification status
      user.isVerified = true;
      await user.save();
  
      res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
      
    } catch (err) {
      res.status(400).json({ message: 'Invalid or expired token' });
    }
});
  

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Create a new user
        const newUser = new User({ username, email, password, isVerified: false });
        await newUser.save();

        const token = jwt.sign({ email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '1d' });

        const verificationLink = `http://localhost:4200/login?verification_token=${token}`;

        // Send the verification email
        await publishEmail({
            to: newUser.email,
            subject: 'ECOMMERCE: Verify Your Email',
            text: `Click the link to verify your email: ${verificationLink}`,
            html: `<p>Click <a href="${verificationLink}">here</a> to verify your email.</p>`
        });

        res.status(201).json(createResponse(true, 'Registration successful. Please check your email to verify your account.'));
    } catch (error) {
        console.error('Registration error:', {...error});
        res.status(500).json({ message: error.message });
    }
});

router.post('/logout', (req, res) => {
    res.cookie('jwt', '', { 
        httpOnly: true,
        expires: new Date(0),
     });
    res.json({ message: 'Logout successful' });
});

module.exports = router;
