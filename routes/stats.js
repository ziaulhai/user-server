// user-server/routes/stats.js - চূড়ান্ত কার্যকরী কোড

const express = require('express');
const verifyJWT = require('../middlewares/verifyJWT');
const verifyAdmin = require('../middlewares/verifyAdmin'); 

module.exports = function(userCollection, donationRequestsCollection) { 
    const router = express.Router();
    
    // verifyAdmin মিডলওয়্যার ইনস্ট্যান্স তৈরি করা হলো
    const adminChecker = verifyAdmin(userCollection); 

    // ------------------------------------------------------------------
    // ১. GET রুট: অ্যাডমিন ও ভলান্টিয়ারের জন্য পরিসংখ্যান (Admin/Volunteer Protected)
    // URL: /stats/admin-stats
    // ------------------------------------------------------------------
    router.get('/admin-stats', verifyJWT, adminChecker, async (req, res) => {
        try {
            // A. মোট ডোনারের সংখ্যা
            const totalDonors = await userCollection.countDocuments({ role: 'donor', status: 'active' });
            
            // B. মোট ইউজার (ডোনার + ভলান্টিয়ার + অ্যাডমিন)
            const totalUsers = await userCollection.countDocuments({}); 
            
            // C. মোট ডোনেশন অনুরোধ
            const totalRequests = await donationRequestsCollection.countDocuments({});
            
            // D. স্ট্যাটাস অনুযায়ী অনুরোধের সংখ্যা
            const requestStatusCount = await donationRequestsCollection.aggregate([
                { $group: { _id: "$requestStatus", count: { $sum: 1 } } }
            ]).toArray();
            
            // D.1: এটিকে সহজে ব্যবহার করার জন্য একটি অবজেক্টে রূপান্তর করা হলো
            const requestStats = requestStatusCount.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, { pending: 0, inprogress: 0, done: 0, canceled: 0 }); // ডিফল্ট মান সেট করা হলো

            res.send({
                totalDonors,
                totalUsers,
                totalRequests,
                ...requestStats,
            });

        } catch (error) {
            console.error("Error fetching admin stats:", error);
            res.status(500).send({ message: "Internal Server Error: Failed to fetch statistics." });
        }
    });
    
    // ------------------------------------------------------------------
    // ২. GET রুট: ডোনার ড্যাশবোর্ডের জন্য পরিসংখ্যান (Donor Protected)
    // URL: /stats/donor-stats
    // ------------------------------------------------------------------
    router.get('/donor-stats', verifyJWT, async (req, res) => {
        // 🔥 ফিক্স: req.decoded.email থেকে ডোনারের ইমেইল নেওয়া হলো
        const email = req.decoded.email; 
        
        try {
            // A. ডোনারের তৈরি করা মোট অনুরোধ
            const myTotalRequests = await donationRequestsCollection.countDocuments({ requesterEmail: email });
            
            // B. ডোনারের তৈরি করা অনুরোধের স্ট্যাটাস অনুযায়ী সংখ্যা
            const myRequestStatusCount = await donationRequestsCollection.aggregate([
                { $match: { requesterEmail: email } },
                { $group: { _id: "$requestStatus", count: { $sum: 1 } } }
            ]).toArray();

            const myRequestStats = myRequestStatusCount.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, { pending: 0, inprogress: 0, done: 0, canceled: 0 });

            res.send({
                myTotalRequests,
                ...myRequestStats,
            });

        } catch (error) {
            console.error("Error fetching donor stats:", error);
            res.status(500).send({ message: "Internal Server Error: Failed to fetch donor statistics." });
        }
    });

    return router;
};