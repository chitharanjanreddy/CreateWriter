/**
 * Server Entry Point
 * Starts the Express server and connects to MongoDB
 */

require('dotenv').config();

const app = require('./app');
const config = require('./config/config');
const connectDB = require('./config/database');
const User = require('./models/User');
const ApiKey = require('./models/ApiKey');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize default admin user
    await initializeAdmin();

    // Initialize API keys
    await ApiKey.initializeDefaults();

    // Start server
    const PORT = config.port;
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                                                            ║');
      console.log('║        🎵 CreativeWriter Backend Server 🎵                 ║');
      console.log('║                                                            ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║  🌐 Server:     http://localhost:${PORT}                      ║`);
      console.log(`║  📡 API:        http://localhost:${PORT}/api/${config.apiVersion}              ║`);
      console.log(`║  🔧 Mode:       ${config.env.padEnd(42)}║`);
      console.log('║                                                            ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  📚 Endpoints:                                             ║');
      console.log(`║     POST /api/${config.apiVersion}/auth/register                         ║`);
      console.log(`║     POST /api/${config.apiVersion}/auth/login                            ║`);
      console.log(`║     POST /api/${config.apiVersion}/lyrics/generate                       ║`);
      console.log(`║     GET  /api/${config.apiVersion}/admin/dashboard (Admin)               ║`);
      console.log('║                                                            ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('UNHANDLED REJECTION! 💥 Shutting down...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
      server.close(() => {
        console.log('💤 Process terminated');
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Initialize default admin user
 */
const initializeAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: config.defaultAdmin.email });
    
    if (!adminExists) {
      await User.create({
        name: config.defaultAdmin.name,
        email: config.defaultAdmin.email,
        password: config.defaultAdmin.password,
        role: 'admin',
        isEmailVerified: true
      });
      console.log('✅ Default admin user created');
      console.log(`   Email: ${config.defaultAdmin.email}`);
      console.log(`   Password: ${config.defaultAdmin.password}`);
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('Error initializing admin:', error.message);
  }
};

// Start the server
startServer();
