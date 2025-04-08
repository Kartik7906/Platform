const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
    try {
        // Clear the authentication cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            domain: process.env.NODE_ENV === "production" ? ".yourdomain.com" : undefined,
            expires: new Date(0) // Set expiration to past date to remove the cookie
        });

        res.status(200).json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error during logout' 
        });
    }
});

module.exports = router;
