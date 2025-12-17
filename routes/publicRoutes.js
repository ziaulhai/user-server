// user-server/routes/publicRoutes.js

const express = require('express');
const router = express.Router();

// কালেকশনগুলি ফাংশন প্যারামিটার হিসেবে পাস করা হলো
module.exports = function(userCollection, donationRequestsCollection, blogCollection) { 
    
    // ------------------------------------------------------------------
    // A. GET রুট: /site/stats (হোমপেজের পরিসংখ্যান)
    // ------------------------------------------------------------------
    router.get('/site/stats', async (req, res) => {
        try {
            // ১. মোট নিবন্ধিত ডোনারের সংখ্যা 
            const totalDonors = await userCollection.countDocuments({ role: 'donor', status: 'active' });

            // ২. সফল রক্তদান (Done)
            const totalDonations = await donationRequestsCollection.countDocuments({ requestStatus: 'done' });
            
            // ৩. মোট ব্লগ (Published)
            const totalBlogs = await blogCollection.countDocuments({ status: 'published' });
            
            // ৪. জীবন বাঁচানো হয়েছে (উদাহরণস্বরূপ, সফল ডোনেশন * ২ ধরা হলো)
            const livesSaved = totalDonations * 2; 

            res.send({
                totalDonors,
                totalDonations,
                livesSaved,
                totalBlogs
            });
            
        } catch (error) {
            console.error('Error fetching site stats:', error);
            res.status(500).send({ message: 'Internal Server Error: Failed to fetch site statistics.' });
        }
    });

    // ------------------------------------------------------------------
    // B. GET রুট: /blogs (হোমপেজের জন্য সাম্প্রতিক প্রকাশিত ব্লগ)
    // ------------------------------------------------------------------
    router.get('/blogs', async (req, res) => {
        try {
            const { status, limit } = req.query;
            let query = {};
            let options = {};

            // স্ট্যাটাস ফিল্টার
            if (status === 'published') {
                query.status = 'published'; 
            }
            
            // ডেটা লিমিট করা (PublicHome থেকে limit=3 আসছে)
            if (limit) {
                options.limit = parseInt(limit);
            }

            // নতুন পোস্টগুলো প্রথমে দেখানোর জন্য সর্টিং
            options.sort = { createdAt: -1 }; 

            const blogs = await blogCollection.find(query, options).toArray();
            
            res.send(blogs);
            
        } catch (error) {
            console.error('Error fetching public blogs:', error);
            res.status(500).send({ message: 'Internal Server Error: Failed to fetch blogs.' });
        }
    });

    return router;
};