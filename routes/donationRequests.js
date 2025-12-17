// routes/donationRequests.js - সম্পূর্ণ কোড

const express = require('express');
const { ObjectId } = require('mongodb');
const verifyJWT = require('../middlewares/verifyJWT');
const verifyAdmin = require('../middlewares/verifyAdmin');

// রিকোয়েস্ট স্ট্যাটাস কনস্ট্যান্ট
const STATUS_PENDING = 'pending';
const STATUS_IN_PROGRESS = 'inprogress';
const STATUS_DONE = 'done';
const STATUS_CANCELED = 'canceled';


module.exports = function(donationRequestsCollection, userCollection){
    const router = express.Router();

    const adminChecker = verifyAdmin(userCollection);
    
    // 🔥 নতুন মিডলওয়্যার: ডোনেশন রিকোয়েস্ট তৈরির আগে ইউজারের স্ট্যাটাস চেক করবে
    const verifyUserStatus = async (req, res, next) => {
        try {
            const userEmail = req.decoded.email; // verifyJWT থেকে পাওয়া ইমেইল
            
            // ডেটাবেস থেকে ইউজারের বর্তমান স্ট্যাটাস ফেচ করা
            const user = await userCollection.findOne({ email: userEmail });

            if (!user) {
                return res.status(404).send({ message: "ব্যবহারকারী খুঁজে পাওয়া যায়নি।" });
            }

            // যদি স্ট্যাটাস 'blocked' হয়, রিকোয়েস্ট তৈরি বন্ধ করে দিন
            if (user.status === 'blocked') {
                return res.status(403).send({ 
                    message: "আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে। আপনি ডোনেশন রিকোয়েস্ট তৈরি করতে পারবেন না।" 
                });
            }
            
            // সব ঠিক থাকলে, পরের ধাপে যাও
            next();

        } catch (error) {
            console.error("Error in verifyUserStatus middleware:", error);
            res.status(500).send({ message: "সার্ভার এরর: ইউজার স্ট্যাটাস চেক ব্যর্থ।" });
        }
    };


    // ------------------------------------------------------------------
    // ৭. GET রুট: সব ডোনেশন অনুরোধ লোড করা (Admin Protected)
    // ------------------------------------------------------------------
    router.get('/admin/all-requests', verifyJWT, adminChecker, async (req, res) => {
        try{
            const requests = await donationRequestsCollection.find({})
                .sort({ createdAt: -1 })
                .toArray();

            res.send(requests);

        }catch(error){
            console.error("Error fetching all donation requests (Admin):", error);
            res.status(500).send({ message: "Internal Server Error: Failed to fetch requests." });
        }
    });

    // ------------------------------------------------------------------
    // ৮. DELETE রুট: ডোনেশন রিকোয়েস্ট ডিলিট করা (Admin Protected)
    // ------------------------------------------------------------------
    router.delete('/admin/:id', verifyJWT, adminChecker, async (req, res) => {
        const id = req.params.id;

        try{
            const result = await donationRequestsCollection.deleteOne({ _id: new ObjectId(id) });

            if(result.deletedCount > 0){
                res.send({ message: "Donation request deleted successfully by Admin." });
            }else{
                res.status(404).send({ message: "Donation request not found." });
            }

        }catch(error){
            console.error("Error deleting donation request (Admin):", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });


    // ------------------------------------------------------------------
    // ৩. GET রুট: ইউজার দ্বারা তৈরি করা সব অনুরোধ লোড করা (My Requests - Private)
    // ------------------------------------------------------------------
    router.get('/my-requests', verifyJWT, async (req, res) => {
        const email = req.decoded.email; 

        try{
            const requests = await donationRequestsCollection.find({ requesterEmail: email })
                .sort({ createdAt: -1 })
                .toArray();

            res.send(requests);

        }catch(error){
            console.error("Error fetching my donation requests:", error);
            res.status(500).send({ message: "Internal Server Error: Failed to fetch requests." });
        }
    });


    // ------------------------------------------------------------------
    // ১. GET রুট: সব "pending" ডোনেশন অনুরোধ লোড করা (Public)
    // ------------------------------------------------------------------
    router.get('/pending', async (req, res) => {
        try{
            const requests = await donationRequestsCollection.find({ requestStatus: STATUS_PENDING })
                .sort({ createdAt: -1 })
                .toArray();

            res.send(requests);

        }catch(error){
            console.error("Error fetching public pending requests:", error);
            res.status(500).send({ message: "Internal Server Error: Failed to fetch requests." });
        }
    });

    // ------------------------------------------------------------------
    // ৪. POST রুট: নতুন রক্তদানের অনুরোধ তৈরি করা (Private)
    // ------------------------------------------------------------------
    router.post('/', verifyJWT, 
        // 🔥 ব্লকড ইউজারদের রিকোয়েস্ট তৈরি করা থেকে বিরত রাখতে
        verifyUserStatus, 
        async (req, res) => {
            const requestData = req.body;
            const requesterEmail = req.decoded.email; 

            // ডেটা ভ্যালিডেশন
            const requiredFields = ['recipientName', 'recipientDistrict', 'recipientUpazila', 'bloodGroup', 'donationDate', 'donationTime'];
            const missingFields = requiredFields.filter(field => !requestData[field]);
            
            if(missingFields.length > 0){
                 return res.status(400).send({ message: `Missing required fields: ${missingFields.join(', ')}` });
            }
            
            const { recipientName, recipientDistrict, recipientUpazila, bloodGroup, donationDate, donationTime, hospitalName, fullAddress, requestMessage } = requestData;

            const newRequest = {
                recipientName,
                recipientDistrict,
                recipientUpazila,
                bloodGroup,
                donationDate,
                donationTime,
                hospitalName: hospitalName || null,
                fullAddress: fullAddress || null,
                requestMessage: requestMessage || null,
                
                requesterEmail: requesterEmail,
                requestStatus: STATUS_PENDING,
                createdAt: new Date(),
                donorName: null,
                donorEmail: null,
            };

            try{
                const result = await donationRequestsCollection.insertOne(newRequest);

                if(result.insertedId){
                    res.status(201).send({
                        message: "Donation request created successfully.",
                        insertedId: result.insertedId
                    });
                }else{
                    res.status(500).send({ message: "Failed to create donation request." });
                }

            }catch(error){
                console.error("Error creating donation request:", error);
                res.status(500).send({ message: "Internal Server Error: Failed to save request." });
            }
        });

    // ------------------------------------------------------------------
    // ৫. DELETE রুট: ডোনেশন রিকোয়েস্ট ডিলিট করা (Requester Protected)
    // ------------------------------------------------------------------
    router.delete('/:id', verifyJWT, async (req, res) => {
        const id = req.params.id;
        const requesterEmail = req.decoded.email; 

        try{
            const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
            const userRole = await userCollection.findOne({ email: requesterEmail }, { projection: { role: 1 } });
            
            if(!request){
                return res.status(404).send({ message: "Donation request not found." });
            }
            
            const isAdmin = userRole?.role === 'admin';
            if(request.requesterEmail !== requesterEmail && !isAdmin){
                return res.status(403).send({ message: "Forbidden: You can only delete your own requests (or must be an Admin)." });
            }
            
            if(request.requestStatus !== STATUS_PENDING && !isAdmin){
                return res.status(400).send({ message: "Cannot delete requests that are not 'pending' (unless you are an Admin)." });
            }

            const result = await donationRequestsCollection.deleteOne({ _id: new ObjectId(id) });

            if(result.deletedCount > 0){
                res.send({ message: "Donation request deleted successfully." });
            }else{
                res.status(404).send({ message: "Donation request not found." });
            }

        }catch(error){
            console.error("Error deleting donation request:", error);
            res.status(500).send({ message: "Internal Server Error." });
        }
    });


    // ------------------------------------------------------------------
    // ৬. PATCH রুট: রিকোয়েস্ট বিবরণ এবং স্ট্যাটাস আপডেট করা (Private)
    // ------------------------------------------------------------------
    router.patch('/:id', verifyJWT, async (req, res) => {
        const id = req.params.id;
        const updaterEmail = req.decoded.email; 
        
        const { requestStatus, donorName, donorEmail, ...updateDetails } = req.body; 
        
        // 🔥 নতুন লগ ১: ইনকামিং রিকোয়েস্ট ডেটা
        console.log("-----------------------------------------");
        console.log("PATCH Request ID:", id);
        console.log("Request Body Received:", req.body);
        console.log("Updater Email:", updaterEmail);
        console.log("-----------------------------------------");
        
        const allowedDetailsUpdates = ['recipientName', 'recipientDistrict', 'recipientUpazila', 'bloodGroup', 'donationDate', 'donationTime', 'hospitalName', 'fullAddress', 'requestMessage'];

        try{
            const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
            const userRole = await userCollection.findOne({ email: updaterEmail }, { projection: { role: 1 } });
            const isAdmin = userRole?.role === 'admin';
            
            // 🔥 নতুন লগ ২: ইউজারের রোল এবং অনুরোধের বর্তমান স্ট্যাটাস
            console.log("Is Updater Admin:", isAdmin);
            console.log("Current Request Status:", request?.requestStatus);
            console.log("New Status Attempt:", requestStatus); 

            if(!request){
                return res.status(404).send({ message: "Donation request not found." });
            }
            
            let updateOperation = {};

            // ১. বিবরণের আপডেট
            if(!requestStatus && request.requesterEmail === updaterEmail){
                 allowedDetailsUpdates.forEach(field => {
                      if (updateDetails[field] !== undefined) {
                          updateOperation[field] = updateDetails[field];
                      }
                  });
            } else if (!requestStatus && request.requesterEmail !== updaterEmail){
                return res.status(403).send({ message: "Forbidden: Only the requester can update request details." });
            }
            
            // ২. স্ট্যাটাস আপডেটের লজিক
            if(requestStatus && requestStatus !== request.requestStatus){
                
                let isValidTransition = false;
                
                // 🔥 নতুন লগ ৩: স্ট্যাটাস ট্রানজিশন চেক শুরু
                console.log("Checking Status Transition Logic for:", request.requestStatus, "->", requestStatus);


                if (requestStatus === STATUS_CANCELED) {
                    if (request.requesterEmail === updaterEmail || isAdmin) {
                        updateOperation.requestStatus = STATUS_CANCELED;
                        updateOperation.donorName = null;
                        updateOperation.donorEmail = null;
                        isValidTransition = true;
                    } else {
                        return res.status(403).send({ message: "Forbidden: Only requester or Admin can cancel." });
                    }
                } 
                else if (requestStatus === STATUS_IN_PROGRESS && request.requestStatus === STATUS_PENDING) {
                    if (donorName && donorEmail) {
                        updateOperation.requestStatus = STATUS_IN_PROGRESS;
                        updateOperation.donorName = donorName;
                        updateOperation.donorEmail = donorEmail;
                        isValidTransition = true;
                    } else {
                        return res.status(400).send({ message: "Missing donor info to set status to 'inprogress'." });
                    }
                } 
                else if (requestStatus === STATUS_DONE && (request.requestStatus === STATUS_IN_PROGRESS || request.requestStatus === STATUS_PENDING)) {
                    if (request.requesterEmail === updaterEmail || isAdmin) {
                        updateOperation.requestStatus = STATUS_DONE;
                        isValidTransition = true;
                    } else {
                        return res.status(403).send({ message: "Forbidden: Only requester or Admin can set status to 'done'." });
                    }
                } 
                
                if(!isValidTransition){
                    // 🔥 নতুন লগ ৪: ট্রানজিশন ফেইল হয়েছে
                    console.log("!!! FAILED VALIDATION: Invalid transition or insufficient permission.");
                    return res.status(400).send({ message: "Invalid status transition or insufficient permission." });
                }
            }


            // ৩. যদি কোনো ডেটা আপডেট করার না থাকে
            if (Object.keys(updateOperation).length === 0) {
                // 🔥 নতুন লগ ৫: কোনো বৈধ ডেটা নেই
                console.log("!!! FAILED VALIDATION: No valid data or status update provided.");
                return res.status(400).send({ message: "No valid data or status update provided." });
            }

            const result = await donationRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateOperation }
            );
            
            // 🔥 নতুন লগ ৬: আপডেট সফল
            console.log("Update Successful. Modified Count:", result.modifiedCount);

            res.send({ 
                message: "Request updated successfully.", 
                modifiedCount: result.modifiedCount,
            });

        }catch(error){
            console.error("Error updating donation request:", error);
            if(error.kind === 'ObjectId' || error.name === 'BSONTypeError'){
                return res.status(400).send({ message: "Invalid Request ID format." });
            }
            res.status(500).send({ message: "Internal Server Error." });
        }
    });
    
    // ------------------------------------------------------------------
    // ২. GET রুট: নির্দিষ্ট অনুরোধের বিস্তারিত লোড করা (Private/Secured)
    // ------------------------------------------------------------------
    router.get('/:id', verifyJWT, async (req, res) => {
        const id = req.params.id;
        const userEmail = req.decoded.email;

        try{
            const request = await donationRequestsCollection.findOne({ _id: new ObjectId(id) });
            
            if(!request){
                return res.status(404).send({ message: "Donation request not found." });
            }
            
            // 🌟 নিরাপত্তা চেক: ব্যবহারকারী কি রিকোয়েস্টার, অ্যাসাইনড ডোনার, নাকি অ্যাডমিন?
            const isRequester = request.requesterEmail === userEmail;
            const isAssignedDonor = request.donorEmail === userEmail && request.requestStatus === STATUS_IN_PROGRESS;
            
            // অ্যাডমিন চেক 
            const userRole = await userCollection.findOne({ email: userEmail }, { projection: { role: 1 } });
            const isAdmin = userRole?.role === 'admin';
            
            // যদি এটি একটি পাবলিক 'pending' রিকোয়েস্ট হয় এবং ব্যবহারকারী রিকোয়েস্টার বা অ্যাডমিন না হয়।
            if(request.requestStatus === STATUS_PENDING && !isRequester && !isAdmin){
                // শুধু পাবলিক তথ্য পাঠানো হবে
                const publicRequest = { ...request };
                delete publicRequest.requesterEmail;
                // donorName, donorEmail আগে থেকেই null থাকবে pending রিকোয়েস্টে।
                return res.send(publicRequest); 
            }

            // রিকোয়েস্টার, অ্যাসাইনড ডোনার বা অ্যাডমিন হলে সম্পূর্ণ তথ্য অ্যাক্সেস করতে পারবে
            if(isRequester || isAssignedDonor || isAdmin){
                return res.send(request);
            }
            
            // অন্য কোনো ক্ষেত্রে অ্যাক্সেস নেই
            return res.status(403).send({ message: "Forbidden: You do not have permission to view this specific request details." });


        }catch(error){
            console.error("Error fetching single donation request:", error);
            if(error instanceof ObjectId.BSONTypeError || error.kind === 'ObjectId' || error.name === 'BSONTypeError'){
                return res.status(400).send({ message: "Invalid Request ID format." });
            }
            res.status(500).send({ message: "Internal Server Error." });
        }
    });

    return router;
};