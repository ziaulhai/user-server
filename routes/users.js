// user-server/routes/users.js (সম্পূর্ণ কোড)

const express = require('express');
const verifyJWT = require('../middlewares/verifyJWT');
const { ObjectId } = require('mongodb');
const verifyAdmin = require('../middlewares/verifyAdmin');

module.exports = function (userCollection) {
    const router = express.Router();

    const adminChecker = verifyAdmin(userCollection);

    // ==================================================================
    // 🔥 ফিক্সড রুটগুলি (কোনো প্যারামিটার নেই) - সবার প্রথমে রাখা হলো 🔥
    // ==================================================================
    
    // --- টেস্টিং রুট: নিশ্চিত করার জন্য যে রাউটার কাজ করছে ---
    router.get('/test-route', (req, res) => {
        console.log("🟢 [TEST] Router successfully loaded and /test-route hit!");
        res.send({ message: "Users Router is working fine!" });
    });
   


    // ------------------------------------------------------------------
    // ১. GET রুট: ডোনার সার্চ করা (Public)
    // ------------------------------------------------------------------
    router.get('/donors-search', async (req, res) => {
        const { district, upazila, bloodGroup } = req.query;
        // শুধুমাত্র 'donor' রোলের এবং 'active' স্ট্যাটাসের ইউজারদের সার্চ করা হবে
        const query = { role: 'donor', status: 'active' }; 

        //  সংশোধিত লজিক: নিশ্চিত করা হচ্ছে যে ভ্যালু উপস্থিত এবং খালি স্ট্রিং না
        
        if (district && district.trim() !== '') {
            // কেস-ইনসেনসিটিভ রেজেক্স ম্যাচ
            query.district = { $regex: new RegExp(district.trim(), 'i') };
        }
        
        if (upazila && upazila.trim() !== '') {
            // কেস-ইনসেনসিটিভ রেজেক্স ম্যাচ
            query.upazila = { $regex: new RegExp(upazila.trim(), 'i') };
        }
        
        // blood group এর জন্য রেজেক্স এর পরিবর্তে সম্পূর্ণ ম্যাচ ব্যবহার করা হলো
        if (bloodGroup && bloodGroup.trim() !== '') {
            query.bloodGroup = bloodGroup.trim(); 
        }
     

        try {
            
            const donors = await userCollection.find(query, { 
                projection: { 
                    password: 0 
                } 
            }).toArray();

            if (donors.length === 0) {
                return res.send({ donors: [], message: "এই স্থানে কোনো অ্যাকটিভ ডোনার খুঁজে পাওয়া যায়নি।" });
            }

            res.send({ donors: donors, count: donors.length });

        } catch (error) {
            console.error("Error searching donors:", error);
            res.status(500).send({ message: "Internal Server Error: Failed to search donors.", details: error.message });
        }
    });


    // ------------------------------------------------------------------
    // ২. GET রুট: সব ইউজার লোড করা (Admin Protected)
    // ------------------------------------------------------------------
    router.get('/', verifyJWT, adminChecker, async (req, res) => {
        try {
            // অ্যাডমিন ভিউতে পাসওয়ার্ড বাদে সব ডেটা লোড করা
            const users = await userCollection.find({}, { projection: { password: 0 } }).toArray();
            res.send(users);
        } catch (error) {
            console.error("Error fetching all users:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });



    // ------------------------------------------------------------------
    // ৩. GET রুট: ইউজার রোল চেক করা (ফিক্সড প্রিফিক্স প্যারামিটার রুট)
    // ------------------------------------------------------------------
    router.get('/role/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;
        const decodedEmail = req.decoded?.email?.toLowerCase();
        const paramEmail = email.toLowerCase();

        // নিরাপত্তা যাচাই: JWT-তে থাকা ইমেইল এবং প্যারামিটার ইমেইল একই হতে হবে।
        if (decodedEmail !== paramEmail) {
            return res.status(403).send({ role: 'donor', message: "Forbidden: You can only check your own role." });
        }

        try {
            const user = await userCollection.findOne(
                { email: paramEmail }, 
                { projection: { role: 1, status: 1 } }
            );

            if (!user) {
                // ইউজার না পেলে, ক্লায়েন্টকে ডিফল্ট রোল/স্ট্যাটাস পাঠানো
                return res.status(200).send({ role: 'donor', status: 'active', message: "User not found in DB, assuming default role." });
            }

            res.send({ role: user.role || 'donor', status: user.status || 'active' });

        } catch (error) {
            console.error("Error fetching user role:", error);
            res.status(500).send({ role: 'donor', message: "Internal Server Error during role check." });
        }
    });


    // ------------------------------------------------------------------
    // ৪. PATCH রুট: ইউজার রোল এবং স্ট্যাটাস পরিবর্তন (Admin Protected)
    // ------------------------------------------------------------------
    router.patch('/role-status/:id', verifyJWT, adminChecker, async (req, res) => {
        const id = req.params.id;
        const { role, status } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid user ID format." });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {};

        if (role && ['admin', 'volunteer', 'donor'].includes(role)) {
            updateDoc.role = role;
        }

        if (status && ['active', 'blocked'].includes(status)) {
            updateDoc.status = status;
        }

        if (Object.keys(updateDoc).length === 0) {
            return res.send({ acknowledged: true, modifiedCount: 0, message: "No updatable fields provided." });
        }

        try {
            const result = await userCollection.updateOne(
                filter,
                { $set: updateDoc }
            );
            res.send(result);
        } catch (error) {
            console.error("Error updating user role/status:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });


    // ==================================================================
    // 🔥 জেনেরিক প্যারামিটার রুটগুলো (/:email) - একদম শেষে রাখা হলো 🔥
    // ==================================================================

    // ------------------------------------------------------------------
    // ৫. GET রুট: ইমেইল দ্বারা একক ইউজার প্রোফাইল লোড করা 
    // (JWT ছাড়া, রেজিস্ট্রেশনের সময় বিদ্যমান ইউজার চেক করার জন্য ব্যবহৃত হতে পারে)
    // ------------------------------------------------------------------
    router.get('/:email', async (req, res) => {
        
        // 🔥 1. এই লগটি যদি দেখা যায়, তবে রুট হ্যান্ডলারটি হিট হয়েছে।
        console.log(`\n--- [USER PROFILE] Debug Hit: /api/v1/users/${req.params.email} ---`);
        
        const email = req.params.email;
        const paramEmail = email.toLowerCase(); 

        // 💡 ডেটাবেস কোয়েরির আগে অতিরিক্ত লগ।
        console.log(`🔎 1.5 Searching DB for email: ${paramEmail}`); 

        try {
            const user = await userCollection.findOne(
                { email: paramEmail }, 
                { projection: { password: 0 } } // পাসওয়ার্ড বাদ দেওয়া হলো
            );

            if (!user) {
                console.log(`❌ 2. User not found in DB for: ${paramEmail}`);
                // যদি DB তে না পায়, 404 দিবে।
                return res.status(404).send({ message: "User profile not found in DB." });
            }

            console.log(`✅ 3. User data sent for: ${user.name || user.email}`);
            res.send(user);

        } catch (error) {
            console.error("Error fetching user profile by email:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });


    // ------------------------------------------------------------------
    // ৬. PATCH রুট: ইউজার প্রোফাইল আপডেট করা (Private)
    // ------------------------------------------------------------------
    router.patch('/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;
        const updatedData = req.body;

        const decodedEmail = req.decoded?.email?.toLowerCase();
        const paramEmail = email.toLowerCase();

        // অথোরাইজেশন চেক: শুধুমাত্র নিজের প্রোফাইল আপডেট করার অনুমতি
        if (decodedEmail !== paramEmail) {
            return res.status(403).send({ message: "Forbidden: Cannot update another user's profile." });
        }
        
        // 🔥🔥🔥 ফিক্স: ১. ফোন নম্বর অবশ্যই পূরণীয় (Required) যাচাই 🔥🔥🔥
        // phoneNumber না থাকলে বা খালি স্ট্রিং হলে 400 ত্রুটি দিবে
        if (!updatedData.phoneNumber || updatedData.phoneNumber.trim() === '') {
            return res.status(400).send({ message: "ফোন নম্বর আপডেট করার জন্য অবশ্যই প্রয়োজন।" });
        }
        // 🔥🔥🔥 ফিক্স শেষ 🔥🔥🔥


        const updatableData = {};

        // শুধুমাত্র নির্দিষ্ট ফিল্ডগুলি আপডেটের অনুমতি দেওয়া
        if (updatedData.name) updatableData.name = updatedData.name.trim();
        if (updatedData.bloodGroup) updatableData.bloodGroup = updatedData.bloodGroup.trim();
        if (updatedData.district) updatableData.district = updatedData.district.trim();
        if (updatedData.upazila) updatableData.upazila = updatedData.upazila.trim();
        // এটি ISO স্ট্রিং হিসাবে আসছে ধরে নিলাম, TRIM এর প্রয়োজন নেই
        if (updatedData.lastDonationDate) updatableData.lastDonationDate = updatedData.lastDonationDate; 
        if (updatedData.photoURL) updatableData.photoURL = updatedData.photoURL.trim();
        
        // 🔥🔥🔥 ফিক্স: ২. ফোন নম্বর ডেটাবেসে যুক্ত করা হলো 🔥🔥🔥
        updatableData.phoneNumber = updatedData.phoneNumber.trim(); 
        // 🔥🔥🔥 ফিক্স শেষ 🔥🔥🔥


        if (Object.keys(updatableData).length === 0) {
            return res.send({ acknowledged: true, modifiedCount: 0, message: "No updatable data provided." });
        }

        try {
            const result = await userCollection.updateOne(
                { email: paramEmail },
                { $set: updatableData },
                { upsert: false }
            );

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: "User profile not found." });
            }

            res.send(result);

        } catch (error) {
            console.error("Error updating user profile by email:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });


    return router;
};