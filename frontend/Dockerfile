FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Create model directory and download YOLOv8n model for WASM mode
RUN mkdir -p /usr/share/nginx/html/model
RUN apk add --no-cache curl && \
    curl -L -o /usr/share/nginx/html/model/yolov8n.onnx \
    "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx" || \
    echo "Model download failed, will use mock detection"

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]