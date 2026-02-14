# CreativeWriter Backend API

🎵 **Telugu Lyrics Generator - Production Backend**

A Node.js/Express backend API for CreativeWriter, featuring user authentication, role-based access control, AI lyrics generation, and admin management.

## 🚀 Features

### Authentication & Authorization
- ✅ JWT-based authentication
- ✅ Role-based access control (Admin/User)
- ✅ Password hashing with bcrypt
- ✅ Session management with cookies
- ✅ Password reset functionality

### User Management
- ✅ User registration & login
- ✅ Profile management
- ✅ User preferences (dialect, style, poetry form)
- ✅ Admin user management (CRUD)

### API Key Management (Admin Only)
- ✅ Secure API key storage (encrypted)
- ✅ Support for multiple services:
  - Anthropic (Claude) - AI Lyrics
  - Suno - Music Generation
  - Udio - Music Generation
  - HeyGen - Video Generation
  - ElevenLabs - Voice & Music
- ✅ API key testing
- ✅ Usage tracking

### Lyrics Generation
- ✅ AI-powered Telugu lyrics generation
- ✅ 4 Regional dialects (Telangana, Rayalaseema, Coastal, Uttarandhra)
- ✅ 8 Lyrical styles
- ✅ 5 Poetry forms
- ✅ Fallback demo mode
- ✅ Lyrics CRUD operations

## 📁 Project Structure

```
creativewriter-backend/
├── src/
│   ├── config/
│   │   ├── config.js       # App configuration
│   │   └── database.js     # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminController.js
│   │   └── lyricsController.js
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   ├── errorHandler.js # Error handling
│   │   └── validate.js     # Request validation
│   ├── models/
│   │   ├── User.js
│   │   ├── ApiKey.js
│   │   └── Lyrics.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── authRoutes.js
│   │   ├── adminRoutes.js
│   │   └── lyricsRoutes.js
│   ├── utils/
│   │   └── seed.js         # Database seeding
│   ├── app.js              # Express setup
│   └── server.js           # Entry point
├── .env.example
├── package.json
└── README.md
```

## 🛠️ Installation

### Prerequisites
- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- npm or yarn

### Setup

1. **Clone the repository**
```bash
cd creativewriter-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Start MongoDB** (if local)
```bash
mongod
```

5. **Run the server**
```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

6. **Seed database** (optional)
```bash
npm run seed
```

## 🔐 Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/creativewriter

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# External APIs (Admin configurable via dashboard)
ANTHROPIC_API_KEY=
SUNO_API_KEY=
HEYGEN_API_KEY=
```

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/v1/auth/register` | Register new user | Public |
| POST | `/api/v1/auth/login` | Login user | Public |
| POST | `/api/v1/auth/logout` | Logout user | Private |
| GET | `/api/v1/auth/me` | Get current user | Private |
| PUT | `/api/v1/auth/updatedetails` | Update profile | Private |
| PUT | `/api/v1/auth/updatepassword` | Change password | Private |

### Lyrics
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/v1/lyrics/generate` | Generate lyrics | Private |
| GET | `/api/v1/lyrics` | Get user's lyrics | Private |
| GET | `/api/v1/lyrics/:id` | Get single lyrics | Private |
| PUT | `/api/v1/lyrics/:id` | Update lyrics | Private |
| DELETE | `/api/v1/lyrics/:id` | Delete lyrics | Private |
| GET | `/api/v1/lyrics/stats` | Get user stats | Private |
| GET | `/api/v1/lyrics/public` | Get public lyrics | Public |

### Admin
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/v1/admin/dashboard` | Get dashboard stats | Admin |
| GET | `/api/v1/admin/users` | List all users | Admin |
| GET | `/api/v1/admin/users/:id` | Get user details | Admin |
| PUT | `/api/v1/admin/users/:id` | Update user | Admin |
| DELETE | `/api/v1/admin/users/:id` | Delete user | Admin |
| PATCH | `/api/v1/admin/users/:id/role` | Toggle user role | Admin |
| GET | `/api/v1/admin/apikeys` | Get all API keys | Admin |
| PUT | `/api/v1/admin/apikeys/:service` | Update API key | Admin |
| POST | `/api/v1/admin/apikeys/:service/test` | Test API key | Admin |

## 📝 API Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "రాము",
    "email": "ramu@example.com",
    "password": "Password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@akashinnotech.com",
    "password": "Admin@123"
  }'
```

### Generate Lyrics
```bash
curl -X POST http://localhost:5000/api/v1/lyrics/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "theme": "వసంత ఋతువు",
    "style": "romantic",
    "dialect": "telangana",
    "poetryForm": "geeyam"
  }'
```

### Update API Key (Admin)
```bash
curl -X PUT http://localhost:5000/api/v1/admin/apikeys/anthropic \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "key": "sk-ant-xxxxx"
  }'
```

## 🔑 Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@akashinnotech.com | Admin@123 |
| User | ramu@example.com | User@123 |

## 🏗️ Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/creativewriter
    depends_on:
      - mongo
  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
volumes:
  mongo-data:
```

## 🔒 Security Features

- Helmet.js for HTTP headers
- Rate limiting (100 requests/15 min)
- CORS configuration
- JWT token authentication
- Password hashing (bcrypt, 12 rounds)
- API key encryption (AES-256)
- Input validation
- SQL/NoSQL injection prevention

## 📊 Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - Akash InnoTech Pvt Ltd

## 🆘 Support

- Email: support@akashinnotech.com
- Documentation: https://docs.akashinnotech.com
