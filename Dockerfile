# Use the official Node.js image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --production
# Copy the rest of your application
COPY . .

# Expose port (if your app runs on port 3000)
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
