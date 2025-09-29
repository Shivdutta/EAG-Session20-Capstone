#!/bin/bash

# Configuration 
INSTANCE_ID="i-0e1398f155e88a628"
KEY_FILE="C:/connection-files/myapp-ubuntu-key-deepika.pem"
IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "📡 Found IP: $IP"

echo "📦 Syncing code to EC2 using scp..."

# Create temporary archive excluding unwanted files
echo "📁 Creating archive..."
tar --exclude-from='.syncignore' -czf temp-sync.tar.gz .

# Copy archive to EC2
echo "📤 Uploading to EC2..."
scp -i "$KEY_FILE" -o StrictHostKeyChecking=no temp-sync.tar.gz ubuntu@$IP:~/

# Extract on EC2 and cleanup
echo "📂 Extracting on EC2..."
# ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@$IP "cd ~/my-app && tar -xzf ~/temp-sync.tar.gz && rm ~/temp-sync.tar.gz"

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@$IP \
  "mkdir -p ~/my-app && tar -xzf ~/temp-sync.tar.gz -C ~/my-app && rm ~/temp-sync.tar.gz && sudo systemctl restart myapp"


# Cleanup local temp file
rm temp-sync.tar.gz

echo "✅ Code sync complete!"
echo "🔗 Connect: Use EC2 Instance Connect in AWS Console"