FROM node:20-slim

# Install system dependencies (ffmpeg, python3 for yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (both dev and prod, needed for build step)
RUN npm install

# Copy the rest of the application code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Prune devDependencies to keep container lightweight
RUN npm prune --production

# Expose backend port
EXPOSE 5000

# Start server
CMD ["npm", "start"]
