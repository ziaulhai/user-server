# BloodSync - Digital Blood Donation Platform

BloodSync is a specialized web application designed to streamline the process of blood donation in Bangladesh. It connects voluntary blood donors with recipients through an intuitive, real-time interface, making life-saving contributions more accessible than ever.

## 🌟 Project Overview

This platform serves as a centralized hub where users can register as donors, request specific blood groups, and find nearby volunteers during emergencies. The focus is on speed, reliability, and ease of use.

## ✨ Core Features

* **Donor Discovery:** Advanced search functionality to find donors based on blood group, district, and upazila.
* **Urgent Blood Requests:** A public board for posting and managing immediate blood needs.
* **User Profiles:** Detailed donor profiles with availability status and last donation records.
* **Dynamic Dashboard:** Separate interfaces for users and admins to manage requests and site content.
* **Responsive Design:** Fully optimized for mobile, tablet, and desktop views using modern CSS frameworks.
* **Security:** Role-based access control and secure authentication for all users.

## 🛠️ Technology Stack

* **Frontend Library:** React.js
* **Routing:** React Router DOM
* **Styling:** Tailwind CSS & DaisyUI
* **Icons:** Lucide React
* **Authentication:** Firebase Auth
* **State Management:** Context API & Custom Hooks

## 📂 Project Structure

```text
src/
├── components/     # Reusable UI components (Navbar, Footer, Cards)
├── hooks/          # Custom React hooks (useAuth, etc.)
├── pages/          # Individual page components (Home, Search, Dashboard)
├── providers/      # Context providers for global state
├── assets/         # Static images and styles
└── routes/         # Application routing logic
