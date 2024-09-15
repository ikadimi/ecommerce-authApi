const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const secret = 'secret';
const User = require('../models/user.model'); // Adjust path as necessary


function authenticateToken(req, res, next) {
    const token = req.cookies.jwt; // Read token from cookies
    if (token == null) return res.sendStatus(401); // No token
  
    jwt.verify(token, secret, (err, user) => {
      if (err) return res.sendStatus(403); // Invalid token
      req.user = user;
      next();
    });
}

router.get('/me', authenticateToken, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
    });
});

router.post('/login', async (req, res) => {
    try {
        console.log(req.body)
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check if the password matches
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id, username: user.username }, secret);
        res.cookie('jwt', token, { httpOnly: true });

        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Create a new user
        const user = new User({ username, email, password });
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
});

router.post('/logout', (req, res) => {
    res.cookie('jwt', '', { 
        httpOnly: true,
        expiryDate: new Date(0)
     });
    res.json({ message: 'Logout successful' });
});

module.exports = router;
