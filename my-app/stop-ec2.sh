#!/bin/bash
INSTANCE_ID="i-0e1398f155e88a628"

echo "🛑 Stopping EC2 instance..."
aws ec2 stop-instances --instance-ids $INSTANCE_ID
echo "💰 Instance stopped - you're only paying for storage now!"