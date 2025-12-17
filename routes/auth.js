// user-server/routes/auth.js - চূড়ান্ত ফিক্সড ভার্সন

const express = require('express');
const jwt = require('jsonwebtoken');

// 🔴 Note: এই ফাংশনটি users কালেকশন (collection) গ্রহণ করে
module.exports = function(userCollection) {
    const router = express.Router();
    
    // ------------------------------------------------------------------
    // ১. JWT টোকেন তৈরি করা (লগইন/সাইনআপ এর পরে)
    // URL: POST /api/v1/auth/jwt
    // ------------------------------------------------------------------
    router.post('/jwt', async (req, res) => {
        const user = req.body;
        
        const tokenPayload = { email: user.email }; 
        
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not defined.");
            return res.status(500).send({ message: "Server configuration error." });
        }

        try {
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

            const dbUser = await userCollection.findOne(
                { email: user.email },
                { projection: { role: 1, status: 1 } }
            );

            let role = 'donor';
            let status = 'active';

            if (dbUser) {
                role = dbUser.role || 'donor';
                status = dbUser.status || 'active';
            }
            
            res.send({ token, role, status });
            
        } catch (error) {
            console.error("JWT creation error:", error);
            res.status(500).send({ message: "Failed to create JWT or fetch user role." });
        }
    });


    // ------------------------------------------------------------------
    // ২. নতুন ইউজারকে ডাটাবেসে সেভ করা (সাইনআপ এর পরে)
    // URL: POST /api/v1/auth/register 
    // ------------------------------------------------------------------
    router.post('/register', async (req, res) => { 
        const user = req.body;
        
        // 🔥🔥🔥 ফিক্স: ১. ফোন নম্বর অবশ্যই পূরণীয় (Required) যাচাই 🔥🔥🔥
        if (!user.phoneNumber || user.phoneNumber.trim() === '') {
            // যদি ফোন নম্বর না থাকে বা খালি স্ট্রিং হয়
            console.log("❌ Registration blocked: Missing phone number.");
            return res.status(400).send({ message: "ফোন নম্বর অবশ্যই পূরণীয়।" });
        }
        // 🔥🔥🔥 ফিক্স শেষ 🔥🔥🔥

        const query = { email: user.email };
        
        // ডাটাবেসে ইউজারটি আগে থেকেই আছে কিনা তা চেক করা
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
            // ইউজার থাকলে
            console.log(`💡 User ${user.email} already exists.`);
            return res.send({ 
                message: 'User already exists', 
                role: existingUser.role || 'donor', 
                status: existingUser.status || 'active' 
            });
        }
        
        // নতুন ইউজার হলে ডাটাবেসে সেভ করা
        const newUser = {
            email: user.email.toLowerCase(), // ইমেইল সর্বদা লোয়ারকেস করা হলো
            name: user.name || 'Anonymous User', 
            photoURL: user.photoURL || null,
            
            // 🔥🔥🔥 ফিক্স: ২. phoneNumber ডেটাবেসে যুক্ত করা হলো (উপরে চেক করা হয়েছে তাই এটি থাকবেই) 🔥🔥🔥
            phoneNumber: user.phoneNumber.trim(), 

            // এই ফিল্ডগুলো রেজিস্ট্রেশন ফর্মে থাকলে যোগ করুন (ডিফল্ট ভ্যালু সহ):
            bloodGroup: user.bloodGroup || 'A+', 
            district: user.district || 'N/A',
            upazila: user.upazila || 'N/A', 
            role: 'donor', 
            status: 'active', 
            createdAt: new Date(),
        };

        try {
            const result = await userCollection.insertOne(newUser);
            
            console.log(`✅ New user registered: ${user.email}`);
            res.send({ 
                result, 
                message: 'User successfully saved', 
                role: 'donor', 
                status: 'active' 
            });
        } catch (error) {
            console.error("Error inserting new user:", error);
            res.status(500).send({ message: "Internal Server Error during user insertion." });
        }
    });


    return router;
};