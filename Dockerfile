# Created by OMNSOUR - insta @kyanx7
FROM node:18-slim

# Install system dependencies for Chromium (libgbm1 and libasound2 are vital)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    libxss1 \
    libgbm1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Configure Puppeteer to use the system's pre-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install express puppeteer puppeteer-extra puppeteer-extra-plugin-stealth

# Copy the rest of the OM Proxy source code
COPY . .

# Hugging Face Spaces strictly require port 7860
EXPOSE 7860

# Startup command to launch the OM Qwen Proxy
CMD ["node", "qwen-server.js"]
