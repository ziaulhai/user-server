// user-server/routes/blogPosts.js -
// এই ফাইলটি চারটি প্রধান রুট হ্যান্ডেল করে: নতুন পোস্ট তৈরি, সমস্ত পোস্ট দেখা, নির্দিষ্ট একটি পোস্ট দেখা, আপডেট করা এবং ডিলিট করা।

const express = require('express');
const { ObjectId } = require('mongodb');
const verifyJWT = require('../middlewares/verifyJWT');
// প্রয়োজনমতো অন্যান্য import (যেমন verifyAdmin, যদি আপনি Admin/Volunteer এর জন্য আলাদা মিডলওয়্যার ব্যবহার করেন)

module.exports = function (blogCollection) {
    const router = express.Router();

    // ------------------------------------------------------------------
    // ১. POST রুট: নতুন ব্লগ পোস্ট তৈরি করা (Private - Auth/JWT Protected)
    // ক্লায়েন্ট রিকোয়েস্ট: POST /api/v1/content/blog-posts
 
    router.post('/', verifyJWT, async (req, res) => {
        const postData = req.body;
        const authorEmail = req.decoded.email; // JWT থেকে ইমেইল নেওয়া

        // 🔥 এখানে ভ্যালিডেশন কন্ডিশন সরিয়ে ফেলা হয়েছে (টাইটেল/কন্টেন্ট ছাড়াই পোস্ট হবে)
        const newPost = {
            ...postData,
            authorEmail: authorEmail,
            createdAt: new Date(),
            status: postData.status || 'draft', // ডিফল্ট ড্রাফট
        };

        try {
            const result = await blogCollection.insertOne(newPost);

            if (result.insertedId) {
                res.status(201).send({
                    success: true,
                    message: "Blog post created successfully.",
                    insertedId: result.insertedId
                });
            } else {
                res.status(500).send({ message: "Failed to create blog post." });
            }

        } catch (error) {
            console.error("Error creating blog post:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });

    // ------------------------------------------------------------------
    // ২. GET রুট: সমস্ত ব্লগ পোস্ট আনা (Public/Private)
    // ক্লায়েন্ট রিকোয়েস্ট: GET /api/v1/content/blog-posts/all
   // ২. GET রুট: প্যাগিনেশন সহ সমস্ত ব্লগ পোস্ট আনা
    router.get('/all', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 0; // বর্তমান পেজ (০ থেকে শুরু)
            const size = parseInt(req.query.size) || 12; // প্রতি পেজে ১২টি

            const cursor = blogCollection.find().sort({ createdAt: -1 });
            
            // ডেটাবেস থেকে নির্দিষ্ট সংখ্যক ডেটা আনা
            const allPosts = await cursor
                .skip(page * size)
                .limit(size)
                .toArray();

            // মোট কতটি পোস্ট আছে তা বের করা
            const totalCount = await blogCollection.countDocuments();

            res.send({ allPosts, totalCount });
        } catch (error) {
            console.error("Error fetching blog posts:", error);
            res.status(500).send({ message: "Failed to fetch blog posts." });
        }
    });


    // ------------------------------------------------------------------
    // ৩. GET রুট: নির্দিষ্ট আইডি অনুযায়ী একটি ব্লগ পোস্ট আনা (Public)
    // ক্লায়েন্ট রিকোয়েস্ট: GET /api/v1/content/blog-posts/693af7ea2dbc01cbdbd7685b
    // ------------------------------------------------------------------
    router.get('/:id', async (req, res) => {
        const id = req.params.id;

        // MongoDB ObjectId ভ্যালিডেশন
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid ID format." });
        }

        try {
            const post = await blogCollection.findOne({
                _id: new ObjectId(id)
                // আপনি চাইলে এখানেও শুধু প্রকাশিত পোস্টের জন্য status: 'published' যোগ করতে পারেন
            });

            if (post) {
                res.send(post);
            } else {
                // ক্লায়েন্টকে 404 প্রতিক্রিয়া জানানো
                res.status(404).send({ message: "Blog post not found." });
            }
        } catch (error) {
            console.error("Error fetching single blog post:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });


    // ------------------------------------------------------------------
    // ৪. PATCH রুট: সম্পূর্ণ ব্লগ পোস্ট আপডেট করা (Private - Auth Protected)
    // ক্লায়েন্ট রিকোয়েস্ট: PATCH /api/v1/content/blog-posts/693af7e...
    // ------------------------------------------------------------------
    // ৪. PATCH রুট: ডায়নামিক ব্লগ পোস্ট আপডেট (Private - Auth Protected)
    router.patch('/:id', verifyJWT, async (req, res) => {
        const id = req.params.id;
        const updateInfo = req.body; // ফ্রন্টএন্ড থেকে পাঠানো অবজেক্ট (যেমন: {status: 'published'})

        // ১. ID ভ্যালিডেশন
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid ID format." });
        }

        try {
            // ২. আপডেট করার জন্য ডেটা তৈরি
            // এখানে টাইটেল বা কন্টেন্ট চেক করা হচ্ছে না, বডিতে যা আসবে তাই আপডেট হবে
            const updateDoc = {
                $set: {
                    ...updateInfo, // ডায়নামিকলি শুধু পাঠানো ফিল্ডগুলো আপডেট হবে
                    updatedAt: new Date()
                },
            };

            const result = await blogCollection.updateOne(
                { _id: new ObjectId(id) },
                updateDoc
            );

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: "Blog post not found." });
            }

            res.send({
                success: true,
                message: "Blog post updated successfully.",
                modifiedCount: result.modifiedCount
            });

        } catch (error) {
            console.error("Error updating blog post:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });

    // ------------------------------------------------------------------
    // ৫. DELETE রুট: ব্লগ পোস্ট ডিলিট করা (Private - Auth/Admin Protected)
    // ক্লায়েন্ট রিকোয়েস্ট: DELETE /api/v1/content/blog-posts/693c39547ab2245d7a25ff52
    // ------------------------------------------------------------------
    router.delete('/:id', verifyJWT, /* verifyAdmin, */ async (req, res) => {
        const id = req.params.id;

        // ১. ID ভ্যালিডেশন
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid ID format." });
        }

        try {
            const result = await blogCollection.deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 0) {
                // যদি ID ভ্যালিড হয়, কিন্তু কোনো ডকুমেন্ট ডিলিট না হয়
                return res.status(404).send({ message: "Blog post not found with this ID." });
            }

            res.send({
                message: "Blog post deleted successfully.",
                deletedCount: result.deletedCount
            });

        } catch (error) {
            console.error("Error deleting blog post:", error);
            res.status(500).send({ message: "Internal Server Error: Failed to delete post." });
        }
    });


    // ------------------------------------------------------------------
    // অন্যান্য রুট
    // ------------------------------------------------------------------

    // ... আপনার অন্যান্য রুট এখানে যোগ করতে পারেন ...

    return router;
};