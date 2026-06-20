FROM node:20-slim

# Install system dependencies (ffmpeg, python3 for yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package configuration
COPY package*.json ./

# Install dependencies in the container
RUN npm install

# Copy TypeScript configuration and source code explicitly
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to JavaScript
RUN npm run build

# Prune devDependencies to keep container lightweight
RUN npm prune --production

# Expose backend port
EXPOSE 5000

# Start server
CMD ["npm", "start"]
