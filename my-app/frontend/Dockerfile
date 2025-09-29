# Multi-stage build for a CRA React app
############################
# Stage 1: Build React app
############################
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source and build
COPY . .
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN echo "Building with REACT_APP_API_URL=$REACT_APP_API_URL" && npm run build

############################
# Stage 2: Serve with Node
############################
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built files
COPY --from=build /app/build ./build

# Expose port and start server
EXPOSE 3000
ENV PORT=3000
CMD ["serve", "-s", "build", "-l", "3000"]