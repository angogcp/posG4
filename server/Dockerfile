# Use Node.js LTS (Long Term Support)
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
# If you are building for production, use 'npm ci --only=production'
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Create the data directory (for SQLite persistence)
RUN mkdir -p data

# Expose the port the app runs on
EXPOSE 4001

# Define the volume for persistence (Important for Fly.io/Docker)
VOLUME ["/app/data"]

# Command to run the app
CMD ["npm", "start"]
