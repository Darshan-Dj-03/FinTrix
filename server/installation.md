run 
**cd server**
**npm install**

to run the backend
**cd server** 
**npm run dev**

.env 
# ─── MongoDB Atlas ────────────────────────────────────────────────────────────
# Replace <username>, <password>, and <cluster-url> with your Atlas credentials
MONGO_URI=mongodb+srv://Admin_FinTrix:adminfintrix@fintrixcluster.ih2ikhs.mongodb.net/fintrix_core?retryWrites=true&w=majority

# ─── JWT ──────────────────────────────────────────────────────────────────────
# Use a long, random string in production (e.g. generated with: openssl rand -hex 64)
JWT_SECRET=4d8f680d60c66f267e80a2762ff1a6c385bec36d395a69af65cd6d366a13cb3a
JWT_EXPIRES_IN=7d

# ─── Server ───────────────────────────────────────────────────────────────────
PORT=5000

# ─── CORS ─────────────────────────────────────────────────────────────────────
# In production, restrict to your frontend domain e.g. https://fintrix.example.com
# Use * only during development
CORS_ORIGIN=*
