// user-server/middlewares/verifyJWT.js

const jwt = require('jsonwebtoken');

const verifyJWT = (req, res, next) => {
    
    const authorizationHeader = req.headers.authorization;

    // ১. Authorization Header চেক করা
    if (!authorizationHeader) {
        return res.status(401).send({ message: 'Unauthorized Access: Missing Authorization Header' });
    }

    // ২. টোকেন এক্সট্র্যাক্ট করা ("Bearer tokenValue" থেকে tokenValue)
    const token = authorizationHeader.split(' ')[1]; 
    
    const secret = process.env.JWT_SECRET; // আপনার JWT সিক্রেট কী

    // ৩. টোকেন ভেরিফিকেশন
    jwt.verify(token, secret, (err, decoded) => {
        //  এখানে বসাতে হবে 
        if (err) {
            // ত্রুটি দেখা দিলে সার্ভার কনসোলে বিস্তারিত লগ করা
            console.error("JWT Verification Failed:", err.message); 
            
            // ক্লায়েন্টকে 403 Forbidden স্ট্যাটাস কোড পাঠানো
            return res.status(403).send({ message: 'Forbidden Access: Invalid or expired token.' });
        }

        // টোকেন বৈধ হলে ডিকোড করা ডেটা রিকোয়েস্ট অবজেক্টে যোগ করে নেক্সট মিডলওয়্যারে যাওয়া
        req.decoded = decoded;
        next();
    });
};

module.exports = verifyJWT;