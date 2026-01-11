FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code and schema
COPY src ./src
COPY schema.sql ./
COPY init-db.js ./

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
