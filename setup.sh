#!/bin/bash

# Install dependencies
npm install

# Start the server with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Show status
pm2 status 