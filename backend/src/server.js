const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const { app } = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

let server;

async function start() {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
    });
  } catch (err) {
    process.exit(1);
  }
}

async function shutdown(signal) {
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  } catch (err) {
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
